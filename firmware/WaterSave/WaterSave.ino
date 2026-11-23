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

TemperatureSensor temperatureSensor(Pins::TEMPERATURE_SENSOR);
FlowSensor flowSensor(Pins::FLOW_SENSOR);
ValveController valveController(Pins::VALVE_RELAY);

service::NvsTargetStore targetStore;
service::WaterSaveService waterSaveService(&targetStore);
network::NetworkManager networkManager;

unsigned long lastSerialLogMs = 0;

void processNetworkCommand(const network::NetworkCommand& command) {
    bool accepted = false;
    const bool targetIsValid =
        !command.hasTargetTemperature ||
        service::HysteresisController::isValidTarget(command.targetTemperature);

    if (targetIsValid) {
        if (command.code == 7) {
            accepted = command.hasTargetTemperature &&
                waterSaveService.setTargetTemperature(command.targetTemperature);
        } else {
            accepted = waterSaveService.handleCommand(command.code);
            if (accepted && command.hasTargetTemperature) {
                accepted = waterSaveService.setTargetTemperature(
                    command.targetTemperature
                );
            }
        }
    }

    Serial.print(F("[COMANDO] "));
    Serial.print(command.id);
    Serial.println(accepted ? F(" aceito.") : F(" recusado."));
    networkManager.confirmCommand(command.id);
}

void setup() {
    Serial.begin(115200);
    delay(200);

    Serial.println();
    Serial.println(F("WaterSave IoT - versao de demonstracao"));

    valveController.begin();
    temperatureSensor.begin();
    flowSensor.begin();
    waterSaveService.begin(millis());
    networkManager.begin();

    Serial.println(F("Inicializacao concluida."));
}

void loop() {
    float rawTemperatureC = NAN;
    const bool newTemperatureSample = temperatureSensor.update(rawTemperatureC);
    flowSensor.update();

    service::Inputs inputs;
    inputs.newTemperatureSample = newTemperatureSample;
    inputs.temperatureRawC = rawTemperatureC;
    inputs.flowLpm = flowSensor.getFlowRateLitersPerMinute();

    // O controle local roda antes da comunicação.
    waterSaveService.update(inputs, millis());
    valveController.setOpen(waterSaveService.valveShouldBeOpen());

    const service::Telemetry telemetry = waterSaveService.telemetry();

    // Sem filas ou tarefa de rede: o loop consulta a API diretamente.
    network::NetworkCommand command = {};
    if (networkManager.update(telemetry, command)) {
        processNetworkCommand(command);
    }

    const unsigned long now = millis();
    if (now - lastSerialLogMs >= 2000) {
        lastSerialLogMs = now;
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
        Serial.println(telemetry.valveOpen ? F("ABERTA") : F("FECHADA"));
    }
}
