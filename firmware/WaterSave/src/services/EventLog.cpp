#include "EventLog.h"

#include <stdio.h>

#include "ServiceTypes.h"

namespace service {

namespace {

const char* refusalText(uint8_t detail) {
    switch (static_cast<Refusal>(detail)) {
        case Refusal::ESTADO_INVALIDO: return "estado invalido";
        case Refusal::SEM_LEITURA_VALIDA: return "sem leitura valida";
        case Refusal::COMANDO_DESCONHECIDO: return "comando desconhecido";
        case Refusal::FORA_DA_FAIXA: return "fora da faixa";
        case Refusal::NENHUM: break;
    }
    return "-";
}

}  // namespace

EventLog::EventLog() : events_(), total_(0) {}

void EventLog::add(EventType type, uint32_t timestampMs, uint8_t code,
                   uint8_t detail, float value) {
    Event& slot = events_[total_ % CAPACITY];
    slot.timestampMs = timestampMs;
    slot.type = type;
    slot.code = code;
    slot.detail = detail;
    slot.value = value;
    ++total_;
}

size_t EventLog::size() const {
    return total_ < static_cast<uint32_t>(CAPACITY) ? total_ : static_cast<size_t>(CAPACITY);
}

uint32_t EventLog::totalCount() const {
    return total_;
}

const Event& EventLog::at(size_t i) const {
    const size_t count = size();
    if (i >= count) i = count == 0 ? 0 : count - 1;
    const uint32_t first = total_ - static_cast<uint32_t>(count);
    return events_[(first + i) % CAPACITY];
}

size_t EventLog::format(const Event& e, char* buffer, size_t bufferSize) {
    if (buffer == nullptr || bufferSize == 0) return 0;
    char text[64];

    switch (e.type) {
        case EventType::BOOT:
            snprintf(text, sizeof(text), "BOOT alvo=%.1f", static_cast<double>(e.value));
            break;
        case EventType::STATE_CHANGE:
            snprintf(text, sizeof(text), "ESTADO %s -> %s",
                     stateName(static_cast<SystemState>(e.detail)),
                     stateName(static_cast<SystemState>(e.code)));
            break;
        case EventType::ALERT_RAISED:
            snprintf(text, sizeof(text), "ALERTA %s", alertCode(static_cast<Alert>(e.code)));
            break;
        case EventType::ALERT_CLEARED:
            snprintf(text, sizeof(text), "ALERTA LIMPO %s", alertCode(static_cast<Alert>(e.code)));
            break;
        case EventType::VALVE_OPENED:
            snprintf(text, sizeof(text), "VALVULA ABERTA");
            break;
        case EventType::VALVE_CLOSED:
            snprintf(text, sizeof(text), "VALVULA FECHADA");
            break;
        case EventType::COMMAND_ACCEPTED:
            snprintf(text, sizeof(text), "COMANDO %u ACEITO", static_cast<unsigned>(e.code));
            break;
        case EventType::COMMAND_REFUSED:
            snprintf(text, sizeof(text), "COMANDO %u RECUSADO (%s)",
                     static_cast<unsigned>(e.code), refusalText(e.detail));
            break;
        case EventType::TARGET_CHANGED:
            snprintf(text, sizeof(text), "ALVO %.1f", static_cast<double>(e.value));
            break;
        case EventType::TARGET_REFUSED:
            snprintf(text, sizeof(text), "ALVO RECUSADO %.1f", static_cast<double>(e.value));
            break;
        default:
            snprintf(text, sizeof(text), "?");
            break;
    }

    const int written = snprintf(buffer, bufferSize, "[%lu ms] %s",
                                 static_cast<unsigned long>(e.timestampMs), text);
    if (written < 0) return 0;
    return static_cast<size_t>(written) < bufferSize ? static_cast<size_t>(written)
                                                     : bufferSize - 1;
}

}  // namespace service
