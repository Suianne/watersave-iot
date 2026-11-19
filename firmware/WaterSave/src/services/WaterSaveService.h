#ifndef WATERSAVE_SERVICE_H
#define WATERSAVE_SERVICE_H

#include <stdint.h>

#include "EventLog.h"
#include "HysteresisController.h"
#include "SafetyMonitor.h"
#include "SensorValidator.h"
#include "ServiceTypes.h"
#include "TargetStore.h"

namespace service {

// Camada de servico: maquina de estados, controle por histerese, comandos,
// protecoes e registro de eventos. Nao conhece pinos, Wi-Fi nem MQTT:
//   percepcao -> Inputs -> update() -> valveShouldBeOpen() / telemetry() -> rede
// Comportamento de referencia: docs/contrato-de-dados.md e o simulador do dashboard.
class WaterSaveService {
public:
    // store pode ser nullptr (o alvo nao sobrevive ao reinicio).
    explicit WaterSaveService(TargetStore* store = nullptr);

    // Reinicio: valvula fechada, INICIANDO, volume zerado, alvo vindo da memoria.
    void begin(uint32_t nowMs);

    // Chamar a cada iteracao do loop() (nowMs = millis()).
    void update(const Inputs& inputs, uint32_t nowMs);

    // Comando recebido da rede. Valida contra o estado atual, independente
    // do que o dashboard ja tenha bloqueado. Retorna true se foi aplicado.
    bool handleCommand(int code);

    // Faixa 20 a 70 C. Retorna true se o alvo foi aceito.
    bool setTargetTemperature(float valueC);

    // Saida logica da valvula: o loop() repassa ao ValveController.
    bool valveShouldBeOpen() const { return valve_; }
    SystemState state() const { return state_; }
    Alert alert() const { return alert_; }
    Telemetry telemetry() const;

    // Sobe sempre que estado, valvula, alerta ou alvo mudam: a rede usa
    // para publicar logo, sem esperar o intervalo normal de 2 s.
    uint32_t changeSequence() const { return changeSeq_; }

    const EventLog& log() const { return log_; }

private:
    void controlStep(uint32_t nowMs);
    void safetyStep(uint32_t dtMs);

    void enterState(SystemState next);
    void openValve();
    void closeValve();
    void setAlert(Alert next);
    void fail(Alert reason);
    bool accept(int code);
    bool refuse(int code, Refusal reason);

    TargetStore* store_;
    HysteresisController hysteresis_;
    TemperatureValidator temperature_;
    SafetyMonitor safety_;
    EventLog log_;

    SystemState state_;
    Alert alert_;
    bool valve_;
    float flowLpm_;
    double volumeL_;
    uint32_t lastNowMs_;
    uint32_t changeSeq_;
};

}  // namespace service

#endif  // WATERSAVE_SERVICE_H
