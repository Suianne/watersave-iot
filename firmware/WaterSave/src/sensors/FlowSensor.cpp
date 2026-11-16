#include "FlowSensor.h"
#include "../config/Config.h"

volatile uint32_t FlowSensor::pulseCount_ = 0;

FlowSensor::FlowSensor(uint8_t signalPin)
    : signalPin_(signalPin),
      lastUpdateMs_(0),
      flowRateLitersPerMinute_(0.0f),
      lastPulseCount_(0) {}

void IRAM_ATTR FlowSensor::onPulse() {
    ++pulseCount_;
}

void FlowSensor::begin() {
    // O modo eletrico definitivo depende da confirmacao do tipo
    // de saida do YF-S201 e do circuito de condicionamento.
    pinMode(signalPin_, INPUT);
    pulseCount_ = 0;
    lastUpdateMs_ = millis();
    attachInterrupt(digitalPinToInterrupt(signalPin_), onPulse, FALLING);
}

bool FlowSensor::update() {
    const unsigned long now = millis();
    const unsigned long elapsedMs = now - lastUpdateMs_;

    if (elapsedMs < FlowConfig::UPDATE_INTERVAL_MS) {
        return false;
    }

    noInterrupts();
    const uint32_t pulses = pulseCount_;
    pulseCount_ = 0;
    interrupts();

    lastPulseCount_ = pulses;

    if (pulses == 0) {
        // Regra definida para o prototipo: sem pulsos na janela,
        // registrar vazao instantanea igual a zero.
        flowRateLitersPerMinute_ = 0.0f;
    } else {
        const float frequencyHz =
            (static_cast<float>(pulses) * 1000.0f) /
            static_cast<float>(elapsedMs);

        flowRateLitersPerMinute_ =
            frequencyHz / FlowConfig::CALIBRATION_FACTOR_HZ_PER_L_MIN;
    }

    lastUpdateMs_ = now;
    return true;
}

float FlowSensor::getFlowRateLitersPerMinute() const {
    return flowRateLitersPerMinute_;
}

uint32_t FlowSensor::getLastPulseCount() const {
    return lastPulseCount_;
}
