#ifndef WATERSAVE_THERMAL_CONTROL_H
#define WATERSAVE_THERMAL_CONTROL_H

#include <Arduino.h>

class ThermalControl {
public:
    ThermalControl();

    // Deve ser chamada uma vez por nova leitura do DS18B20.
    // Uma leitura invalida fecha a valvula imediatamente.
    bool update(float temperatureC, bool readingValid);
    bool shouldOpenValve() const;

private:
    bool valveRequestedOpen_;
    uint8_t consecutiveValidReadings_;
};

#endif
