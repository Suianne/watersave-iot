#ifndef WATERSAVE_TEMPERATURE_SENSOR_H
#define WATERSAVE_TEMPERATURE_SENSOR_H

#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>

class TemperatureSensor {
public:
    explicit TemperatureSensor(uint8_t dataPin);

    void begin();
    // Retorna true quando uma nova conversao foi lida.
    bool update(float& temperatureC);
    bool isValid() const;
    float getLastTemperatureC() const;

private:
    OneWire oneWire_;
    DallasTemperature sensor_;
    bool conversionPending_;
    bool valid_;
    float lastTemperatureC_;
    unsigned long conversionStartedAt_;
    unsigned long lastRequestAt_;

    void requestConversion();
    bool isTemperatureValid(float temperatureC) const;
};

#endif
