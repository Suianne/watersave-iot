#include <Arduino.h>

constexpr uint8_t RELAY_IN1_PIN = 26;

// Ajustar para LOW ou HIGH somente depois de identificar a
// polaridade real do modulo. LOW e apenas um valor provisório.
constexpr uint8_t RELAY_ACTIVE_LEVEL = LOW;

// Manter false ate confirmar a polaridade, a corrente do modulo
// e as ligacoes da fonte de 12 V e da valvula.
constexpr bool ENABLE_RELAY_TEST_OUTPUT = false;

void setRelay(bool energized) {
    if (!ENABLE_RELAY_TEST_OUTPUT) {
        Serial.println(F("Saida bloqueada: teste fisico desabilitado."));
        return;
    }

    digitalWrite(RELAY_IN1_PIN,
                 energized ? RELAY_ACTIVE_LEVEL : !RELAY_ACTIVE_LEVEL);
}

void setup() {
    Serial.begin(115200);

    if (ENABLE_RELAY_TEST_OUTPUT) {
        pinMode(RELAY_IN1_PIN, OUTPUT);
        setRelay(false);
    } else {
        pinMode(RELAY_IN1_PIN, INPUT);
    }

    Serial.println(F("Teste manual do rele/valvula"));
    Serial.println(F("Comandos: o = energizar, f = desenergizar"));
    Serial.println(F("A saida inicia bloqueada por seguranca."));
}

void loop() {
    if (!Serial.available()) {
        return;
    }

    const char command = static_cast<char>(Serial.read());

    if (command == 'o' || command == 'O') {
        setRelay(true);
    } else if (command == 'f' || command == 'F') {
        setRelay(false);
    }
}
