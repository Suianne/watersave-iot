#include "WaterSaveService.h"

#include <math.h>

#include "ServiceConfig.h"

namespace service {

WaterSaveService::WaterSaveService(TargetStore* store)
    : store_(store),
      hysteresis_(ServiceConfig::DEFAULT_TARGET_C, ServiceConfig::HYSTERESIS_C),
      state_(SystemState::INICIANDO),
      alert_(Alert::NENHUM),
      valve_(false),
      flowLpm_(0.0f),
      volumeL_(0.0),
      lastNowMs_(0),
      changeSeq_(0) {}

void WaterSaveService::begin(uint32_t nowMs) {
    lastNowMs_ = nowMs;
    state_ = SystemState::INICIANDO;
    alert_ = Alert::NENHUM;
    valve_ = false;
    flowLpm_ = 0.0f;
    volumeL_ = 0.0;
    temperature_.reset();
    safety_.reset();

    // Alvo guardado fora da faixa e ignorado: vale o padrao.
    float stored = 0.0f;
    if (store_ != nullptr && store_->load(stored)) hysteresis_.setTarget(stored);

    ++changeSeq_;
    log_.add(EventType::BOOT, nowMs, 0, 0, hysteresis_.target());
}

void WaterSaveService::update(const Inputs& inputs, uint32_t nowMs) {
    const uint32_t dtMs = nowMs - lastNowMs_;  // correto mesmo quando millis() da a volta
    lastNowMs_ = nowMs;

    flowLpm_ = sanitizeFlow(inputs.flowLpm);
    volumeL_ += static_cast<double>(flowLpm_) * static_cast<double>(dtMs) / 60000.0;

    if (inputs.newTemperatureSample) {
        temperature_.onSample(inputs.temperatureRawC, nowMs);
    }

    controlStep(nowMs);
    safetyStep(dtMs);
}

void WaterSaveService::controlStep(uint32_t nowMs) {
    const bool sensorFailed = temperature_.faultPersisted(nowMs);
    const bool hasReading = temperature_.hasValidReading();
    const float temperatureC = temperature_.lastRawC();

    switch (state_) {
        case SystemState::INICIANDO:
            if (hasReading) {
                enterState(SystemState::AGUARDANDO);
            } else if (sensorFailed) {
                fail(temperature_.faultAlert());
            }
            break;

        case SystemState::AGUARDANDO:
            if (sensorFailed) {
                fail(temperature_.faultAlert());
            } else if (hasReading && temperature_.isStable() &&
                       hysteresis_.decide(temperatureC, false)) {
                openValve();
                enterState(SystemState::TRANSFERINDO);
            }
            break;

        case SystemState::TRANSFERINDO:
            // Fechar e a direcao segura: uma unica leitura valida basta.
            if (sensorFailed) {
                fail(temperature_.faultAlert());
            } else if (hasReading && !hysteresis_.decide(temperatureC, true)) {
                closeValve();
                enterState(SystemState::AGUARDANDO);
            }
            break;

        case SystemState::MANUAL:
            // No manual a falha do sensor nao bloqueia a valvula: so fica sinalizada.
            if (sensorFailed) {
                setAlert(temperature_.faultAlert());
            } else if (isSensorAlert(alert_)) {
                setAlert(Alert::NENHUM);
            }
            break;

        case SystemState::FALHA:
            break;  // so sai por comando
    }
}

void WaterSaveService::safetyStep(uint32_t dtMs) {
    const Alert triggered = safety_.update(valve_, flowLpm_, dtMs, state_ != SystemState::FALHA);
    if (triggered != Alert::NENHUM) fail(triggered);
}

bool WaterSaveService::handleCommand(int code) {
    switch (code) {
        case static_cast<int>(Command::PARADA_EMERGENCIA):
            fail(Alert::PARADA_EMERGENCIA);
            return accept(code);

        case static_cast<int>(Command::RESETAR_FALHA):
            if (state_ != SystemState::FALHA) return refuse(code, Refusal::ESTADO_INVALIDO);
            if (!temperature_.hasValidReading()) return refuse(code, Refusal::SEM_LEITURA_VALIDA);
            setAlert(Alert::NENHUM);
            safety_.clearLeakTimer();
            enterState(SystemState::AGUARDANDO);
            return accept(code);

        case static_cast<int>(Command::MODO_MANUAL):
            if (state_ == SystemState::INICIANDO || state_ == SystemState::MANUAL) {
                return refuse(code, Refusal::ESTADO_INVALIDO);
            }
            closeValve();
            // Alerta de sensor continua sinalizado no manual; os demais saem.
            if (!isSensorAlert(alert_)) setAlert(Alert::NENHUM);
            enterState(SystemState::MANUAL);
            return accept(code);

        case static_cast<int>(Command::MODO_AUTOMATICO):
            if (state_ != SystemState::MANUAL) return refuse(code, Refusal::ESTADO_INVALIDO);
            if (!temperature_.hasValidReading()) return refuse(code, Refusal::SEM_LEITURA_VALIDA);
            closeValve();
            setAlert(Alert::NENHUM);
            enterState(SystemState::AGUARDANDO);
            return accept(code);

        case static_cast<int>(Command::ABRIR_VALVULA):
            if (state_ != SystemState::MANUAL || valve_) return refuse(code, Refusal::ESTADO_INVALIDO);
            openValve();
            return accept(code);

        case static_cast<int>(Command::FECHAR_VALVULA):
            if (state_ != SystemState::MANUAL || !valve_) return refuse(code, Refusal::ESTADO_INVALIDO);
            closeValve();
            return accept(code);

        default:
            return refuse(code, Refusal::COMANDO_DESCONHECIDO);
    }
}

bool WaterSaveService::setTargetTemperature(float valueC) {
    if (!HysteresisController::isValidTarget(valueC)) {
        log_.add(EventType::TARGET_REFUSED, lastNowMs_, 0,
                 static_cast<uint8_t>(Refusal::FORA_DA_FAIXA), valueC);
        return false;
    }

    const float before = hysteresis_.target();
    hysteresis_.setTarget(valueC);
    const float after = hysteresis_.target();

    if (after != before) {
        if (store_ != nullptr) store_->save(after);
        ++changeSeq_;
        log_.add(EventType::TARGET_CHANGED, lastNowMs_, 0, 0, after);
    }
    return true;
}

Telemetry WaterSaveService::telemetry() const {
    Telemetry t;
    t.temperatureC = temperature_.lastRawC();
    t.temperatureValid = temperature_.hasValidReading();
    t.targetC = hysteresis_.target();
    t.hysteresisC = hysteresis_.hysteresis();
    t.flowLpm = flowLpm_;
    t.volumeL = static_cast<float>(volumeL_);
    t.valveOpen = valve_;
    t.state = state_;
    t.alert = alert_;
    return t;
}

void WaterSaveService::enterState(SystemState next) {
    if (next == state_) return;
    log_.add(EventType::STATE_CHANGE, lastNowMs_, static_cast<uint8_t>(next),
             static_cast<uint8_t>(state_));
    state_ = next;
    ++changeSeq_;
}

void WaterSaveService::openValve() {
    if (valve_) return;
    valve_ = true;
    safety_.onValveOpened();
    ++changeSeq_;
    log_.add(EventType::VALVE_OPENED, lastNowMs_);
}

void WaterSaveService::closeValve() {
    if (!valve_) return;
    valve_ = false;
    safety_.onValveClosed();
    ++changeSeq_;
    log_.add(EventType::VALVE_CLOSED, lastNowMs_);
}

void WaterSaveService::setAlert(Alert next) {
    if (next == alert_) return;
    if (alert_ != Alert::NENHUM) {
        log_.add(EventType::ALERT_CLEARED, lastNowMs_, static_cast<uint8_t>(alert_));
    }
    alert_ = next;
    ++changeSeq_;
    if (next != Alert::NENHUM) {
        log_.add(EventType::ALERT_RAISED, lastNowMs_, static_cast<uint8_t>(next));
    }
}

// Fechamento seguro: toda protecao passa por aqui.
void WaterSaveService::fail(Alert reason) {
    closeValve();
    setAlert(reason);
    enterState(SystemState::FALHA);
}

namespace {
// Codigo fora de 0..255 e registrado como 255 (so cabe um byte no log).
uint8_t logCode(int code) {
    return (code < 0 || code > 255) ? 255 : static_cast<uint8_t>(code);
}
}  // namespace

bool WaterSaveService::accept(int code) {
    log_.add(EventType::COMMAND_ACCEPTED, lastNowMs_, logCode(code));
    return true;
}

bool WaterSaveService::refuse(int code, Refusal reason) {
    log_.add(EventType::COMMAND_REFUSED, lastNowMs_, logCode(code),
             static_cast<uint8_t>(reason));
    return false;
}

}  // namespace service
