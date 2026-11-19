#ifndef WATERSAVE_SERVICE_CONFIG_H
#define WATERSAVE_SERVICE_CONFIG_H

#include <stdint.h>

// ============================================================
// WaterSave IoT - parametros da camada de servico
// Valores conforme docs/contrato-de-dados.md. Mudou algo aqui,
// avisar o grupo: o dashboard depende destes numeros.
// ============================================================

namespace ServiceConfig {

// Controle termico
constexpr float DEFAULT_TARGET_C = 35.0f;
constexpr float HYSTERESIS_C = 2.0f;
constexpr float TARGET_MIN_C = 20.0f;
constexpr float TARGET_MAX_C = 70.0f;  // YF-S201 suporta no maximo 80 C

// Validacao da leitura de temperatura
constexpr float VALID_TEMP_MIN_C = -10.0f;
constexpr float VALID_TEMP_MAX_C = 100.0f;
constexpr float DISCONNECTED_C = -127.0f;  // DS18B20 sem resposta
constexpr float POWER_ON_RESET_C = 85.0f;  // valor de reset do DS18B20, tratado como invalido

// Falha de sensor: pelo menos 2 amostras invalidas seguidas E 1 s ou mais.
// A amostra chega a 1 Hz, entao uma unica leitura ruim nao derruba o sistema.
constexpr uint32_t INVALID_READING_MS = 1000;
constexpr uint8_t INVALID_SAMPLES_TO_FAIL = 2;

// Leituras validas consecutivas exigidas antes de abrir a valvula
// (mesma proposta de ThermalConfig::VALID_READINGS_TO_REOPEN na percepcao).
constexpr uint8_t VALID_SAMPLES_TO_OPEN = 2;

// Protecoes da valvula
constexpr uint32_t MAX_OPEN_TIME_MS = 120000;  // 120 s seguidos
constexpr float MIN_FLOW_WHEN_OPEN_LPM = 0.2f;
constexpr float MAX_FLOW_WHEN_CLOSED_LPM = 0.5f;
constexpr uint32_t FLOW_TOLERANCE_MS = 5000;  // fluxo incoerente por mais disso vira falha

}  // namespace ServiceConfig

#endif  // WATERSAVE_SERVICE_CONFIG_H
