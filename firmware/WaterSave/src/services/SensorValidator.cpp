#include "SensorValidator.h"

#include <math.h>

namespace service {

TemperatureValidator::TemperatureValidator() {
    reset();
}

void TemperatureValidator::reset() {
    kind_ = Kind::NONE;
    lastRawC_ = NAN;
    consecutiveValid_ = 0;
    invalidSamples_ = 0;
    invalidSinceMs_ = 0;
}

TemperatureValidator::Kind TemperatureValidator::classify(float rawC) {
    if (!isfinite(rawC)) return Kind::INVALID;
    if (fabsf(rawC - ServiceConfig::DISCONNECTED_C) < 0.5f) return Kind::DISCONNECTED;
    // 85.0 e o valor de reset do DS18B20 (queda de alimentacao ou leitura
    // antes do fim da conversao) e fica acima do alvo maximo: nao pode abrir a valvula.
    if (rawC == ServiceConfig::POWER_ON_RESET_C) return Kind::INVALID;
    if (rawC < ServiceConfig::VALID_TEMP_MIN_C || rawC > ServiceConfig::VALID_TEMP_MAX_C) {
        return Kind::INVALID;
    }
    return Kind::VALID;
}

void TemperatureValidator::onSample(float rawC, uint32_t nowMs) {
    kind_ = classify(rawC);
    lastRawC_ = rawC;

    if (kind_ == Kind::VALID) {
        if (consecutiveValid_ < 255) ++consecutiveValid_;
        invalidSamples_ = 0;
        return;
    }

    consecutiveValid_ = 0;
    if (invalidSamples_ == 0) invalidSinceMs_ = nowMs;
    if (invalidSamples_ < 255) ++invalidSamples_;
}

bool TemperatureValidator::faultPersisted(uint32_t nowMs) const {
    // A subtracao em unsigned continua correta quando millis() da a volta.
    return invalidSamples_ >= ServiceConfig::INVALID_SAMPLES_TO_FAIL &&
           (nowMs - invalidSinceMs_) >= ServiceConfig::INVALID_READING_MS;
}

Alert TemperatureValidator::faultAlert() const {
    return kind_ == Kind::DISCONNECTED ? Alert::SENSOR_TEMP_DESCONECTADO
                                       : Alert::LEITURA_TEMP_INVALIDA;
}

float sanitizeFlow(float flowLpm) {
    if (!isfinite(flowLpm) || flowLpm < 0.0f) return 0.0f;
    return flowLpm;
}

}  // namespace service
