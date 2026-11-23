from flask import Flask, jsonify, request
from flask_cors import CORS

from database import (
    inicializar_banco,
    salvar_leitura,
    obter_ultima_leitura,
    obter_comandos,
    salvar_comando,
    marcar_comando_processado,
)

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
        return jsonify({"mensagem": "Comando cadastrado", "id": comando_id}), 201
    except Exception:
        app.logger.exception("Erro ao cadastrar comando")
        return jsonify({"erro": "Falha ao cadastrar comando"}), 500


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
