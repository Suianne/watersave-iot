
import sqlite3
from pathlib import Path

# Banco armazenado na própria pasta da API
DATABASE_PATH = Path(__file__).parent / "watersave.db"

# Comando que o ESP32 não buscou nesse prazo é descartado. Assim um "abrir válvula" antigo
# não é executado quando o ESP32 volta de uma queda de Wi-Fi.
VALIDADE_COMANDO_S = 10
# Folga para o ESP32 confirmar um comando buscado no fim do prazo. Só depois dela a
# situação do comando passa de "pendente" para "expirado".
FOLGA_CONFIRMACAO_S = 5


def conectar():
    conexao = sqlite3.connect(DATABASE_PATH)
    conexao.row_factory = sqlite3.Row
    return conexao


def inicializar_banco():
    with conectar() as conexao:
        conexao.execute("""
            CREATE TABLE IF NOT EXISTS leituras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                temperaturaAtual REAL NOT NULL,
                temperaturaAlvo REAL NOT NULL,
                histerese REAL NOT NULL,
                vazao REAL NOT NULL,
                volumeTransferido REAL NOT NULL,
                valvulaAberta INTEGER NOT NULL,
                estadoSistema INTEGER NOT NULL,
                alerta TEXT NOT NULL,
                data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conexao.execute("""
            CREATE TABLE IF NOT EXISTS comandos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                temperaturaAlvo REAL,
                comando INTEGER NOT NULL,
                processado INTEGER DEFAULT 0,
                data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)


def salvar_leitura(dados):
    campos = (
        "temperaturaAtual",
        "temperaturaAlvo",
        "histerese",
        "vazao",
        "volumeTransferido",
        "valvulaAberta",
        "estadoSistema",
        "alerta"
    )

    valores = [dados[campo] for campo in campos]

    with conectar() as conexao:
        conexao.execute("""
            INSERT INTO leituras (
                temperaturaAtual, temperaturaAlvo, histerese,
                vazao, volumeTransferido, valvulaAberta,
                estadoSistema, alerta
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, valores)



def converter_leitura(linha):
    leitura = dict(linha)
    leitura["valvulaAberta"] = bool(leitura["valvulaAberta"])
    return leitura


def obter_ultima_leitura():
    """Retorna a leitura mais recente e seu timestamp Unix para detectar dados antigos."""
    with conectar() as conexao:
        linha = conexao.execute("""
            SELECT *,
                   CAST(strftime('%s', data_hora) AS INTEGER) AS timestamp
            FROM leituras
            ORDER BY id DESC
            LIMIT 1
        """).fetchone()

        if linha is None:
            return None

        return converter_leitura(linha)


def obter_leituras(desde, limite):
    """Leituras a partir do timestamp Unix `desde`, em ordem cronológica.
    Se passarem do limite, ficam as mais recentes."""
    with conectar() as conexao:
        linhas = conexao.execute("""
            SELECT * FROM (
                SELECT *,
                       CAST(strftime('%s', data_hora) AS INTEGER) AS timestamp
                FROM leituras
                WHERE data_hora >= datetime(?, 'unixepoch')
                ORDER BY id DESC
                LIMIT ?
            )
            ORDER BY id ASC
        """, (desde, limite)).fetchall()

        return [converter_leitura(linha) for linha in linhas]


def obter_comandos():
    """Comandos que o ESP32 ainda pode executar: não avaliados e dentro da validade."""
    with conectar() as conexao:
        linhas = conexao.execute("""
            SELECT id, temperaturaAlvo, comando
            FROM comandos
            WHERE processado = 0
              AND data_hora >= datetime('now', ?)
            ORDER BY id ASC
        """, (f"-{VALIDADE_COMANDO_S} seconds",)).fetchall()

        return [dict(linha) for linha in linhas]


def obter_comando(comando_id):
    """Comando com a situação: pendente, avaliado (o ESP32 confirmou) ou expirado
    (descartado sem o ESP32 buscar)."""
    with conectar() as conexao:
        linha = conexao.execute("""
            SELECT id, temperaturaAlvo, comando,
                   CAST(strftime('%s', data_hora) AS INTEGER) AS timestamp,
                   CASE
                       WHEN processado = 1 THEN 'avaliado'
                       WHEN data_hora < datetime('now', ?) THEN 'expirado'
                       ELSE 'pendente'
                   END AS situacao
            FROM comandos
            WHERE id = ?
        """, (f"-{VALIDADE_COMANDO_S + FOLGA_CONFIRMACAO_S} seconds", comando_id)).fetchone()

        return None if linha is None else dict(linha)


def salvar_comando(temperatura_alvo, comando):
    with conectar() as conexao:
        cursor = conexao.execute("""
            INSERT INTO comandos (temperaturaAlvo, comando)
            VALUES (?, ?)
        """, (temperatura_alvo, comando))

        return cursor.lastrowid


def marcar_comando_processado(comando_id):
    with conectar() as conexao:
        resultado = conexao.execute("""
            UPDATE comandos
            SET processado = 1
            WHERE id = ? AND processado = 0
        """, (comando_id,))

        return resultado.rowcount > 0
