#include "TemperatureSensor.h"
#include "../config/Config.h"
#include <math.h>

TemperatureSensor::TemperatureSensor(uint8_t dataPin)
    : oneWire_(dataPin),
      sensor_(&oneWire_),
      conversionPending_(false),
      valid_(false),
      lastTemperatureC_(NAN),
      conversionStartedAt_(0),
      lastRequestAt_(0) {}

void TemperatureSensor::begin() {
    sensor_.begin();
    sensor_.setResolution(TemperatureConfig::RESOLUTION_BITS);
    sensor_.setWaitForConversion(false);
    requestConversion();
}

void TemperatureSensor::requestConversion() {
    sensor_.requestTemperatures();
    conversionStartedAt_ = millis();
    lastRequestAt_ = conversionStartedAt_;
    conversionPending_ = true;
}

bool TemperatureSensor::update(float& temperatureC) {
    const unsigned long now = millis();

    if (conversionPending_) {
        if (now - conversionStartedAt_ < TemperatureConfig::CONVERSION_TIME_MS) {
            return false;
        }

        const float measured = sensor_.getTempCByIndex(0);
        conversionPending_ = false;

        if (isTemperatureValid(measured)) {
            lastTemperatureC_ = measured;
            valid_ = true;
            temperatureC = measured;
        } else {
            valid_ = false;
            lastTemperatureC_ = NAN;
            temperatureC = NAN;
        }

        return true;
    }

    if (now - lastRequestAt_ >= TemperatureConfig::READ_INTERVAL_MS) {
        requestConversion();
    }

    return false;
}

bool TemperatureSensor::isTemperatureValid(float temperatureC) const {
    return isfinite(temperatureC) &&
           temperatureC != DEVICE_DISCONNECTED_C &&
           temperatureC >= TemperatureConfig::MIN_VALID_TEMPERATURE_C &&
           temperatureC <= TemperatureConfig::MAX_VALID_TEMPERATURE_C;
}

bool TemperatureSensor::isValid() const {
    return valid_;
}

float TemperatureSensor::getLastTemperatureC() const {
    return lastTemperatureC_;
}
