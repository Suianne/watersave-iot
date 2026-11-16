#include "ValveController.h"
#include "../config/Config.h"

ValveController::ValveController(uint8_t relayPin)
    : relayPin_(relayPin), isOpen_(false) {}

void ValveController::begin() {
    isOpen_ = false;

    if (!ValveConfig::PHYSICAL_OUTPUT_ENABLED) {
        // Mantem o pino em alta impedancia enquanto a polaridade
        // do rele nao estiver confirmada.
        pinMode(relayPin_, INPUT);
        Serial.println(F("AVISO: saida fisica do rele desabilitada."));
        return;
    }

    pinMode(relayPin_, OUTPUT);
    digitalWrite(relayPin_, !ValveConfig::RELAY_ACTIVE_LEVEL);
    Serial.println(F("Saida fisica do rele habilitada."));
}

void ValveController::setOpen(bool shouldOpen) {
    writeState(shouldOpen);
}

void ValveController::open() {
    writeState(true);
}

void ValveController::close() {
    writeState(false);
}

void ValveController::writeState(bool shouldOpen) {
    if (!ValveConfig::PHYSICAL_OUTPUT_ENABLED) {
        isOpen_ = false;
        return;
    }

    digitalWrite(
        relayPin_,
        shouldOpen ? ValveConfig::RELAY_ACTIVE_LEVEL
                   : !ValveConfig::RELAY_ACTIVE_LEVEL
    );
    isOpen_ = shouldOpen;
}

bool ValveController::isOpen() const {
    return isOpen_;
}
