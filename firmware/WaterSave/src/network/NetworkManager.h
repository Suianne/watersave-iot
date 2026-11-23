#ifndef WATERSAVE_NETWORK_MANAGER_H
#define WATERSAVE_NETWORK_MANAGER_H

#include <Arduino.h>
#include "../services/ServiceTypes.h"

namespace network {

struct NetworkCommand {
    int id;
    int code;
    bool hasTargetTemperature;
    float targetTemperature;
};

// Cliente HTTP simples. Todas as chamadas são feitas pelo loop principal.
class NetworkManager {
public:
    bool begin();
    bool update(const service::Telemetry& telemetry, NetworkCommand& command);
    bool confirmCommand(int commandId);
    bool isConnected() const;

private:
    void connectWiFi();
    void sendTelemetry(const service::Telemetry& telemetry);
    bool fetchCommand(NetworkCommand& command);

    unsigned long lastTelemetryMs_ = 0;
    unsigned long lastCommandPollMs_ = 0;
    unsigned long lastReconnectMs_ = 0;
};

}  // namespace network

#endif
