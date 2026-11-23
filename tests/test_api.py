import sys
from pathlib import Path

import pytest

API_PATH = Path(__file__).resolve().parents[1] / "api"
sys.path.insert(0, str(API_PATH))

import database
from app import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DATABASE_PATH", tmp_path / "watersave_test.db")
    database.inicializar_banco()
    app.config.update(TESTING=True)
    with app.test_client() as test_client:
        yield test_client


def leitura_valida(**alteracoes):
    dados = {
        "temperaturaAtual": 32.5,
        "temperaturaAlvo": 35.0,
        "histerese": 2.0,
        "vazao": 4.5,
        "volumeTransferido": 1.2,
        "valvulaAberta": False,
        "estadoSistema": 1,
        "alerta": "",
    }
    dados.update(alteracoes)
    return dados


def test_api_informa_que_esta_online(client):
    resposta = client.get("/")
    assert resposta.status_code == 200
    assert resposta.get_json()["status"] == "online"


def test_recebe_e_consulta_ultima_leitura(client):
    assert client.post("/api/leituras", json=leitura_valida()).status_code == 201
    ultima = client.get("/api/leituras/ultima").get_json()["leitura"]
    assert ultima["temperaturaAtual"] == 32.5
    assert ultima["valvulaAberta"] is False
    assert isinstance(ultima["timestamp"], int)


def test_rejeita_leitura_incompleta(client):
    dados = leitura_valida()
    dados.pop("alerta")
    assert client.post("/api/leituras", json=dados).status_code == 400


@pytest.mark.parametrize("estado", [-1, 5, True, 1.5])
def test_rejeita_estado_invalido(client, estado):
    resposta = client.post(
        "/api/leituras",
        json=leitura_valida(estadoSistema=estado),
    )
    assert resposta.status_code == 400


def test_cadastra_consulta_e_confirma_comando(client):
    cadastro = client.post(
        "/api/comandos",
        json={"comando": 7, "temperaturaAlvo": 38.5},
    )
    assert cadastro.status_code == 201
    comando_id = cadastro.get_json()["id"]

    pendentes = client.get("/api/comandos").get_json()["comandos"]
    assert len(pendentes) == 1
    assert pendentes[0]["id"] == comando_id
    assert pendentes[0]["temperaturaAlvo"] == 38.5

    assert client.post(f"/api/comandos/{comando_id}/confirmar").status_code == 200
    assert client.get("/api/comandos").get_json()["comandos"] == []


@pytest.mark.parametrize("alvo", [19, 71, True, "35"])
def test_rejeita_temperatura_alvo_invalida(client, alvo):
    resposta = client.post(
        "/api/comandos",
        json={"comando": 7, "temperaturaAlvo": alvo},
    )
    assert resposta.status_code == 400


def test_comando_7_exige_temperatura_alvo(client):
    assert client.post("/api/comandos", json={"comando": 7}).status_code == 400


def test_rejeita_codigo_de_comando_invalido(client):
    assert client.post("/api/comandos", json={"comando": 8}).status_code == 400


def test_nao_confirma_comando_duas_vezes(client):
    cadastro = client.post("/api/comandos", json={"comando": 3})
    comando_id = cadastro.get_json()["id"]
    assert client.post(f"/api/comandos/{comando_id}/confirmar").status_code == 200
    assert client.post(f"/api/comandos/{comando_id}/confirmar").status_code == 404
