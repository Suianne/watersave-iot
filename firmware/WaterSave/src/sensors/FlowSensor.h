#ifndef WATERSAVE_FLOW_SENSOR_H
#define WATERSAVE_FLOW_SENSOR_H

#include <Arduino.h>

class FlowSensor {
public:
    explicit FlowSensor(uint8_t signalPin);

    void begin();
    // Atualiza a vazao a cada intervalo configurado.
    // Retorna true quando uma nova estimativa estiver disponivel.
    bool update();
    float getFlowRateLitersPerMinute() const;
    uint32_t getLastPulseCount() const;

private:
    uint8_t signalPin_;
    unsigned long lastUpdateMs_;
    float flowRateLitersPerMinute_;
    uint32_t lastPulseCount_;

    static volatile uint32_t pulseCount_;
    static void IRAM_ATTR onPulse();
};

#endif
