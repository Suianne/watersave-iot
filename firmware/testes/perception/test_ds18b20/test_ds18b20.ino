#include <OneWire.h>
#include <DallasTemperature.h>

constexpr uint8_t DS18B20_PIN = 4;
constexpr uint8_t DS18B20_RESOLUTION = 12;
constexpr unsigned long READ_INTERVAL_MS = 1000;

OneWire oneWire(DS18B20_PIN);
DallasTemperature temperatureSensor(&oneWire);
unsigned long lastReadMs = 0;

void setup() {
    Serial.begin(115200);
    temperatureSensor.begin();
    temperatureSensor.setResolution(DS18B20_RESOLUTION);

    Serial.println(F("Teste independente DS18B20"));
    Serial.println(F("Resolucao: 12 bits"));
}

void loop() {
    if (millis() - lastReadMs < READ_INTERVAL_MS) {
        return;
    }

    lastReadMs = millis();
    temperatureSensor.requestTemperatures();
    const float temperatureC = temperatureSensor.getTempCByIndex(0);

    if (temperatureC == DEVICE_DISCONNECTED_C ||
        temperatureC < -55.0f || temperatureC > 125.0f) {
        Serial.println(F("ERRO: leitura invalida ou sensor desconectado."));
        return;
    }

    Serial.print(F("Temperatura: "));
    Serial.print(temperatureC, 2);
    Serial.println(F(" C"));
}
