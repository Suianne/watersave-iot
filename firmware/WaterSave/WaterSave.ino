#include <Arduino.h>
#include <math.h>

#include "config/Config.h"
#include "sensors/TemperatureSensor.h"
#include "sensors/FlowSensor.h"
#include "actuators/ValveController.h"

#include "services/WaterSaveService.h"
#include "services/HysteresisController.h"
#include "services/NvsTargetStore.h"

#include "network/NetworkManager.h"

// Percepcao
TemperatureSensor temperatureSensor(Pins::TEMPERATURE_SENSOR);
FlowSensor flowSensor(Pins::FLOW_SENSOR);
ValveController valveController(Pins::VALVE_RELAY);

// Servico e persistencia
service::NvsTargetStore targetStore;
service::WaterSaveService waterSaveService(&targetStore);

// Comunicacao: a tarefa de rede nunca acessa o servico diretamente.
network::NetworkManager networkManager;

unsigned long lastTelemetryLogMs = 0;

void processNetworkCommand() {
    network::NetworkCommand command;

    // A fila contem no maximo um comando pendente.
    if (!networkManager.receiveCommand(command)) return;

    bool accepted = false;

    // Valida o alvo antes de executar qualquer parte do comando.
    // Assim, um alvo invalido nao deixa um comando parcialmente aplicado.
    const bool targetIsValid =
        !command.hasTargetTemperature ||
        service::HysteresisController::isValidTarget(
            command.targetTemperature);

    if (targetIsValid) {
        accepted = waterSaveService.handleCommand(command.code);

        // O alvo so e alterado se o comando principal for aceito.
        if (accepted && command.hasTargetTemperature) {
            accepted = waterSaveService.setTargetTemperature(
                command.targetTemperature);
        }
    }

    // A API atual registra apenas que o comando foi avaliado.
    // Ela ainda nao armazena o resultado aceito/recusado.
    network::CommandResult result;
    result.id = command.id;
    result.accepted = accepted;
    networkManager.submitCommandResult(result);

    Serial.print(F("[COMANDO] ID "));
    Serial.print(command.id);
    Serial.println(accepted
        ? F(" avaliado e aceito pelo servico.")
        : F(" avaliado e recusado pelo servico."));
}

void setup() {
    Serial.begin(115200);
    delay(200);

    Serial.println();
    Serial.println(F("WaterSave IoT - firmware integrado"));

    // Inicializa atuador em estado seguro.
    valveController.begin();

    // Inicializa sensores.
    temperatureSensor.begin();
    flowSensor.begin();

    // Inicializa a maquina de estados.
    waterSaveService.begin(millis());

    // A rede funciona em tarefa separada. Se falhar, o controle local
    // continua operando normalmente.
    if (!networkManager.begin()) {
        Serial.println(F("[REDE] Inicializacao falhou; controle local mantido."));
    }

    Serial.println(F("Inicializacao concluida."));
    Serial.println(F("Controle centralizado na camada de servico."));
    Serial.println(F("Saida fisica do rele: verificar Config.h."));
}

void loop() {
    float rawTemperatureC = NAN;

    // Nova amostra somente quando uma conversao termina.
    const bool newTemperatureSample =
        temperatureSensor.update(rawTemperatureC);

    // Atualiza a estimativa de vazao independentemente
    // da conversao do DS18B20.
    if (flowSensor.update()) {
        Serial.print(F("Vazao: "));
        Serial.print(flowSensor.getFlowRateLitersPerMinute(), 2);
        Serial.println(F(" L/min"));
    }

    // Monta os dados de entrada do servico.
    service::Inputs inputs;
    inputs.newTemperatureSample = newTemperatureSample;
    inputs.temperatureRawC = rawTemperatureC;
    inputs.flowLpm = flowSensor.getFlowRateLitersPerMinute();

    // O servico decide estados, histerese e seguranca.
    waterSaveService.update(inputs, millis());

    // Comandos sao avaliados no loop principal, nunca na tarefa de rede.
    processNetworkCommand();

    // O atuador apenas executa a decisao logica do servico.
    valveController.setOpen(
        waterSaveService.valveShouldBeOpen()
    );

    // Publica uma copia da telemetria mais recente para a fila da rede.
    // A tarefa de rede envia no intervalo configurado, sem bloquear o loop.
    const service::Telemetry telemetry = waterSaveService.telemetry();
    networkManager.publishTelemetry(telemetry);

    // Telemetria local para depuracao.
    const unsigned long now = millis();

    if (now - lastTelemetryLogMs >= 2000) {
        lastTelemetryLogMs = now;

        Serial.print(F("Temperatura: "));
        if (telemetry.temperatureValid) {
            Serial.print(telemetry.temperatureC, 2);
            Serial.print(F(" C"));
        } else {
            Serial.print(F("INVALIDA"));
        }

        Serial.print(F(" | Alvo: "));
        Serial.print(telemetry.targetC, 1);

        Serial.print(F(" C | Vazao: "));
        Serial.print(telemetry.flowLpm, 2);

        Serial.print(F(" L/min | Volume: "));
        Serial.print(telemetry.volumeL, 3);

        Serial.print(F(" L | Estado: "));
        Serial.print(static_cast<int>(telemetry.state));

        Serial.print(F(" | Valvula logica: "));
        Serial.print(telemetry.valveOpen ? F("ABERTA") : F("FECHADA"));

        Serial.print(F(" | Alerta: "));
        Serial.println(service::alertCode(telemetry.alert));
    }
}
