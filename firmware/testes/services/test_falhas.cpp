// Situacoes de falha: sensor de temperatura, fluxo, tempo maximo, parada de
// emergencia, reinicio apos falha e operacao manual com defeito.

#include <math.h>

#include "bench.h"

// --- sensor de temperatura ---

TEST(sensor_desconectado_fecha_a_valvula_e_entra_em_falha) {
    Bench b;
    b.settle();
    b.plant.tempC = 36.0f;
    CHECK(b.runUntilOpen());
    b.plant.disconnected = true;
    b.run(2.5);
    const Telemetry t = b.tel();
    CHECK_EQ(t.state, SystemState::FALHA);
    CHECK_EQ(t.alert, Alert::SENSOR_TEMP_DESCONECTADO);
    CHECK(!t.valveOpen);
    CHECK(!t.temperatureValid);
    CHECK_NEAR(t.temperatureC, -127.0, 1e-6);
}

TEST(sensor_desconectado_desde_o_boot_vira_falha) {
    Bench b;
    b.plant.disconnected = true;
    b.run(3.0);
    CHECK_EQ(b.state(), SystemState::FALHA);
    CHECK_EQ(b.alert(), Alert::SENSOR_TEMP_DESCONECTADO);
    CHECK(!b.open());
}

TEST(leitura_fora_da_faixa_vira_falha_de_leitura_invalida) {
    Bench b;
    b.settle();
    b.plant.tempC = 120.0f;
    b.run(3.0);
    CHECK_EQ(b.state(), SystemState::FALHA);
    CHECK_EQ(b.alert(), Alert::LEITURA_TEMP_INVALIDA);
    CHECK(!b.open());
}

TEST(leitura_85_do_reset_do_ds18b20_nao_abre_a_valvula) {
    Bench b;
    b.settle();
    b.injectNextSample(85.0f);
    b.nextSample();
    CHECK(!b.open());
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
    b.plant.tempC = 85.0f;  // persistente: falha de leitura
    b.run(3.0);
    CHECK(!b.open());
    CHECK_EQ(b.alert(), Alert::LEITURA_TEMP_INVALIDA);
}

TEST(uma_unica_amostra_invalida_nao_derruba_o_sistema) {
    Bench b;
    b.settle();
    b.injectNextSample(-127.0f);
    b.nextSample();
    b.run(3.0);
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
    CHECK_EQ(b.alert(), Alert::NENHUM);
}

// Validador isolado: com jitter, o servico pode rodar entre 1 s apos a amostra
// ruim e a chegada da proxima. Uma unica amostra invalida nunca pode virar falha.
TEST(validador_exige_duas_amostras_invalidas_e_1_segundo) {
    TemperatureValidator v;
    v.onSample(25.0f, 0);
    v.onSample(-127.0f, 1000);
    CHECK(!v.faultPersisted(1000));
    CHECK(!v.faultPersisted(2500));  // 1 amostra so, mesmo com muito tempo passado
    v.onSample(-127.0f, 1999);
    CHECK(!v.faultPersisted(1999));  // 2 amostras, mas so 999 ms
    CHECK(v.faultPersisted(2000));   // 2 amostras e 1000 ms
    CHECK_EQ(v.faultAlert(), Alert::SENSOR_TEMP_DESCONECTADO);
}

TEST(validador_zera_a_contagem_com_uma_amostra_valida) {
    TemperatureValidator v;
    v.onSample(-127.0f, 0);
    v.onSample(25.0f, 1000);
    v.onSample(-127.0f, 2000);
    CHECK(!v.faultPersisted(3500));
    CHECK(!v.isStable());
}

TEST(validador_classifica_as_leituras) {
    CHECK_EQ(TemperatureValidator::classify(25.0f), TemperatureValidator::Kind::VALID);
    CHECK_EQ(TemperatureValidator::classify(-10.0f), TemperatureValidator::Kind::VALID);
    CHECK_EQ(TemperatureValidator::classify(100.0f), TemperatureValidator::Kind::VALID);
    CHECK_EQ(TemperatureValidator::classify(-127.0f), TemperatureValidator::Kind::DISCONNECTED);
    CHECK_EQ(TemperatureValidator::classify(-10.1f), TemperatureValidator::Kind::INVALID);
    CHECK_EQ(TemperatureValidator::classify(100.1f), TemperatureValidator::Kind::INVALID);
    CHECK_EQ(TemperatureValidator::classify(85.0f), TemperatureValidator::Kind::INVALID);
    CHECK_EQ(TemperatureValidator::classify(NAN), TemperatureValidator::Kind::INVALID);
}

TEST(amostra_invalida_com_a_valvula_aberta_nao_fecha_nem_falha) {
    Bench b;
    b.settle();
    b.plant.tempC = 36.0f;
    CHECK(b.runUntilOpen());
    b.injectNextSample(-127.0f);
    b.nextSample();
    CHECK(b.open());
    b.nextSample();  // volta a ler 36
    CHECK(b.open());
    CHECK_EQ(b.state(), SystemState::TRANSFERINDO);
}

// --- fluxo ---

TEST(valvula_aberta_sem_fluxo_vira_falha_depois_da_tolerancia) {
    Bench b;
    b.settle();
    b.plant.clogged = true;
    b.plant.tempC = 36.0f;
    CHECK(b.runUntilOpen());
    b.run(4.0);
    CHECK_EQ(b.state(), SystemState::TRANSFERINDO);  // ainda dentro dos 5 s
    b.run(2.0);
    CHECK_EQ(b.alert(), Alert::SEM_FLUXO_VALVULA_ABERTA);
    CHECK_EQ(b.state(), SystemState::FALHA);
    CHECK(!b.open());
}

TEST(fluxo_com_a_valvula_fechada_vira_falha) {
    Bench b;
    b.settle();
    b.plant.leak = true;
    b.run(4.0);
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
    b.run(2.0);
    CHECK_EQ(b.alert(), Alert::FLUXO_VALVULA_FECHADA);
    CHECK_EQ(b.state(), SystemState::FALHA);
}

TEST(vazamento_continua_sinalizado_em_falha_sem_mudar_o_alerta) {
    Bench b;
    b.settle();
    b.plant.leak = true;
    b.run(7.0);
    const uint32_t seq = b.svc.changeSequence();
    b.run(10.0);
    CHECK_EQ(b.alert(), Alert::FLUXO_VALVULA_FECHADA);
    CHECK_EQ(b.svc.changeSequence(), seq);
}

// --- tempo maximo ---

TEST(fecha_a_valvula_ao_exceder_o_tempo_maximo_de_abertura) {
    Bench b;
    b.settle();
    b.plant.tempC = 40.0f;  // continua quente: o controle nao fecharia sozinho
    CHECK(b.runUntilOpen());
    b.run(118.0);
    CHECK(b.open());
    b.run(3.0);
    CHECK_EQ(b.alert(), Alert::TEMPO_MAXIMO_EXCEDIDO);
    CHECK(!b.open());
    CHECK_EQ(b.state(), SystemState::FALHA);
}

TEST(tempo_maximo_tambem_vale_no_modo_manual) {
    Bench b;
    b.settle();
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK(b.cmd(Command::ABRIR_VALVULA));
    b.run(121.0);
    CHECK_EQ(b.alert(), Alert::TEMPO_MAXIMO_EXCEDIDO);
    CHECK(!b.open());
}

TEST(ausencia_de_fluxo_tambem_vale_no_modo_manual) {
    Bench b;
    b.settle();
    b.plant.clogged = true;
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK(b.cmd(Command::ABRIR_VALVULA));
    b.run(6.0);
    CHECK_EQ(b.alert(), Alert::SEM_FLUXO_VALVULA_ABERTA);
    CHECK(!b.open());
    CHECK_EQ(b.state(), SystemState::FALHA);
}

// --- parada de emergencia ---

TEST(parada_de_emergencia_fecha_a_valvula_em_qualquer_estado) {
    {
        Bench b;  // INICIANDO
        CHECK(b.cmd(Command::PARADA_EMERGENCIA));
        CHECK_EQ(b.state(), SystemState::FALHA);
        CHECK_EQ(b.alert(), Alert::PARADA_EMERGENCIA);
    }
    {
        Bench b;  // TRANSFERINDO
        b.settle();
        b.plant.tempC = 36.0f;
        CHECK(b.runUntilOpen());
        CHECK(b.cmd(Command::PARADA_EMERGENCIA));
        CHECK(!b.open());
        CHECK_EQ(b.alert(), Alert::PARADA_EMERGENCIA);
    }
    {
        Bench b;  // MANUAL com a valvula aberta
        b.settle();
        CHECK(b.cmd(Command::MODO_MANUAL));
        CHECK(b.cmd(Command::ABRIR_VALVULA));
        CHECK(b.cmd(Command::PARADA_EMERGENCIA));
        CHECK(!b.open());
        CHECK_EQ(b.state(), SystemState::FALHA);
    }
}

TEST(em_falha_a_valvula_nao_reabre_sozinha_mesmo_com_agua_quente) {
    Bench b;
    b.settle();
    b.plant.tempC = 36.0f;
    CHECK(b.runUntilOpen());
    CHECK(b.cmd(Command::PARADA_EMERGENCIA));
    b.run(10.0);
    CHECK(!b.open());
    CHECK_EQ(b.state(), SystemState::FALHA);
}

// --- reinicio apos falha ---

TEST(resetar_a_falha_volta_ao_automatico_e_reabre_se_estiver_quente) {
    Bench b;
    b.settle();
    b.plant.tempC = 36.0f;
    CHECK(b.runUntilOpen());
    CHECK(b.cmd(Command::PARADA_EMERGENCIA));
    CHECK(b.cmd(Command::RESETAR_FALHA));
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
    CHECK_EQ(b.alert(), Alert::NENHUM);
    b.run(0.5);
    CHECK_EQ(b.state(), SystemState::TRANSFERINDO);
    CHECK(b.open());
}

TEST(resetar_a_falha_e_recusado_com_o_sensor_ainda_desconectado) {
    Bench b;
    b.settle();
    b.plant.disconnected = true;
    b.run(3.0);
    CHECK_EQ(b.state(), SystemState::FALHA);
    CHECK(!b.cmd(Command::RESETAR_FALHA));
    CHECK_EQ(b.state(), SystemState::FALHA);
}

TEST(resetar_a_falha_de_sensor_funciona_depois_que_ele_volta) {
    Bench b;
    b.settle();
    b.plant.disconnected = true;
    b.run(3.0);
    b.plant.disconnected = false;
    b.run(1.25);  // uma amostra valida
    CHECK(b.cmd(Command::RESETAR_FALHA));
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
}

TEST(vazamento_resolvido_pode_ser_resetado_sem_falhar_de_novo) {
    Bench b;
    b.settle();
    b.plant.leak = true;
    b.run(7.0);
    CHECK_EQ(b.state(), SystemState::FALHA);
    b.plant.leak = false;
    b.run(1.0);
    CHECK(b.cmd(Command::RESETAR_FALHA));
    b.run(10.0);
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
    CHECK_EQ(b.alert(), Alert::NENHUM);
}

// --- modo manual com defeito ---

TEST(com_o_sensor_em_falha_o_manual_ainda_abre_a_valvula_e_sinaliza) {
    Bench b;
    b.settle();
    b.plant.disconnected = true;
    b.run(3.0);
    CHECK_EQ(b.state(), SystemState::FALHA);
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK(b.cmd(Command::ABRIR_VALVULA));
    b.run(3.0);
    CHECK(b.open());
    CHECK_EQ(b.state(), SystemState::MANUAL);
    CHECK_EQ(b.alert(), Alert::SENSOR_TEMP_DESCONECTADO);
    CHECK(!b.cmd(Command::MODO_AUTOMATICO));  // automatico depende do sensor
}

TEST(no_manual_o_alerta_de_sensor_some_quando_o_sensor_volta) {
    Bench b;
    b.settle();
    b.plant.disconnected = true;
    b.run(3.0);
    CHECK(b.cmd(Command::MODO_MANUAL));
    b.plant.disconnected = false;
    b.run(2.5);
    CHECK_EQ(b.alert(), Alert::NENHUM);
    CHECK(b.cmd(Command::MODO_AUTOMATICO));
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
}

TEST(entrar_no_manual_limpa_alerta_que_nao_e_de_sensor) {
    Bench b;
    b.settle();
    CHECK(b.cmd(Command::PARADA_EMERGENCIA));
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK_EQ(b.alert(), Alert::NENHUM);
    CHECK_EQ(b.state(), SystemState::MANUAL);
}
