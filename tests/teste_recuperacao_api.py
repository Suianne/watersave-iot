
import requests
import time

URL = "http://127.0.0.1:5000"

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


def verificar_api():
    try:
        resposta = requests.get(
            f"{URL}/",
            timeout=3
        )
        return resposta.status_code == 200
    except requests.RequestException:
        return False


print("\n====================================")
print(" TESTE DE RECUPERAÇÃO - WATERSAVE")
print("====================================\n")

# TESTE 1: API inicialmente funcionando
if not verificar_api():
    print("[ERRO] API não está funcionando.")
    print("Inicie a API com: python app.py")
    raise SystemExit(1)

print("[APROVADO] API inicialmente disponível.")

# TESTE 2: Interrupção manual
input(
    "\nAgora vá ao terminal da API e pressione CTRL+C."
    "\nDepois volte aqui e pressione ENTER."
)

if verificar_api():
    print("[REPROVADO] API ainda está respondendo.")
    print("A interrupção não foi detectada.")
    raise SystemExit(1)

print("[APROVADO] Interrupção da API detectada.")

# TESTE 3: Recuperação
input(
    "\nAgora inicie novamente a API com python app.py."
    "\nQuando ela estiver funcionando, pressione ENTER."
)

print("\nAguardando recuperação da API...")

recuperada = False

for tentativa in range(1, 31):
    if verificar_api():
        recuperada = True
        break

    print(f"Tentativa {tentativa}/30...")
    time.sleep(2)

if not recuperada:
    print("[REPROVADO] API não voltou a responder.")
    raise SystemExit(1)

print("[APROVADO] API voltou a responder.")

# TESTE 4: Envio após recuperação
try:
    resposta = requests.post(
        f"{URL}/api/leituras",
        json=leitura,
        timeout=5
    )

    if resposta.status_code == 201:
        print("[APROVADO] API recebeu nova leitura após recuperação.")
    else:
        print("[REPROVADO] Falha no envio após recuperação.")
        print("HTTP:", resposta.status_code)
        print("Resposta:", resposta.text)
        raise SystemExit(1)

except requests.RequestException as erro:
    print("[REPROVADO] Erro de comunicação:", erro)
    raise SystemExit(1)

print("\n====================================")
print(" TESTE DE RECUPERAÇÃO CONCLUÍDO!")
print("====================================")
