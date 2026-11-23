from flask import Flask, jsonify, request
from flask_cors import CORS

from database import (
    VALIDADE_COMANDO_S,
    inicializar_banco,
    salvar_leitura,
    obter_ultima_leitura,
    obter_leituras,
    obter_comandos,
    obter_comando,
    salvar_comando,
    marcar_comando_processado,
)

# histórico pedido pelo dashboard: 6000 leituras são cerca de 3 h com uma leitura a cada 2 s
LIMITE_PADRAO_LEITURAS = 1000
LIMITE_MAXIMO_LEITURAS = 6000

app = Flask(__name__)
CORS(app)


@app.get("/")
def inicio():
    return jsonify({"projeto": "WaterSave", "api": "REST", "status": "online"})


@app.post("/api/leituras")
def receber_leitura():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify({"erro": "JSON invalido"}), 400

    campos = [
        "temperaturaAtual", "temperaturaAlvo", "histerese", "vazao",
        "volumeTransferido", "valvulaAberta", "estadoSistema", "alerta",
    ]
    if not all(campo in dados for campo in campos):
        return jsonify({"erro": "Campos obrigatorios ausentes"}), 400

    for campo in campos[:5]:
        valor = dados[campo]
        if isinstance(valor, bool) or not isinstance(valor, (int, float)):
            return jsonify({"erro": f"Valor numerico invalido: {campo}"}), 400

    estado = dados["estadoSistema"]
    if isinstance(estado, bool) or not isinstance(estado, int) or not 0 <= estado <= 4:
        return jsonify({"erro": "estadoSistema deve ser inteiro entre 0 e 4"}), 400

    if not isinstance(dados["valvulaAberta"], bool):
        return jsonify({"erro": "valvulaAberta deve ser booleano"}), 400
    if not isinstance(dados["alerta"], str):
        return jsonify({"erro": "alerta deve ser texto"}), 400

    try:
        salvar_leitura(dados)
        return jsonify({"mensagem": "Leitura armazenada", "status": "ok"}), 201
    except Exception:
        app.logger.exception("Erro ao salvar leitura")
        return jsonify({"erro": "Falha ao armazenar leitura"}), 500


@app.get("/api/leituras/ultima")
def consultar_ultima_leitura():
    try:
        return jsonify({"leitura": obter_ultima_leitura()})
    except Exception:
        app.logger.exception("Erro ao consultar leitura")
        return jsonify({"erro": "Falha ao consultar leitura"}), 500


@app.get("/api/leituras")
def consultar_leituras():
    desde = request.args.get("desde", type=int)
    limite = request.args.get("limite", LIMITE_PADRAO_LEITURAS, type=int)
    if desde is None or desde < 0:
        return jsonify({"erro": "desde deve ser um timestamp Unix em segundos"}), 400
    if not 1 <= limite <= LIMITE_MAXIMO_LEITURAS:
        return jsonify({"erro": f"limite deve estar entre 1 e {LIMITE_MAXIMO_LEITURAS}"}), 400

    try:
        leituras = obter_leituras(desde, limite)
        return jsonify({"quantidade": len(leituras), "leituras": leituras})
    except Exception:
        app.logger.exception("Erro ao consultar leituras")
        return jsonify({"erro": "Falha ao consultar leituras"}), 500


@app.get("/api/comandos")
def consultar_comandos():
    try:
        comandos = obter_comandos()
        return jsonify({"quantidade": len(comandos), "comandos": comandos})
    except Exception:
        app.logger.exception("Erro ao consultar comandos")
        return jsonify({"erro": "Falha ao consultar comandos"}), 500


@app.post("/api/comandos")
def cadastrar_comando():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify({"erro": "JSON invalido"}), 400

    comando = dados.get("comando")
    alvo = dados.get("temperaturaAlvo")

    if isinstance(comando, bool) or not isinstance(comando, int) or comando not in range(1, 8):
        return jsonify({"erro": "comando deve ser inteiro entre 1 e 7"}), 400

    if alvo is not None:
        if isinstance(alvo, bool) or not isinstance(alvo, (int, float)):
            return jsonify({"erro": "temperaturaAlvo deve ser numerica"}), 400
        if not 20 <= alvo <= 70:
            return jsonify({"erro": "temperaturaAlvo deve estar entre 20 e 70 C"}), 400

    if comando == 7 and alvo is None:
        return jsonify({"erro": "temperaturaAlvo obrigatoria para o comando 7"}), 400

    try:
        comando_id = salvar_comando(alvo, comando)
        return jsonify({
            "mensagem": "Comando cadastrado",
            "id": comando_id,
            "validadeSegundos": VALIDADE_COMANDO_S,
        }), 201
    except Exception:
        app.logger.exception("Erro ao cadastrar comando")
        return jsonify({"erro": "Falha ao cadastrar comando"}), 500


@app.get("/api/comandos/<int:comando_id>")
def consultar_comando(comando_id):
    try:
        comando = obter_comando(comando_id)
    except Exception:
        app.logger.exception("Erro ao consultar comando")
        return jsonify({"erro": "Falha ao consultar comando"}), 500
    if comando is None:
        return jsonify({"erro": "Comando inexistente"}), 404
    return jsonify({"comando": comando})


@app.post("/api/comandos/<int:comando_id>/confirmar")
def confirmar_comando(comando_id):
    try:
        if not marcar_comando_processado(comando_id):
            return jsonify({"erro": "Comando inexistente ou ja processado"}), 404
        return jsonify({"mensagem": "Comando avaliado", "id": comando_id}), 200
    except Exception:
        app.logger.exception("Erro ao confirmar comando")
        return jsonify({"erro": "Falha ao confirmar comando"}), 500


if __name__ == "__main__":
    inicializar_banco()
    app.run(host="0.0.0.0", port=5000, debug=False)
