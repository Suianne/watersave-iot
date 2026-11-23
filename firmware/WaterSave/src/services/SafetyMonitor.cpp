#include "SafetyMonitor.h"

#include "ServiceConfig.h"

namespace service {

SafetyMonitor::SafetyMonitor() {
    reset();
}

void SafetyMonitor::reset() {
    openMs_ = 0;
    noFlowMs_ = 0;
    flowWhileClosedMs_ = 0;
}

void SafetyMonitor::onValveOpened() {
    openMs_ = 0;
    noFlowMs_ = 0;
}

void SafetyMonitor::onValveClosed() {
    flowWhileClosedMs_ = 0;
}

void SafetyMonitor::clearLeakTimer() {
    flowWhileClosedMs_ = 0;
}

Alert SafetyMonitor::update(bool valveOpen, float flowLpm, uint32_t dtMs,
                            bool leakCheckEnabled) {
    if (valveOpen) {
        openMs_ += dtMs;
        noFlowMs_ = flowLpm < ServiceConfig::MIN_FLOW_WHEN_OPEN_LPM ? noFlowMs_ + dtMs : 0;

        if (openMs_ > ServiceConfig::MAX_OPEN_TIME_MS) return Alert::TEMPO_MAXIMO_EXCEDIDO;
        if (noFlowMs_ > ServiceConfig::FLOW_TOLERANCE_MS) return Alert::SEM_FLUXO_VALVULA_ABERTA;
        return Alert::NENHUM;
    }

    flowWhileClosedMs_ =
        flowLpm > ServiceConfig::MAX_FLOW_WHEN_CLOSED_LPM ? flowWhileClosedMs_ + dtMs : 0;

    if (leakCheckEnabled && flowWhileClosedMs_ > ServiceConfig::FLOW_TOLERANCE_MS) {
        return Alert::FLUXO_VALVULA_FECHADA;
    }
    return Alert::NENHUM;
}

}  // namespace service
