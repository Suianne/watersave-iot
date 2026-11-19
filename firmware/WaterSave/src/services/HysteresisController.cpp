#include "HysteresisController.h"

#include <math.h>

#include "ServiceConfig.h"

namespace service {

HysteresisController::HysteresisController(float targetC, float hysteresisC)
    : targetC_(targetC), hysteresisC_(hysteresisC) {}

bool HysteresisController::isValidTarget(float valueC) {
    return isfinite(valueC) && valueC >= ServiceConfig::TARGET_MIN_C &&
           valueC <= ServiceConfig::TARGET_MAX_C;
}

bool HysteresisController::setTarget(float valueC) {
    if (!isValidTarget(valueC)) return false;
    targetC_ = roundf(valueC * 10.0f) / 10.0f;
    return true;
}

bool HysteresisController::decide(float temperatureC, bool valveCurrentlyOpen) const {
    if (temperatureC >= targetC_) return true;
    if (temperatureC <= closeThreshold()) return false;
    return valveCurrentlyOpen;
}

}  // namespace service
