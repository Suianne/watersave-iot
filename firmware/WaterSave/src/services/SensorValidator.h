#ifndef WATERSAVE_SENSOR_VALIDATOR_H
#define WATERSAVE_SENSOR_VALIDATOR_H

#include <stdint.h>

#include "ServiceConfig.h"
#include "ServiceTypes.h"

namespace service {

// Valida as amostras do DS18B20. Recebe o valor BRUTO: o driver da percepcao
// devolve NAN para qualquer leitura ruim, e aqui precisamos distinguir
// -127 (desconectado) de valor fora da faixa para escolher o alerta certo.
class TemperatureValidator {
public:
    enum class Kind : uint8_t { NONE, VALID, DISCONNECTED, INVALID };

    TemperatureValidator();

    void reset();
    static Kind classify(float rawC);

    // Chamar uma vez por amostra nova.
    void onSample(float rawC, uint32_t nowMs);

    // A ultima amostra e valida.
    bool hasValidReading() const { return kind_ == Kind::VALID; }
    // Amostras validas seguidas suficientes para permitir abrir a valvula.
    bool isStable() const {
        return consecutiveValid_ >= ServiceConfig::VALID_SAMPLES_TO_OPEN;
    }
    float lastRawC() const { return lastRawC_; }

    // Leitura invalida ha tempo suficiente para virar falha de sensor.
    bool faultPersisted(uint32_t nowMs) const;
    Alert faultAlert() const;

private:
    Kind kind_;
    float lastRawC_;
    uint8_t consecutiveValid_;
    uint8_t invalidSamples_;
    uint32_t invalidSinceMs_;
};

// Vazao invalida (NAN, infinita ou negativa) e tratada como zero:
// no pior caso vira falha de "sem fluxo", que fecha a valvula.
float sanitizeFlow(float flowLpm);

}  // namespace service

#endif  // WATERSAVE_SENSOR_VALIDATOR_H
