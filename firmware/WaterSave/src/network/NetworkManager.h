
#ifndef WATERSAVE_NETWORK_MANAGER_H
#define WATERSAVE_NETWORK_MANAGER_H

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

#include "../services/ServiceTypes.h"

namespace network {

// Comando recebido da API e encaminhado ao loop principal.
struct NetworkCommand {
    int id;
    int code;
    bool hasTargetTemperature;
    float targetTemperature;
};

// Resultado da avaliação do comando pelo serviço.
struct CommandResult {
    int id;
    bool accepted;
};

// Responsável pela comunicação Wi-Fi e HTTP.
// O serviço nunca será modificado diretamente pela tarefa de rede.
class NetworkManager {
public:
    NetworkManager();

    // Cria as filas e inicia a tarefa de comunicação.
    bool begin();

    // Atualiza a telemetria que será enviada à API.
    // A fila mantém somente a amostra mais recente.
    void publishTelemetry(const service::Telemetry& telemetry);

    // Obtém um comando pendente para o loop principal.
    bool receiveCommand(NetworkCommand& command);

    // Informa à rede que o serviço avaliou o comando.
    void submitCommandResult(const CommandResult& result);

    bool isConnected() const;

private:
    static void taskEntry(void* parameter);
    void run();

    void connectWiFi();
    void sendTelemetry();
    void fetchCommands();
    bool confirmCommand(int commandId);
    QueueHandle_t telemetryQueue_;
    QueueHandle_t commandQueue_;
    QueueHandle_t resultQueue_;

    bool initialized_;
    bool commandInFlight_;
    int inFlightCommandId_;

    unsigned long lastCommunicationMs_;
    unsigned long lastReconnectMs_;
};

}  // namespace network

#endif  // WATERSAVE_NETWORK_MANAGER_H
