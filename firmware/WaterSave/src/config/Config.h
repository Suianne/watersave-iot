#ifndef WATERSAVE_CONFIG_H
#define WATERSAVE_CONFIG_H

#include <Arduino.h>

// ============================================================
// WaterSave IoT - configuracoes do firmware
// Placa de referencia: ESP32WROOM
// Os GPIOs permanecem em validacao na placa fisica.
// ============================================================

namespace Pins {
constexpr uint8_t TEMPERATURE_SENSOR = 4; // DS18B20 DATA
constexpr uint8_t FLOW_SENSOR = 27;       // YF-S201 SIGNAL
constexpr uint8_t VALVE_RELAY = 26;       // Rele IN1
}

namespace ThermalConfig {
constexpr float TARGET_TEMPERATURE_C = 35.0f;
constexpr float HYSTERESIS_C = 2.0f;
constexpr float CLOSE_TEMPERATURE_C =
    TARGET_TEMPERATURE_C - HYSTERESIS_C;

// Proposta inicial: exigir duas leituras validas consecutivas
// antes de permitir nova abertura. Ajustar se a equipe decidir
// outro criterio durante a validacao.
constexpr uint8_t VALID_READINGS_TO_REOPEN = 2;
}

namespace TemperatureConfig {
constexpr uint8_t RESOLUTION_BITS = 12;
constexpr unsigned long READ_INTERVAL_MS = 1000;
constexpr unsigned long CONVERSION_TIME_MS = 750;
constexpr float MIN_VALID_TEMPERATURE_C = -55.0f;
constexpr float MAX_VALID_TEMPERATURE_C = 125.0f;
}

namespace FlowConfig {
constexpr unsigned long UPDATE_INTERVAL_MS = 1000;

// Fator nominal inicial frequentemente usado para o YF-S201.
// Nao e uma calibracao experimental do sensor deste prototipo.
constexpr float CALIBRATION_FACTOR_HZ_PER_L_MIN = 7.5f;
}

namespace ValveConfig {
// O modulo respondeu no teste alimentado em 3,3 V, mas a
// polaridade logica de IN1 ainda nao foi identificada.
constexpr uint8_t RELAY_ACTIVE_LEVEL = LOW;

// MANTER false ate confirmar a polaridade, a corrente consumida
// pelo modulo e a compatibilidade eletrica com a ESP32-PICO-KIT.
// Com false, o firmware nao configura nem aciona o GPIO do rele.
constexpr bool PHYSICAL_OUTPUT_ENABLED = false;
}

namespace PowerConfig {
constexpr float LOGIC_VOLTAGE_V = 3.3f;
constexpr float TEMPERATURE_SENSOR_VOLTAGE_V = 3.3f;
constexpr float FLOW_SENSOR_VOLTAGE_V = 5.0f;
constexpr float RELAY_MODULE_VOLTAGE_V = 3.3f;
constexpr float SOLENOID_VALVE_VOLTAGE_V = 12.0f;
}

#endif // WATERSAVE_CONFIG_H
