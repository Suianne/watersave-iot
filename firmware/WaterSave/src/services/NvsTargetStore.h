#ifndef WATERSAVE_NVS_TARGET_STORE_H
#define WATERSAVE_NVS_TARGET_STORE_H

// Guarda a temperatura-alvo na NVS do ESP32. Fora do ESP32 (testes no PC)
// este arquivo nao define nada.
#if defined(ARDUINO_ARCH_ESP32)

#include <Preferences.h>
#include <math.h>

#include "TargetStore.h"

namespace service {

class NvsTargetStore : public TargetStore {
public:
    bool load(float& valueC) override {
        Preferences prefs;
        if (!prefs.begin(kNamespace, false)) return false;
        const float stored = prefs.getFloat(kKey, NAN);
        prefs.end();
        if (!isfinite(stored)) return false;
        valueC = stored;
        return true;
    }

    // O servico so chama quando o alvo muda: evita desgaste da flash.
    void save(float valueC) override {
        Preferences prefs;
        if (!prefs.begin(kNamespace, false)) return;
        prefs.putFloat(kKey, valueC);
        prefs.end();
    }

private:
    static constexpr const char* kNamespace = "watersave";
    static constexpr const char* kKey = "alvo";
};

}  // namespace service

#endif  // ARDUINO_ARCH_ESP32

#endif  // WATERSAVE_NVS_TARGET_STORE_H
