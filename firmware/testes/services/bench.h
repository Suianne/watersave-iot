#ifndef WATERSAVE_TEST_BENCH_H
#define WATERSAVE_TEST_BENCH_H

// Bancada simulada para os testes da camada de servico: faz o papel dos
// sensores e da agua. O DS18B20 entrega 1 amostra por segundo, como o driver
// da percepcao; o servico e chamado a cada 250 ms, como o loop() real.

#include <stdint.h>

#include "../../WaterSave/src/services/WaterSaveService.h"
#include "test_framework.h"

using namespace service;

class FakeStore : public TargetStore {
public:
    FakeStore() : has(false), value(0.0f), saves(0) {}
    bool load(float& valueC) override {
        if (!has) return false;
        valueC = value;
        return true;
    }
    void save(float valueC) override {
        has = true;
        value = valueC;
        ++saves;
    }
    bool has;
    float value;
    int saves;
};

struct Plant {
    float tempC = 27.0f;
    bool disconnected = false;  // DS18B20 devolve -127
    bool clogged = false;       // mangueira entupida: sem vazao com a valvula aberta
    bool leak = false;          // vazamento: vazao com a valvula fechada
    float nominalFlowLpm = 5.0f;
    float leakFlowLpm = 0.8f;
};

class Bench {
public:
    explicit Bench(FakeStore* store = nullptr, uint32_t startMs = 1000)
        : plant(),
          svc(store),
          store_(store),
          now_(startMs),
          lastSampleMs_(startMs - 1000),
          samples_(0),
          overridePending_(false),
          overrideRawC_(0.0f) {
        svc.begin(now_);
    }

    Plant plant;

    // Passa da inicializacao: 3 amostras validas, estado AGUARDANDO.
    Bench& settle() {
        run(3.0);
        return *this;
    }

    void step(uint32_t dtMs = 250) {
        now_ += dtMs;
        Inputs in;
        in.newTemperatureSample = false;
        in.temperatureRawC = 0.0f;
        if (now_ - lastSampleMs_ >= 1000) {
            lastSampleMs_ = now_;
            ++samples_;
            in.newTemperatureSample = true;
            if (overridePending_) {
                in.temperatureRawC = overrideRawC_;
                overridePending_ = false;
            } else {
                in.temperatureRawC = plant.disconnected ? -127.0f : plant.tempC;
            }
        }
        in.flowLpm = currentFlow();
        svc.update(in, now_);
    }

    void run(double seconds) {
        const int steps = static_cast<int>(seconds * 4.0 + 0.5);
        for (int i = 0; i < steps; ++i) step();
    }

    // Avanca ate a proxima amostra de temperatura ser processada.
    void nextSample() {
        const int before = samples_;
        for (int i = 0; i < 8 && samples_ == before; ++i) step();
    }

    // A proxima amostra sai com este valor, independente da planta.
    void injectNextSample(float rawC) {
        overridePending_ = true;
        overrideRawC_ = rawC;
    }

    // Avanca ate a valvula abrir (ou estourar o limite). Retorna se abriu.
    bool runUntilOpen(double maxSeconds = 5.0) {
        const int steps = static_cast<int>(maxSeconds * 4.0 + 0.5);
        for (int i = 0; i < steps && !svc.valveShouldBeOpen(); ++i) step();
        return svc.valveShouldBeOpen();
    }

    // Simula o reinicio do ESP32: objeto novo, mesma memoria (NVS).
    void reboot() {
        svc = WaterSaveService(store_);
        svc.begin(now_);
    }

    bool open() const { return svc.valveShouldBeOpen(); }
    SystemState state() const { return svc.state(); }
    Alert alert() const { return svc.alert(); }
    Telemetry tel() const { return svc.telemetry(); }
    bool cmd(Command c) { return svc.handleCommand(static_cast<int>(c)); }
    uint32_t nowMs() const { return now_; }

    WaterSaveService svc;

private:
    float currentFlow() const {
        if (svc.valveShouldBeOpen()) return plant.clogged ? 0.0f : plant.nominalFlowLpm;
        return plant.leak ? plant.leakFlowLpm : 0.0f;
    }

    FakeStore* store_;
    uint32_t now_;
    uint32_t lastSampleMs_;
    int samples_;
    bool overridePending_;
    float overrideRawC_;
};

#endif  // WATERSAVE_TEST_BENCH_H
