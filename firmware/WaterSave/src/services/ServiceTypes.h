#ifndef WATERSAVE_SERVICE_TYPES_H
#define WATERSAVE_SERVICE_TYPES_H

#include <stdint.h>

// Tipos da camada de servico. Codigos numericos e textos seguem
// docs/contrato-de-dados.md (nao depende de Arduino: roda em testes no PC).

namespace service {

enum class SystemState : uint8_t {
    INICIANDO = 0,
    AGUARDANDO = 1,
    TRANSFERINDO = 2,
    MANUAL = 3,
    FALHA = 4,
};

enum class Command : uint8_t {
    PARADA_EMERGENCIA = 1,
    RESETAR_FALHA = 2,
    MODO_MANUAL = 3,
    MODO_AUTOMATICO = 4,
    ABRIR_VALVULA = 5,
    FECHAR_VALVULA = 6,
};

enum class Alert : uint8_t {
    NENHUM = 0,
    SENSOR_TEMP_DESCONECTADO,
    LEITURA_TEMP_INVALIDA,
    SEM_FLUXO_VALVULA_ABERTA,
    FLUXO_VALVULA_FECHADA,
    TEMPO_MAXIMO_EXCEDIDO,
    PARADA_EMERGENCIA,
};

// Texto do campo "alerta" do contrato; "" quando nao ha alerta.
const char* alertCode(Alert alert);
const char* stateName(SystemState state);
bool isSensorAlert(Alert alert);

// O que o loop() entrega ao servico a cada iteracao.
struct Inputs {
    bool newTemperatureSample;  // true uma vez por conversao do DS18B20
    float temperatureRawC;      // valor bruto da conversao (-127 se desconectado)
    float flowLpm;              // ultima vazao instantanea estimada
};

// Espelha o JSON de watersave/estado. A camada de rede serializa.
struct Telemetry {
    float temperatureC;    // ultima leitura bruta; NAN antes da primeira amostra
    bool temperatureValid; // false: enviar -127 ou null, como preferir o protocolo
    float targetC;
    float hysteresisC;
    float flowLpm;
    float volumeL;         // acumulado desde a inicializacao
    bool valveOpen;        // estado logico comandado pelo servico
    SystemState state;
    Alert alert;
};

}  // namespace service

#endif  // WATERSAVE_SERVICE_TYPES_H
