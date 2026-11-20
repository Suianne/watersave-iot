
import sys
import sqlite3
import tempfile
from pathlib import Path

# Permite importar o database.py da pasta api
PASTA_API = Path(__file__).resolve().parent.parent / "api"
sys.path.insert(0, str(PASTA_API))

import database


def executar_testes():
    print("\n====================================")
    print(" TESTES DE PERSISTÊNCIA - WATERSAVE")
    print("====================================\n")

    with tempfile.TemporaryDirectory() as pasta:
        banco_teste = Path(pasta) / "watersave_teste.db"

        # Utiliza um banco temporário, sem alterar o banco real
        database.DATABASE_PATH = banco_teste

        # TESTE 1: Inicialização do banco
        database.inicializar_banco()

        assert banco_teste.exists()
        print("[APROVADO] Banco SQLite criado.")

        # TESTE 2: Verificação das tabelas
        with sqlite3.connect(banco_teste) as conexao:
            tabelas = conexao.execute("""
                SELECT name FROM sqlite_master
                WHERE type = 'table'
            """).fetchall()

        nomes = [tabela[0] for tabela in tabelas]

        assert "leituras" in nomes
        assert "comandos" in nomes
        print("[APROVADO] Tabelas leituras e comandos criadas.")

        # TESTE 3: Gravação de leitura
        leitura = {
            "temperaturaAtual": 32.5,
            "temperaturaAlvo": 38.0,
            "histerese": 2.0,
            "vazao": 4.5,
            "volumeTransferido": 1.2,
            "valvulaAberta": 1,
            "estadoSistema": 2,
            "alerta": "Normal"
        }

        database.salvar_leitura(leitura)

        with sqlite3.connect(banco_teste) as conexao:
            total = conexao.execute(
                "SELECT COUNT(*) FROM leituras"
            ).fetchone()[0]

        assert total == 1
        print("[APROVADO] Leitura armazenada no banco.")

        # TESTE 4: Cadastro de comando
        comando_id = database.salvar_comando(38.0, 4)

        assert comando_id > 0
        print("[APROVADO] Comando armazenado no banco.")

        # TESTE 5: Consulta de comandos pendentes
        comandos = database.obter_comandos()

        assert len(comandos) == 1
        assert comandos[0]["id"] == comando_id
        assert comandos[0]["comando"] == 4

        print("[APROVADO] Comando pendente consultado.")

        # TESTE 6: Confirmação do comando
        resultado = database.marcar_comando_processado(comando_id)

        assert resultado is True
        print("[APROVADO] Comando marcado como processado.")

        # TESTE 7: Verificação da fila de comandos
        comandos = database.obter_comandos()

        assert len(comandos) == 0
        print("[APROVADO] Comando processado não aparece na fila.")

        # TESTE 8: Persistência após reinicialização do banco
        database.inicializar_banco()

        conexao = sqlite3.connect(banco_teste)

        try:
            leitura_salva = conexao.execute("""
                SELECT temperaturaAtual
                FROM leituras
            """).fetchone()

            comando_salvo = conexao.execute("""
                SELECT comando, processado
                FROM comandos
                WHERE id = ?
            """, (comando_id,)).fetchone()

        finally:
            conexao.close()

        assert leitura_salva is not None
        assert leitura_salva[0] == 32.5

        assert comando_salvo is not None
        assert comando_salvo[0] == 4
        assert comando_salvo[1] == 1

        print("[APROVADO] Dados preservados após reinicialização do banco.")

    print("\n====================================")
    print(" TODOS OS TESTES FORAM APROVADOS!")
    print("====================================")


if __name__ == "__main__":
    executar_testes()
