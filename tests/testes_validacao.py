
import json
import sqlite3
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BASE_URL = "http://127.0.0.1:5000"
BANCO = Path(__file__).parent.parent / "api" / "watersave.db"


def requisicao(metodo, endpoint, dados=None):
    corpo = None

    if dados is not None:
        corpo = json.dumps(dados).encode("utf-8")

    req = Request(
        BASE_URL + endpoint,
        data=corpo,
        method=metodo,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urlopen(req) as resposta:
            return resposta.status, resposta.read().decode("utf-8")
    except HTTPError as erro:
        return erro.code, erro.read().decode("utf-8")


# Dados válidos para uma leitura
leitura = {
    "temperaturaAtual": 32.5,
    "temperaturaAlvo": 35.0,
    "histerese": 2.0,
    "vazao": 4.5,
    "volumeTransferido": 12.8,
    "valvulaAberta": True,
    "estadoSistema": 1,
    "alerta": ""
}

print("\n--- TESTE 1: REJEITAR LEITURA INCOMPLETA ---")

leitura_incompleta = leitura.copy()
del leitura_incompleta["alerta"]

status, resposta = requisicao(
    "POST", "/api/leituras", leitura_incompleta
)

assert status == 400, f"Esperado 400, recebido {status}"
print("OK: leitura incompleta rejeitada.")


print("\n--- TESTE 2: REJEITAR ESTADO INVALIDO ---")

leitura_invalida = leitura.copy()
leitura_invalida["estadoSistema"] = 5

status, resposta = requisicao(
    "POST", "/api/leituras", leitura_invalida
)

assert status == 400, f"Esperado 400, recebido {status}"
print("OK: estado inválido rejeitado.")


print("\n--- TESTE 3: REJEITAR COMANDO INVALIDO ---")

status, resposta = requisicao(
    "POST",
    "/api/comandos",
    {"comando": 7}
)

assert status == 400, f"Esperado 400, recebido {status}"
print("OK: comando inválido rejeitado.")


print("\n--- TESTE 4: VERIFICAR PERSISTENCIA ---")

status, resposta = requisicao(
    "POST", "/api/leituras", leitura
)

assert status == 201, f"Falha ao cadastrar leitura: {status}"

with sqlite3.connect(BANCO) as conexao:
    resultado = conexao.execute(
        """
        SELECT temperaturaAtual, temperaturaAlvo,
               estadoSistema, alerta
        FROM leituras
        ORDER BY id DESC
        LIMIT 1
        """
    ).fetchone()

assert resultado is not None, "Leitura não encontrada no banco."
assert resultado[0] == 32.5
assert resultado[1] == 35.0
assert resultado[2] == 1
assert resultado[3] == ""

print("OK: leitura encontrada e conferida no SQLite.")

print("\nTODOS OS TESTES DE VALIDACAO E PERSISTENCIA PASSARAM!")
