#ifndef WATERSAVE_VALVE_CONTROLLER_H
#define WATERSAVE_VALVE_CONTROLLER_H

#include <Arduino.h>

class ValveController {
public:
    explicit ValveController(uint8_t relayPin);

    void begin();
    void setOpen(bool shouldOpen);
    void open();
    void close();
    bool isOpen() const;

private:
    uint8_t relayPin_;
    bool isOpen_;
    void writeState(bool shouldOpen);
};

#endif
