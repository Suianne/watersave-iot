
#include <Arduino.h>
#include <math.h>

#include "config/Config.h"
#include "sensors/TemperatureSensor.h"
#include "sensors/FlowSensor.h"
#include "actuators/ValveController.h"

#include "services/WaterSaveService.h"
#include "services/NvsTargetStore.h"

// Percepcao
TemperatureSensor temperatureSensor(Pins::TEMPERATURE_SENSOR);
FlowSensor flowSensor(Pins::FLOW_SENSOR);
ValveController valveController(Pins::VALVE_RELAY);

// Servico e persistencia
service::NvsTargetStore targetStore;
service::WaterSaveService waterSaveService(&targetStore);

unsigned long lastTelemetryLogMs = 0;

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

    // O atuador apenas executa a decisao logica do servico.
    valveController.setOpen(
        waterSaveService.valveShouldBeOpen()
    );

    // Telemetria local para depuracao.
    const unsigned long now = millis();

    if (now - lastTelemetryLogMs >= 2000) {
        lastTelemetryLogMs = now;

        const service::Telemetry telemetry =
            waterSaveService.telemetry();

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
