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


def envelhecer(tabela, registro_id, segundos):
    """Simula um registro criado ha `segundos` no relogio do banco."""
    with database.conectar() as conexao:
        conexao.execute(
            f"UPDATE {tabela} SET data_hora = datetime('now', ?) WHERE id = ?",
            (f"-{segundos} seconds", registro_id),
        )


def test_cadastro_informa_a_validade_do_comando(client):
    cadastro = client.post("/api/comandos", json={"comando": 3}).get_json()
    assert cadastro["validadeSegundos"] == database.VALIDADE_COMANDO_S


def test_comando_nao_buscado_dentro_da_validade_expira(client):
    comando_id = client.post("/api/comandos", json={"comando": 5}).get_json()["id"]
    envelhecer("comandos", comando_id, database.VALIDADE_COMANDO_S + 1)

    # o ESP32 nao recebe mais o comando, mas ele so aparece como expirado depois da folga
    assert client.get("/api/comandos").get_json()["comandos"] == []
    situacao = client.get(f"/api/comandos/{comando_id}").get_json()["comando"]["situacao"]
    assert situacao == "pendente"

    envelhecer("comandos", comando_id, database.VALIDADE_COMANDO_S + database.FOLGA_CONFIRMACAO_S + 1)
    situacao = client.get(f"/api/comandos/{comando_id}").get_json()["comando"]["situacao"]
    assert situacao == "expirado"


def test_comando_expirado_nao_bloqueia_os_seguintes(client):
    antigo = client.post("/api/comandos", json={"comando": 5}).get_json()["id"]
    envelhecer("comandos", antigo, 3600)
    novo = client.post("/api/comandos", json={"comando": 1}).get_json()["id"]

    pendentes = client.get("/api/comandos").get_json()["comandos"]
    assert [comando["id"] for comando in pendentes] == [novo]


def test_comando_buscado_no_fim_do_prazo_ainda_pode_ser_confirmado(client):
    comando_id = client.post("/api/comandos", json={"comando": 3}).get_json()["id"]
    envelhecer("comandos", comando_id, database.VALIDADE_COMANDO_S + 2)

    assert client.post(f"/api/comandos/{comando_id}/confirmar").status_code == 200
    situacao = client.get(f"/api/comandos/{comando_id}").get_json()["comando"]["situacao"]
    assert situacao == "avaliado"


def test_consulta_a_situacao_de_um_comando(client):
    comando_id = client.post(
        "/api/comandos",
        json={"comando": 7, "temperaturaAlvo": 38.5},
    ).get_json()["id"]

    comando = client.get(f"/api/comandos/{comando_id}").get_json()["comando"]
    assert comando["situacao"] == "pendente"
    assert comando["comando"] == 7
    assert comando["temperaturaAlvo"] == 38.5
    assert isinstance(comando["timestamp"], int)

    client.post(f"/api/comandos/{comando_id}/confirmar")
    assert client.get(f"/api/comandos/{comando_id}").get_json()["comando"]["situacao"] == "avaliado"
    assert client.get("/api/comandos/999").status_code == 404


def test_historico_de_leituras_em_ordem_cronologica(client):
    for temperatura in (30.0, 31.0, 32.0):
        client.post("/api/leituras", json=leitura_valida(temperaturaAtual=temperatura))
    envelhecer("leituras", 1, 7200)
    agora = client.get("/api/leituras/ultima").get_json()["leitura"]["timestamp"]

    resposta = client.get(f"/api/leituras?desde={agora - 60}").get_json()
    assert resposta["quantidade"] == 2
    assert [leitura["temperaturaAtual"] for leitura in resposta["leituras"]] == [31.0, 32.0]
    assert resposta["leituras"][0]["valvulaAberta"] is False
    assert isinstance(resposta["leituras"][0]["timestamp"], int)

    # com limite, ficam as leituras mais recentes
    resposta = client.get("/api/leituras?desde=0&limite=2").get_json()
    assert [leitura["temperaturaAtual"] for leitura in resposta["leituras"]] == [31.0, 32.0]


@pytest.mark.parametrize("parametros", ["", "?desde=abc", "?desde=-1", "?desde=0&limite=0", "?desde=0&limite=6001"])
def test_rejeita_consulta_de_historico_invalida(client, parametros):
    assert client.get(f"/api/leituras{parametros}").status_code == 400
