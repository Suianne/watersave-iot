#ifndef WATERSAVE_TARGET_STORE_H
#define WATERSAVE_TARGET_STORE_H

namespace service {

// Onde a temperatura-alvo sobrevive a um reinicio. No ESP32 e a NVS
// (NvsTargetStore.h); nos testes do PC, um objeto em memoria.
class TargetStore {
public:
    virtual ~TargetStore() {}
    // Retorna false se nao houver valor guardado.
    virtual bool load(float& valueC) = 0;
    virtual void save(float valueC) = 0;
};

}  // namespace service

#endif  // WATERSAVE_TARGET_STORE_H
