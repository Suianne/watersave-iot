
from flask import Flask, request, jsonify
from flask_cors import CORS

from database import (
    inicializar_banco,
    salvar_leitura,
    obter_ultima_leitura,
    obter_comandos,
    salvar_comando,
    marcar_comando_processado
)

app = Flask(__name__)
CORS(app)

# Inicializa o banco ao iniciar a API
inicializar_banco()


@app.route("/", methods=["GET"])
def inicio():
    return jsonify({
        "projeto": "WaterSave",
        "api": "REST",
        "status": "online"
    }), 200


# ESP32 envia as leituras
@app.route("/api/leituras", methods=["POST"])
def receber_leituras():
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"erro": "JSON inválido"}), 400

    campos = [
        "temperaturaAtual",
        "temperaturaAlvo",
        "histerese",
        "vazao",
        "volumeTransferido",
        "valvulaAberta",
        "estadoSistema",
        "alerta"
    ]

    if not all(campo in dados for campo in campos):
        return jsonify({
            "erro": "Campos obrigatórios ausentes",
            "campos_esperados": campos
        }), 400

    # Validação dos campos numéricos
    campos_numericos = campos[:5]

    for campo in campos_numericos:
        valor = dados[campo]

        if isinstance(valor, bool) or not isinstance(valor, (int, float)):
            return jsonify({
                "erro": f"Valor inválido: {campo}"
            }), 400

    # estadoSistema deve ser inteiro
    estado = dados["estadoSistema"]

    if isinstance(estado, bool) or not isinstance(estado, int):
        return jsonify({
            "erro": "estadoSistema deve ser inteiro"
        }), 400

    # Validação do intervalo dos estados
    if not 0 <= estado <= 4:
        return jsonify({
            "erro": "estadoSistema fora do intervalo esperado (0 a 4)"
        }), 400

    # Validação da válvula
    if not isinstance(dados["valvulaAberta"], bool):
        return jsonify({
            "erro": "valvulaAberta deve ser booleano"
        }), 400

    # Validação do alerta
    if not isinstance(dados["alerta"], str):
        return jsonify({
            "erro": "alerta deve ser texto"
        }), 400

    try:
        salvar_leitura(dados)

        return jsonify({
            "mensagem": "Leitura armazenada com sucesso"
        }), 201

    except Exception:
        app.logger.exception("Erro ao salvar leitura")

        return jsonify({
            "erro": "Falha ao armazenar leitura"
        }), 500


# Dashboard consulta a ultima telemetria armazenada
@app.route("/api/leituras/ultima", methods=["GET"])
def consultar_ultima_leitura():
    try:
        leitura = obter_ultima_leitura()
        return jsonify({"leitura": leitura}), 200
    except Exception:
        app.logger.exception("Erro ao consultar ultima leitura")
        return jsonify({"erro": "Falha ao consultar ultima leitura"}), 500


@app.route("/api/comandos", methods=["GET"])
def consultar_comandos():
    try:
        comandos = obter_comandos()

        return jsonify({
            "quantidade": len(comandos),
            "comandos": comandos
        }), 200

    except Exception:
        app.logger.exception("Erro ao consultar comandos")

        return jsonify({
            "erro": "Falha ao consultar comandos"
        }), 500


# Dashboard cadastra um novo comando
@app.route("/api/comandos", methods=["POST"])
def enviar_comando():
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"erro": "JSON inválido"}), 400

    comando = dados.get("comando")
    temperatura_alvo = dados.get("temperaturaAlvo")

    if isinstance(comando, bool) or not isinstance(comando, int):
        return jsonify({
            "erro": "comando deve ser um número inteiro"
        }), 400

    if comando not in [1, 2, 3, 4, 5, 6, 7]:
        return jsonify({
            "erro": "Código de comando inválido"
        }), 400

    if temperatura_alvo is not None:
        if (
            isinstance(temperatura_alvo, bool)
            or not isinstance(temperatura_alvo, (int, float))
        ):
            return jsonify({
                "erro": "temperaturaAlvo inválida"
            }), 400
        if not 20 <= temperatura_alvo <= 70:
            return jsonify({
                "erro": "temperaturaAlvo deve estar entre 20 e 70 °C"
            }), 400

    # Codigo 7 e reservado para atualizar somente a temperatura-alvo.
    if comando == 7 and temperatura_alvo is None:
        return jsonify({
            "erro": "temperaturaAlvo obrigatoria para o comando 7"
        }), 400

    try:
        comando_id = salvar_comando(temperatura_alvo, comando)

        return jsonify({
            "mensagem": "Comando cadastrado com sucesso",
            "id": comando_id
        }), 201

    except Exception:
        app.logger.exception("Erro ao cadastrar comando")

        return jsonify({
            "erro": "Falha ao cadastrar comando"
        }), 500


# ESP32 confirma o recebimento do comando
@app.route("/api/comandos/<int:comando_id>/confirmar", methods=["POST"])
def confirmar_comando(comando_id):
    try:
        sucesso = marcar_comando_processado(comando_id)

        if not sucesso:
            return jsonify({
                "erro": "Comando inexistente ou já processado"
            }), 404

        return jsonify({
            "mensagem": "Comando confirmado",
            "id": comando_id
        }), 200

    except Exception:
        app.logger.exception("Erro ao confirmar comando")

        return jsonify({
            "erro": "Falha ao confirmar comando"
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
