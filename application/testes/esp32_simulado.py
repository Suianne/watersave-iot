"""ESP32 simulado: testa o dashboard com a API de verdade, sem o hardware.

Faz o papel do firmware (firmware/WaterSave): a cada 2 s envia a telemetria para
POST /api/leituras, busca o primeiro comando pendente em GET /api/comandos, aplica as
regras do contrato de dados e confirma em POST /api/comandos/<id>/confirmar.

A temperatura sobe e desce sozinha entre 27 e 40 °C (um ciclo a cada 2 minutos),
então a válvula abre e fecha pela histerese sem ninguém mexer.

Uso, com a API rodando (cd api && python app.py):
    python application/testes/esp32_simulado.py
    python application/testes/esp32_simulado.py --api http://192.168.0.10:5000

Só usa a biblioteca padrão do Python. Ctrl+C encerra.
"""

import argparse
import json
import math
import random
import time
import urllib.error
import urllib.request

INICIANDO, AGUARDANDO, TRANSFERINDO, MANUAL, FALHA = range(5)
NOME_ESTADO = ["INICIANDO", "AGUARDANDO", "TRANSFERINDO", "MANUAL", "FALHA"]
NOME_COMANDO = {
    1: "parada de emergência",
    2: "resetar falha",
    3: "modo manual",
    4: "modo automático",
    5: "abrir válvula",
    6: "fechar válvula",
    7: "atualizar temperatura-alvo",
}
ALVO_MIN, ALVO_MAX = 20.0, 70.0
TIMEOUT_HTTP_S = 1.5


class Esp32Simulado:
    def __init__(self):
        self.inicio = time.monotonic()
        self.alvo = 35.0
        self.histerese = 2.0
        self.estado = INICIANDO
        self.valvula = False
        self.alerta = ""
        self.vazao = 0.0
        self.volume = 0.0
        self.temperatura = 33.5

    def avancar(self, dt):
        t = time.monotonic() - self.inicio
        self.temperatura = 33.5 + 6.5 * math.sin(2 * math.pi * t / 120) + random.uniform(-0.1, 0.1)
        self.vazao = max(0.0, 5.0 + random.uniform(-0.2, 0.2)) if self.valvula else 0.0
        self.volume += self.vazao / 60 * dt

        if self.estado == INICIANDO and t >= 2:
            self.estado = AGUARDANDO
        elif self.estado == AGUARDANDO and self.temperatura >= self.alvo:
            self.valvula, self.estado = True, TRANSFERINDO
        elif self.estado == TRANSFERINDO and self.temperatura <= self.alvo - self.histerese:
            self.valvula, self.estado = False, AGUARDANDO

    def telemetria(self):
        return {
            "temperaturaAtual": round(self.temperatura, 2),
            "temperaturaAlvo": self.alvo,
            "histerese": self.histerese,
            "vazao": round(self.vazao, 2),
            "volumeTransferido": round(self.volume, 3),
            "valvulaAberta": self.valvula,
            "estadoSistema": self.estado,
            "alerta": self.alerta,
        }

    def aplicar(self, codigo, alvo=None):
        """Regras de aceitação do contrato de dados. Retorna True se o comando foi aceito."""
        alvo_valido = alvo is not None and ALVO_MIN <= alvo <= ALVO_MAX
        if codigo == 7:
            if not alvo_valido:
                return False
            self.alvo = round(alvo, 1)
            return True

        if codigo == 1:
            self.valvula, self.estado, self.alerta = False, FALHA, "PARADA_EMERGENCIA"
        elif codigo == 2 and self.estado == FALHA:
            self.estado, self.alerta = AGUARDANDO, ""
        elif codigo == 3 and self.estado not in (INICIANDO, MANUAL):
            self.valvula, self.estado, self.alerta = False, MANUAL, ""
        elif codigo == 4 and self.estado == MANUAL:
            self.valvula, self.estado = False, AGUARDANDO
        elif codigo == 5 and self.estado == MANUAL and not self.valvula:
            self.valvula = True
        elif codigo == 6 and self.estado == MANUAL and self.valvula:
            self.valvula = False
        else:
            return False

        if alvo_valido:
            self.alvo = round(alvo, 1)
        return True


def requisitar(api, metodo, caminho, corpo=None):
    dados = None if corpo is None else json.dumps(corpo).encode()
    pedido = urllib.request.Request(
        api + caminho, data=dados, method=metodo, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(pedido, timeout=TIMEOUT_HTTP_S) as resposta:
        return json.loads(resposta.read() or b"null")


def ciclo(esp32, api, dt):
    esp32.avancar(dt)
    requisitar(api, "POST", "/api/leituras", esp32.telemetria())
    estado = NOME_ESTADO[esp32.estado]
    print(f"[REDE] {esp32.temperatura:5.2f} °C | alvo {esp32.alvo:.1f} | {estado:12} | válvula {'aberta' if esp32.valvula else 'fechada'}")

    comandos = requisitar(api, "GET", "/api/comandos").get("comandos", [])
    if not comandos:
        return
    comando = comandos[0]
    aceito = esp32.aplicar(comando.get("comando"), comando.get("temperaturaAlvo"))
    nome = NOME_COMANDO.get(comando.get("comando"), "desconhecido")
    print(f"[SERVICO] comando {comando['id']} ({nome}): {'aceito' if aceito else 'recusado'}")
    # confirma mesmo recusado: a confirmação só diz que o comando foi avaliado
    requisitar(api, "POST", f"/api/comandos/{comando['id']}/confirmar")


def main():
    argumentos = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    # 127.0.0.1 em vez de localhost: no Windows, localhost tenta IPv6 primeiro e cada envio atrasa ~1 s
    argumentos.add_argument("--api", default="http://127.0.0.1:5000", help="endereço da API (padrão: %(default)s)")
    argumentos.add_argument("--intervalo", type=float, default=2.0, help="segundos entre envios (padrão: %(default)s)")
    opcoes = argumentos.parse_args()
    api = opcoes.api.rstrip("/")

    esp32 = Esp32Simulado()
    print(f"ESP32 simulado enviando para {api} a cada {opcoes.intervalo:g} s. Ctrl+C encerra.")
    try:
        while True:
            try:
                ciclo(esp32, api, opcoes.intervalo)
            except (urllib.error.URLError, OSError, ValueError) as erro:
                print(f"[REDE] falha na comunicação com a API: {erro}")
            time.sleep(opcoes.intervalo)
    except KeyboardInterrupt:
        print("\nESP32 simulado encerrado.")


if __name__ == "__main__":
    main()
