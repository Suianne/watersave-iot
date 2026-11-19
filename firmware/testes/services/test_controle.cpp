// Controle automatico: inicializacao, histerese, volume, alvo configuravel,
// reinicializacao e intertravamento dos comandos. Segue os casos do simulador
// do dashboard (application/testes/automatizados/simulador.test.ts).

#include <math.h>

#include "bench.h"

TEST(inicia_com_valvula_fechada_e_vai_para_aguardando_apos_leitura_valida) {
    Bench b;
    CHECK_EQ(b.state(), SystemState::INICIANDO);
    CHECK(!b.open());
    CHECK(!b.tel().temperatureValid);
    b.run(1.0);
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
    CHECK(!b.open());
}

TEST(telemetria_inicial_segue_o_contrato) {
    Bench b;
    const Telemetry t = b.tel();
    CHECK_NEAR(t.targetC, 35.0, 1e-6);
    CHECK_NEAR(t.hysteresisC, 2.0, 1e-6);
    CHECK_NEAR(t.volumeL, 0.0, 1e-9);
    CHECK_NEAR(t.flowLpm, 0.0, 1e-9);
    CHECK(isnan(t.temperatureC));
    CHECK_EQ(t.alert, Alert::NENHUM);
}

TEST(abre_quando_a_agua_atinge_o_alvo) {
    Bench b;
    b.settle();
    b.plant.tempC = 35.2f;
    CHECK(b.runUntilOpen());
    CHECK_EQ(b.state(), SystemState::TRANSFERINDO);
}

TEST(abre_exatamente_na_temperatura_alvo) {
    Bench b;
    b.settle();
    b.plant.tempC = 35.0f;
    CHECK(b.runUntilOpen());
}

TEST(nao_abre_logo_abaixo_do_alvo) {
    Bench b;
    b.settle();
    b.plant.tempC = 34.8f;
    b.run(3.0);
    CHECK(!b.open());
}

TEST(nao_abre_com_uma_unica_leitura_valida_apos_leitura_invalida) {
    Bench b;
    b.settle();
    b.injectNextSample(150.0f);  // fora da faixa
    b.nextSample();
    b.plant.tempC = 36.0f;
    b.nextSample();  // 1a leitura valida depois da invalida
    CHECK(!b.open());
    b.nextSample();  // 2a leitura valida
    CHECK(b.open());
}

TEST(nao_fecha_enquanto_a_temperatura_esta_dentro_da_histerese) {
    Bench b;
    b.settle();
    b.plant.tempC = 36.0f;
    CHECK(b.runUntilOpen());
    b.plant.tempC = 33.5f;  // acima de 35 - 2
    b.run(3.0);
    CHECK(b.open());
}

TEST(fecha_quando_a_temperatura_cai_ate_alvo_menos_histerese) {
    Bench b;
    b.settle();
    b.plant.tempC = 36.0f;
    CHECK(b.runUntilOpen());
    b.plant.tempC = 32.5f;
    b.run(1.25);
    CHECK(!b.open());
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
}

TEST(fecha_exatamente_em_alvo_menos_histerese) {
    Bench b;
    b.settle();
    b.plant.tempC = 36.0f;
    CHECK(b.runUntilOpen());
    b.plant.tempC = 33.0f;
    b.run(1.25);
    CHECK(!b.open());
}

TEST(troca_de_alvo_com_a_valvula_aberta_reavalia_a_histerese) {
    Bench b;
    b.settle();
    b.plant.tempC = 36.0f;
    CHECK(b.runUntilOpen());
    CHECK(b.svc.setTargetTemperature(40.0f));  // fecha em <= 38
    b.run(0.5);
    CHECK(!b.open());
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
}

TEST(calcula_o_volume_a_partir_da_vazao) {
    Bench b;
    b.settle();
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK(b.cmd(Command::ABRIR_VALVULA));
    b.run(60.0);  // 5 L/min por 60 s
    CHECK_NEAR(b.tel().volumeL, 5.0, 0.05);
    CHECK_NEAR(b.tel().flowLpm, 5.0, 1e-6);
}

TEST(vazao_invalida_e_tratada_como_zero) {
    WaterSaveService svc;
    svc.begin(0);
    Inputs in;
    in.newTemperatureSample = false;
    in.temperatureRawC = 0.0f;
    in.flowLpm = NAN;
    svc.update(in, 250);
    in.flowLpm = -3.0f;
    svc.update(in, 500);
    CHECK_NEAR(svc.telemetry().flowLpm, 0.0, 1e-9);
    CHECK_NEAR(svc.telemetry().volumeL, 0.0, 1e-9);
}

// --- temperatura-alvo ---

TEST(alvo_aceita_a_faixa_de_20_a_70_e_arredonda_para_decimos) {
    FakeStore store;
    Bench b(&store);
    b.settle();
    CHECK(b.svc.setTargetTemperature(20.0f));
    CHECK(b.svc.setTargetTemperature(70.0f));
    CHECK(b.svc.setTargetTemperature(38.46f));
    CHECK_NEAR(b.tel().targetC, 38.5, 1e-4);
}

TEST(alvo_fora_da_faixa_ou_invalido_e_recusado_e_nada_muda) {
    FakeStore store;
    Bench b(&store);
    b.settle();
    const int savesBefore = store.saves;
    CHECK(!b.svc.setTargetTemperature(19.9f));
    CHECK(!b.svc.setTargetTemperature(70.1f));
    CHECK(!b.svc.setTargetTemperature(90.0f));
    CHECK(!b.svc.setTargetTemperature(NAN));
    CHECK(!b.svc.setTargetTemperature(INFINITY));
    CHECK_NEAR(b.tel().targetC, 35.0, 1e-6);
    CHECK_EQ(store.saves, savesBefore);
}

TEST(alvo_e_gravado_apenas_quando_muda) {
    FakeStore store;
    Bench b(&store);
    b.settle();
    CHECK(b.svc.setTargetTemperature(40.0f));
    CHECK_EQ(store.saves, 1);
    CHECK(b.svc.setTargetTemperature(40.0f));  // mesmo valor: aceito, sem nova gravacao
    CHECK_EQ(store.saves, 1);
    CHECK_NEAR(store.value, 40.0, 1e-6);
}

// --- reinicializacao ---

TEST(apos_reiniciar_volta_fechada_zera_volume_e_recupera_o_alvo) {
    FakeStore store;
    Bench b(&store);
    b.settle();
    CHECK(b.svc.setTargetTemperature(40.0f));
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK(b.cmd(Command::ABRIR_VALVULA));
    b.run(10.0);
    CHECK(b.tel().volumeL > 0.5f);

    b.reboot();
    const Telemetry t = b.tel();
    CHECK_EQ(t.state, SystemState::INICIANDO);
    CHECK(!t.valveOpen);
    CHECK_NEAR(t.volumeL, 0.0, 1e-9);
    CHECK_NEAR(t.targetC, 40.0, 1e-6);
    CHECK_EQ(t.alert, Alert::NENHUM);
}

TEST(apos_reiniciar_uma_falha_nao_persiste) {
    FakeStore store;
    Bench b(&store);
    b.settle();
    CHECK(b.cmd(Command::PARADA_EMERGENCIA));
    b.reboot();
    CHECK_EQ(b.state(), SystemState::INICIANDO);
    b.run(2.0);
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
}

TEST(alvo_guardado_fora_da_faixa_e_ignorado) {
    FakeStore store;
    store.has = true;
    store.value = 5.0f;
    Bench b(&store);
    CHECK_NEAR(b.tel().targetC, 35.0, 1e-6);
}

TEST(sem_alvo_guardado_vale_o_padrao) {
    FakeStore store;
    Bench b(&store);
    CHECK_NEAR(b.tel().targetC, 35.0, 1e-6);
}

// --- intertravamento dos comandos (docs/contrato-de-dados.md) ---

TEST(comandos_de_valvula_sao_recusados_fora_do_modo_manual) {
    Bench b;
    b.settle();
    CHECK(!b.cmd(Command::ABRIR_VALVULA));
    CHECK(!b.cmd(Command::FECHAR_VALVULA));
    CHECK(!b.cmd(Command::MODO_AUTOMATICO));
    CHECK(!b.cmd(Command::RESETAR_FALHA));
    CHECK(!b.open());
}

TEST(comandos_durante_a_inicializacao) {
    Bench b;
    CHECK(!b.cmd(Command::MODO_MANUAL));
    CHECK(!b.cmd(Command::ABRIR_VALVULA));
    CHECK(!b.cmd(Command::RESETAR_FALHA));
    CHECK(!b.cmd(Command::MODO_AUTOMATICO));
    CHECK_EQ(b.state(), SystemState::INICIANDO);
}

TEST(modo_manual_abre_e_fecha_a_valvula_so_por_comando) {
    Bench b;
    b.settle();
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK_EQ(b.state(), SystemState::MANUAL);
    CHECK(!b.cmd(Command::MODO_MANUAL));   // ja esta no manual
    CHECK(!b.cmd(Command::FECHAR_VALVULA));  // ja esta fechada
    CHECK(b.cmd(Command::ABRIR_VALVULA));
    CHECK(b.open());
    CHECK(!b.cmd(Command::ABRIR_VALVULA));   // ja esta aberta
    CHECK(b.cmd(Command::FECHAR_VALVULA));
    CHECK(!b.open());
}

TEST(entrar_no_manual_fecha_a_valvula_aberta) {
    Bench b;
    b.settle();
    b.plant.tempC = 36.0f;
    CHECK(b.runUntilOpen());
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK(!b.open());
    CHECK_EQ(b.state(), SystemState::MANUAL);
}

TEST(no_manual_a_temperatura_nao_abre_a_valvula_sozinha) {
    Bench b;
    b.settle();
    CHECK(b.cmd(Command::MODO_MANUAL));
    b.plant.tempC = 40.0f;
    b.run(4.0);
    CHECK(!b.open());
}

TEST(modo_automatico_fecha_a_valvula_e_volta_para_aguardando) {
    Bench b;
    b.settle();
    CHECK(b.cmd(Command::MODO_MANUAL));
    CHECK(b.cmd(Command::ABRIR_VALVULA));
    CHECK(b.cmd(Command::MODO_AUTOMATICO));
    CHECK(!b.open());
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
}

TEST(comando_desconhecido_e_recusado) {
    Bench b;
    b.settle();
    const int codes[] = {0, 7, 99, -1, 1000};
    for (int code : codes) CHECK(!b.svc.handleCommand(code));
    CHECK_EQ(b.state(), SystemState::AGUARDANDO);
    CHECK(!b.open());
}
