#include <Arduino.h>

#include "config/Config.h"
#include "sensors/TemperatureSensor.h"
#include "sensors/FlowSensor.h"
#include "control/ThermalControl.h"
#include "actuators/ValveController.h"

TemperatureSensor temperatureSensor(Pins::TEMPERATURE_SENSOR);
FlowSensor flowSensor(Pins::FLOW_SENSOR);
ThermalControl thermalControl;
ValveController valveController(Pins::VALVE_RELAY);

unsigned long lastFlowLogMs = 0;

void setup() {
    Serial.begin(115200);
    delay(200);

    Serial.println();
    Serial.println(F("WaterSave IoT - camada de percepcao"));

    // O controlador mantem a saida fisica desabilitada ate que
    // a polaridade e a compatibilidade do rele sejam confirmadas.
    valveController.begin();

    temperatureSensor.begin();
    flowSensor.begin();

    Serial.println(F("Inicializacao concluida."));
    Serial.println(F("Saida fisica da valvula: verificar Config.h."));
}

void loop() {
    float temperatureC = NAN;

    // A conversao do DS18B20 e nao bloqueante.
    if (temperatureSensor.update(temperatureC)) {
        const bool shouldOpen = thermalControl.update(temperatureC, true);
        valveController.setOpen(shouldOpen);

        Serial.print(F("Temperatura: "));
        Serial.print(temperatureC, 2);
        Serial.print(F(" C | Valvula solicitada: "));
        Serial.println(shouldOpen ? F("ABERTA") : F("FECHADA"));
    }

    // Uma falha de leitura fecha imediatamente a solicitacao logica.
    if (!temperatureSensor.isValid()) {
        thermalControl.update(NAN, false);
        valveController.close();
    }

    // A contagem de pulsos ocorre por interrupcao e a vazao e
    // atualizada independentemente da conversao de temperatura.
    if (flowSensor.update()) {
        Serial.print(F("Vazao instantanea: "));
        Serial.print(flowSensor.getFlowRateLitersPerMinute(), 2);
        Serial.println(F(" L/min"));
    }
}
