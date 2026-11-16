#include <Arduino.h>

constexpr uint8_t FLOW_SENSOR_PIN = 27;
constexpr unsigned long UPDATE_INTERVAL_MS = 1000;
constexpr float CALIBRATION_FACTOR = 7.5f; // fator nominal inicial

volatile uint32_t pulseCount = 0;
unsigned long lastUpdateMs = 0;

void IRAM_ATTR countPulse() {
    ++pulseCount;
}

void setup() {
    Serial.begin(115200);

    // Confirmar o tipo de saida e o condicionamento eletrico
    // antes de conectar o sinal do sensor ao ESP32.
    pinMode(FLOW_SENSOR_PIN, INPUT);
    attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN),
                    countPulse, FALLING);

    lastUpdateMs = millis();
    Serial.println(F("Teste independente YF-S201"));
}

void loop() {
    const unsigned long now = millis();
    const unsigned long elapsedMs = now - lastUpdateMs;

    if (elapsedMs < UPDATE_INTERVAL_MS) {
        return;
    }

    noInterrupts();
    const uint32_t pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    float flowRate = 0.0f;
    if (pulses > 0) {
        const float frequencyHz =
            (static_cast<float>(pulses) * 1000.0f) /
            static_cast<float>(elapsedMs);
        flowRate = frequencyHz / CALIBRATION_FACTOR;
    }

    Serial.print(F("Pulsos: "));
    Serial.print(pulses);
    Serial.print(F(" | Vazao: "));
    Serial.print(flowRate, 2);
    Serial.println(F(" L/min"));

    lastUpdateMs = now;
}
