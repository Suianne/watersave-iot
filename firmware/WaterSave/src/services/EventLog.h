#ifndef WATERSAVE_EVENT_LOG_H
#define WATERSAVE_EVENT_LOG_H

#include <stddef.h>
#include <stdint.h>

namespace service {

enum class EventType : uint8_t {
    BOOT,
    STATE_CHANGE,    // code = novo estado, detail = estado anterior
    ALERT_RAISED,    // code = Alert
    ALERT_CLEARED,   // code = Alert
    VALVE_OPENED,
    VALVE_CLOSED,
    COMMAND_ACCEPTED,  // code = codigo do comando
    COMMAND_REFUSED,   // code = codigo do comando, detail = Refusal
    TARGET_CHANGED,    // value = novo alvo
    TARGET_REFUSED,    // value = alvo recusado
};

enum class Refusal : uint8_t {
    NENHUM,
    ESTADO_INVALIDO,
    SEM_LEITURA_VALIDA,
    COMANDO_DESCONHECIDO,
    FORA_DA_FAIXA,
};

struct Event {
    uint32_t timestampMs;
    EventType type;
    uint8_t code;
    uint8_t detail;
    float value;
};

// Registro circular em RAM dos erros e ocorrencias. Os mais antigos
// sao sobrescritos; totalCount() continua contando.
class EventLog {
public:
    enum { CAPACITY = 32 };

    EventLog();

    void add(EventType type, uint32_t timestampMs, uint8_t code = 0,
             uint8_t detail = 0, float value = 0.0f);

    size_t size() const;          // eventos retidos (ate CAPACITY)
    uint32_t totalCount() const;  // todos desde o boot
    const Event& at(size_t i) const;  // 0 = mais antigo retido

    // Linha de texto para a serial. Retorna o tamanho escrito.
    static size_t format(const Event& event, char* buffer, size_t bufferSize);

private:
    Event events_[CAPACITY];
    uint32_t total_;
};

}  // namespace service

#endif  // WATERSAVE_EVENT_LOG_H
