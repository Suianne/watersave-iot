#ifndef WATERSAVE_SAFETY_MONITOR_H
#define WATERSAVE_SAFETY_MONITOR_H

#include <stdint.h>

#include "ServiceTypes.h"

namespace service {

// Protecoes ligadas a valvula e ao fluxo (valem tambem no modo manual):
//   - valvula aberta por mais de MAX_OPEN_TIME_MS
//   - valvula aberta sem fluxo por mais de FLOW_TOLERANCE_MS
//   - valvula fechada com fluxo por mais de FLOW_TOLERANCE_MS (vazamento/travada)
class SafetyMonitor {
public:
    SafetyMonitor();

    void reset();
    void onValveOpened();
    void onValveClosed();
    // Ao resetar uma falha, recomeca a contar o vazamento.
    void clearLeakTimer();

    // Chamar uma vez por iteracao. dtMs = tempo desde a chamada anterior.
    // leakCheckEnabled=false em FALHA, para nao reaparecer o mesmo alerta.
    // Retorna o alerta que deve virar falha, ou Alert::NENHUM.
    Alert update(bool valveOpen, float flowLpm, uint32_t dtMs, bool leakCheckEnabled);

private:
    uint32_t openMs_;
    uint32_t noFlowMs_;
    uint32_t flowWhileClosedMs_;
};

}  // namespace service

#endif  // WATERSAVE_SAFETY_MONITOR_H
