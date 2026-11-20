
import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:5000"


def requisicao(metodo, endpoint, dados=None):
    url = BASE_URL + endpoint

    corpo = None
    cabecalhos = {}

    if dados is not None:
        corpo = json.dumps(dados).encode("utf-8")
        cabecalhos["Content-Type"] = "application/json"

    req = urllib.request.Request(
        url,
        data=corpo,
        headers=cabecalhos,
        method=metodo
    )

    try:
        with urllib.request.urlopen(req) as resposta:
            resultado = json.loads(resposta.read().decode("utf-8"))
            print(f"\n[{resposta.status}] {metodo} {endpoint}")
            print(json.dumps(resultado, indent=4, ensure_ascii=False))
            return resposta.status, resultado

    except urllib.error.HTTPError as erro:
        resultado = json.loads(erro.read().decode("utf-8"))
        print(f"\n[{erro.code}] {metodo} {endpoint}")
        print(resultado)
        return erro.code, resultado


# 1. Simular leitura dos sensores
leitura = {
    "temperaturaAtual": 32.5,
    "temperaturaAlvo": 35.0,
    "histerese": 2.0,
    "vazao": 4.5,
    "volumeTransferido": 12.8,
    "valvulaAberta": True,
    "estadoSistema": 1,
    "alerta": "Sistema funcionando normalmente"
}

status, resposta = requisicao(
    "POST",
    "/api/leituras",
    leitura
)

assert status == 201, "Falha ao enviar leitura"


# 2. Cadastrar comando para o ESP32
comando = {
    "temperaturaAlvo": 38.0,
    "comando": 4
}

status, resposta = requisicao(
    "POST",
    "/api/comandos",
    comando
)

assert status == 201, "Falha ao cadastrar comando"

comando_id = resposta["id"]


# 3. ESP32 consulta comandos pendentes
status, resposta = requisicao(
    "GET",
    "/api/comandos"
)

assert status == 200, "Falha ao consultar comandos"

assert any(
    item["id"] == comando_id
    for item in resposta["comandos"]
), "Comando não encontrado"


# 4. ESP32 confirma o recebimento do comando
status, resposta = requisicao(
    "POST",
    f"/api/comandos/{comando_id}/confirmar"
)

assert status == 200, "Falha ao confirmar comando"


# 5. Verificar se o comando não aparece novamente
status, resposta = requisicao(
    "GET",
    "/api/comandos"
)

assert not any(
    item["id"] == comando_id
    for item in resposta["comandos"]
), "Comando ainda aparece como pendente"

print("\nTODOS OS TESTES DE COMUNICACAO PASSARAM!")
