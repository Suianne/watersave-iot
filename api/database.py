
import sqlite3
from pathlib import Path

# Banco armazenado na própria pasta da API
DATABASE_PATH = Path(__file__).parent / "watersave.db"


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

        leitura = dict(linha)
        leitura["valvulaAberta"] = bool(leitura["valvulaAberta"])
        return leitura

def obter_comandos():
    with conectar() as conexao:
        linhas = conexao.execute("""
            SELECT id, temperaturaAlvo, comando
            FROM comandos
            WHERE processado = 0
            ORDER BY id ASC
        """).fetchall()

        return [dict(linha) for linha in linhas]


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
