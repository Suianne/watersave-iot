
import requests
import time

URL = "http://127.0.0.1:5000"

TOTAL_TESTES = 100
SUCESSOS = 0
FALHAS = 0

leitura = {
    "temperaturaAtual": 32.5,
    "temperaturaAlvo": 38.0,
    "histerese": 2.0,
    "vazao": 4.5,
    "volumeTransferido": 1.2,
    "valvulaAberta": True,
    "estadoSistema": 2,
    "alerta": "Normal"
}

print("\n====================================")
print(" TESTE DE ESTABILIDADE - WATERSAVE")
print("====================================\n")

for i in range(1, TOTAL_TESTES + 1):
    try:
        resposta = requests.post(
            f"{URL}/api/leituras",
            json=leitura,
            timeout=5
        )

        if resposta.status_code == 201:
            SUCESSOS += 1
        else:
            FALHAS += 1

            print(
                f"[FALHA] Leitura {i}: "
                f"HTTP {resposta.status_code}"
            )

            print(f"Resposta da API: {resposta.text}")

    except requests.RequestException as erro:
        FALHAS += 1
        print(f"[FALHA] Leitura {i}: {erro}")

    if i % 10 == 0:
        print(f"Progresso: {i}/{TOTAL_TESTES}")

    time.sleep(0.1)

print("\n====================================")
print(" RESULTADO")
print("====================================")
print(f"Total de envios: {TOTAL_TESTES}")
print(f"Sucessos: {SUCESSOS}")
print(f"Falhas: {FALHAS}")

if FALHAS == 0:
    print("\n[APROVADO] API recebeu todas as leituras.")
else:
    print("\n[REPROVADO] Foram encontradas falhas.")
