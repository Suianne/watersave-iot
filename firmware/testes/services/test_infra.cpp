// Contrato com a camada de rede (textos dos alertas, sequencia de mudancas),
// registro de eventos e comportamento quando millis() da a volta.

#include <stdint.h>
#include <string.h>

#include "bench.h"

TEST(codigos_de_alerta_batem_com_o_contrato) {
    CHECK(strcmp(alertCode(Alert::NENHUM), "") == 0);
    CHECK(strcmp(alertCode(Alert::SENSOR_TEMP_DESCONECTADO), "SENSOR_TEMP_DESCONECTADO") == 0);
    CHECK(strcmp(alertCode(Alert::LEITURA_TEMP_INVALIDA), "LEITURA_TEMP_INVALIDA") == 0);
    CHECK(strcmp(alertCode(Alert::SEM_FLUXO_VALVULA_ABERTA), "SEM_FLUXO_VALVULA_ABERTA") == 0);
    CHECK(strcmp(alertCode(Alert::FLUXO_VALVULA_FECHADA), "FLUXO_VALVULA_FECHADA") == 0);
    CHECK(strcmp(alertCode(Alert::TEMPO_MAXIMO_EXCEDIDO), "TEMPO_MAXIMO_EXCEDIDO") == 0);
    CHECK(strcmp(alertCode(Alert::PARADA_EMERGENCIA), "PARADA_EMERGENCIA") == 0);
}

TEST(codigos_numericos_de_estado_e_comando_batem_com_o_contrato) {
    CHECK_EQ(SystemState::INICIANDO, 0);
    CHECK_EQ(SystemState::AGUARDANDO, 1);
    CHECK_EQ(SystemState::TRANSFERINDO, 2);
    CHECK_EQ(SystemState::MANUAL, 3);
    CHECK_EQ(SystemState::FALHA, 4);
    CHECK_EQ(Command::PARADA_EMERGENCIA, 1);
    CHECK_EQ(Command::RESETAR_FALHA, 2);
    CHECK_EQ(Command::MODO_MANUAL, 3);
    CHECK_EQ(Command::MODO_AUTOMATICO, 4);
    CHECK_EQ(Command::ABRIR_VALVULA, 5);
    CHECK_EQ(Command::FECHAR_VALVULA, 6);
}

TEST(changeSequence_so_sobe_quando_algo_importante_muda) {
    Bench b;
    b.settle();
    const uint32_t parado = b.svc.changeSequence();
    b.run(5.0);  // nada mudou
    CHECK_EQ(b.svc.changeSequence(), parado);

    CHECK(b.svc.setTargetTemperature(38.0f));
    CHECK_EQ(b.svc.changeSequence(), parado + 1);
    CHECK(b.svc.setTargetTemperature(38.0f));  // mesmo alvo
    CHECK_EQ(b.svc.changeSequence(), parado + 1);

    const uint32_t antes = b.svc.changeSequence();
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK(b.svc.changeSequence() > antes);
}

// --- registro de eventos ---

static bool temEvento(const EventLog& log, EventType type, uint8_t code) {
    for (size_t i = 0; i < log.size(); ++i) {
        if (log.at(i).type == type && log.at(i).code == code) return true;
    }
    return false;
}

TEST(registra_boot_alertas_estados_e_comandos) {
    Bench b;
    b.settle();
    CHECK_EQ(b.svc.log().at(0).type, EventType::BOOT);
    CHECK(b.cmd(Command::PARADA_EMERGENCIA));
    CHECK(!b.cmd(Command::ABRIR_VALVULA));

    const EventLog& log = b.svc.log();
    CHECK(temEvento(log, EventType::ALERT_RAISED, static_cast<uint8_t>(Alert::PARADA_EMERGENCIA)));
    CHECK(temEvento(log, EventType::STATE_CHANGE, static_cast<uint8_t>(SystemState::FALHA)));
    CHECK(temEvento(log, EventType::COMMAND_ACCEPTED, 1));
    CHECK(temEvento(log, EventType::COMMAND_REFUSED, 5));
}

TEST(registra_abertura_e_fechamento_da_valvula) {
    Bench b;
    b.settle();
    b.plant.tempC = 36.0f;
    CHECK(b.runUntilOpen());
    b.plant.tempC = 30.0f;
    b.run(1.5);
    CHECK(temEvento(b.svc.log(), EventType::VALVE_OPENED, 0));
    CHECK(temEvento(b.svc.log(), EventType::VALVE_CLOSED, 0));
}

TEST(registra_alvo_aceito_e_recusado) {
    Bench b;
    b.settle();
    CHECK(b.svc.setTargetTemperature(40.0f));
    CHECK(!b.svc.setTargetTemperature(99.0f));
    CHECK(temEvento(b.svc.log(), EventType::TARGET_CHANGED, 0));
    CHECK(temEvento(b.svc.log(), EventType::TARGET_REFUSED, 0));
}

TEST(registro_circular_descarta_os_mais_antigos_e_mantem_a_ordem) {
    Bench b;
    b.settle();
    CHECK(b.cmd(Command::MODO_MANUAL));
    for (int i = 0; i < 20; ++i) {
        CHECK(b.cmd(Command::ABRIR_VALVULA));
        b.run(0.25);
        CHECK(b.cmd(Command::FECHAR_VALVULA));
        b.run(0.25);
    }
    const EventLog& log = b.svc.log();
    CHECK_EQ(log.size(), EventLog::CAPACITY);
    CHECK(log.totalCount() > EventLog::CAPACITY);
    for (size_t i = 1; i < log.size(); ++i) {
        CHECK(log.at(i).timestampMs >= log.at(i - 1).timestampMs);
    }
    CHECK(log.at(0).type != EventType::BOOT);  // o boot ja foi sobrescrito
}

TEST(formata_eventos_em_texto_legivel) {
    Bench b;
    b.settle();
    CHECK(b.cmd(Command::PARADA_EMERGENCIA));
    char line[96];
    bool achou = false;
    for (size_t i = 0; i < b.svc.log().size(); ++i) {
        const Event& e = b.svc.log().at(i);
        const size_t n = EventLog::format(e, line, sizeof(line));
        CHECK(n > 0 && n < sizeof(line));
        if (e.type == EventType::ALERT_RAISED) {
            achou = strstr(line, "ALERTA PARADA_EMERGENCIA") != nullptr;
        }
    }
    CHECK(achou);
}

TEST(formatacao_respeita_o_tamanho_do_buffer) {
    Event e = {123456u, EventType::BOOT, 0, 0, 35.0f};
    char tiny[8];
    const size_t n = EventLog::format(e, tiny, sizeof(tiny));
    CHECK(n < sizeof(tiny));
    CHECK_EQ(tiny[sizeof(tiny) - 1], 0);
}

// --- millis() dando a volta (a cada ~49,7 dias) ---

TEST(tempo_maximo_dispara_no_passo_exato_quando_millis_da_a_volta) {
    Bench b(nullptr, 0xFFFFFFFFu - 5000u);
    b.settle();  // termina antes da virada
    CHECK(b.nowMs() > 0xFFFFFFFFu - 5000u);
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK(b.cmd(Command::ABRIR_VALVULA));
    b.run(120.0);  // atravessa a virada do contador
    CHECK(b.nowMs() < 200000u);  // confirma que virou
    CHECK(b.open());             // 120,000 s: ainda nao passou do limite
    b.run(0.25);
    CHECK_EQ(b.alert(), Alert::TEMPO_MAXIMO_EXCEDIDO);
}

TEST(falha_de_sensor_e_detectada_quando_millis_da_a_volta_entre_as_amostras) {
    Bench b(nullptr, 0xFFFFFFFFu - 4000u);
    b.settle();
    b.plant.disconnected = true;
    b.run(3.0);
    CHECK_EQ(b.state(), SystemState::FALHA);
    CHECK_EQ(b.alert(), Alert::SENSOR_TEMP_DESCONECTADO);
}

TEST(volume_e_integrado_corretamente_na_virada_do_contador) {
    Bench b(nullptr, 0xFFFFFFFFu - 8000u);
    b.settle();  // termina antes da virada, que cai no meio da integracao
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK(b.cmd(Command::ABRIR_VALVULA));
    b.run(12.0);  // 5 L/min por 12 s = 1 L
    CHECK(b.nowMs() < 20000u);
    CHECK_NEAR(b.tel().volumeL, 1.0, 0.005);
}
