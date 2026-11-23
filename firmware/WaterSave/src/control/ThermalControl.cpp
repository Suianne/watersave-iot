#include "ThermalControl.h"
#include "../config/Config.h"
#include <math.h>

ThermalControl::ThermalControl()
    : valveRequestedOpen_(false),
      consecutiveValidReadings_(0) {}

bool ThermalControl::update(float temperatureC, bool readingValid) {
    if (!readingValid || !isfinite(temperatureC)) {
        consecutiveValidReadings_ = 0;
        valveRequestedOpen_ = false;
        return valveRequestedOpen_;
    }

    if (consecutiveValidReadings_ < ThermalConfig::VALID_READINGS_TO_REOPEN) {
        ++consecutiveValidReadings_;
    }

    if (consecutiveValidReadings_ < ThermalConfig::VALID_READINGS_TO_REOPEN) {
        valveRequestedOpen_ = false;
        return valveRequestedOpen_;
    }

    if (temperatureC >= ThermalConfig::TARGET_TEMPERATURE_C) {
        valveRequestedOpen_ = true;
    } else if (temperatureC <= ThermalConfig::CLOSE_TEMPERATURE_C) {
        valveRequestedOpen_ = false;
    }
    // Entre 23 C e 25 C, preserva o estado anterior.

    return valveRequestedOpen_;
}

bool ThermalControl::shouldOpenValve() const {
    return valveRequestedOpen_;
}
