
#include "NetworkManager.h"

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "NetworkConfig.h"

namespace network {

namespace {
constexpr uint8_t TELEMETRY_QUEUE_LENGTH = 1;
constexpr uint8_t COMMAND_QUEUE_LENGTH = 1;
constexpr uint8_t RESULT_QUEUE_LENGTH = 1;

constexpr uint32_t NETWORK_TASK_STACK_SIZE = 8192;
constexpr UBaseType_t NETWORK_TASK_PRIORITY = 1;
}

NetworkManager::NetworkManager()
    : telemetryQueue_(nullptr),
      commandQueue_(nullptr),
      resultQueue_(nullptr),
      initialized_(false),
      commandInFlight_(false),
      inFlightCommandId_(-1),
      lastCommunicationMs_(0),
      lastReconnectMs_(0) {}

bool NetworkManager::begin() {
    if (initialized_) return true;

    telemetryQueue_ = xQueueCreate(
        TELEMETRY_QUEUE_LENGTH, sizeof(service::Telemetry));

    commandQueue_ = xQueueCreate(
        COMMAND_QUEUE_LENGTH, sizeof(NetworkCommand));

    resultQueue_ = xQueueCreate(
        RESULT_QUEUE_LENGTH, sizeof(CommandResult));

    if (telemetryQueue_ == nullptr ||
        commandQueue_ == nullptr ||
        resultQueue_ == nullptr) {
        Serial.println(F("[REDE] Erro ao criar filas."));

        if (telemetryQueue_ != nullptr) {
            vQueueDelete(telemetryQueue_);
            telemetryQueue_ = nullptr;
        }
        if (commandQueue_ != nullptr) {
            vQueueDelete(commandQueue_);
            commandQueue_ = nullptr;
        }
        if (resultQueue_ != nullptr) {
            vQueueDelete(resultQueue_);
            resultQueue_ = nullptr;
        }
        return false;
    }

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);

    initialized_ = true;

    const BaseType_t taskCreated = xTaskCreate(
        taskEntry,
        "WaterSaveNetwork",
        NETWORK_TASK_STACK_SIZE,
        this,
        NETWORK_TASK_PRIORITY,
        nullptr
    );

    if (taskCreated != pdPASS) {
        initialized_ = false;
        Serial.println(F("[REDE] Erro ao criar tarefa."));

        vQueueDelete(telemetryQueue_);
        vQueueDelete(commandQueue_);
        vQueueDelete(resultQueue_);
        telemetryQueue_ = nullptr;
        commandQueue_ = nullptr;
        resultQueue_ = nullptr;
        return false;
    }

    Serial.println(F("[REDE] Tarefa de comunicacao iniciada."));
    return true;
}

void NetworkManager::publishTelemetry(
    const service::Telemetry& telemetry) {

    if (!initialized_) return;

    // Mantem somente a telemetria mais recente.
    xQueueOverwrite(telemetryQueue_, &telemetry);
}

bool NetworkManager::receiveCommand(NetworkCommand& command) {
    if (!initialized_) return false;

    return xQueueReceive(commandQueue_, &command, 0) == pdTRUE;
}

void NetworkManager::submitCommandResult(
    const CommandResult& result) {

    if (!initialized_) return;

    xQueueOverwrite(resultQueue_, &result);
}

bool NetworkManager::isConnected() const {
    return WiFi.status() == WL_CONNECTED;
}

void NetworkManager::taskEntry(void* parameter) {
    NetworkManager* manager =
        static_cast<NetworkManager*>(parameter);

    manager->run();
}

void NetworkManager::run() {
    bool resultReady = false;
    CommandResult pendingResult = {};

    unsigned long lastFetchMs = 0;
    unsigned long lastConfirmAttemptMs = 0;

    while (true) {
        const unsigned long now = millis();

        if (!isConnected()) {
            if (now - lastReconnectMs_ >=
                NetworkConfig::RECONNECT_INTERVAL_MS) {

                connectWiFi();
                lastReconnectMs_ = now;
            }

            vTaskDelay(pdMS_TO_TICKS(
                NetworkConfig::TASK_INTERVAL_MS));
            continue;
        }

        // Recebe o resultado produzido pelo loop principal.
        if (commandInFlight_ && !resultReady) {
            if (xQueueReceive(
                    resultQueue_,
                    &pendingResult,
                    0) == pdTRUE) {

                if (pendingResult.id == inFlightCommandId_) {
                    resultReady = true;
                }
            }
        }

        // Tenta confirmar o comando avaliado pelo serviço.
        if (commandInFlight_ && resultReady &&
            now - lastConfirmAttemptMs >=
                NetworkConfig::COMMAND_RETRY_INTERVAL_MS) {

            lastConfirmAttemptMs = now;

            if (confirmCommand(pendingResult.id)) {
                Serial.print(F("[REDE] Comando processado: "));
                Serial.println(pendingResult.id);

                commandInFlight_ = false;
                inFlightCommandId_ = -1;
                resultReady = false;
            }
        }

        // Publica telemetria periodicamente.
        if (now - lastCommunicationMs_ >=
            NetworkConfig::COMMUNICATION_INTERVAL_MS) {

            lastCommunicationMs_ = now;
            sendTelemetry();
        }

        // Busca outro comando somente quando nao existe
        // um comando aguardando avaliacao ou confirmacao.
        if (!commandInFlight_ &&
            now - lastFetchMs >=
                NetworkConfig::COMMUNICATION_INTERVAL_MS) {

            lastFetchMs = now;
            fetchCommands();
        }

        vTaskDelay(pdMS_TO_TICKS(
            NetworkConfig::TASK_INTERVAL_MS));
    }
}

void NetworkManager::connectWiFi() {
    Serial.println(F("[REDE] Conectando ao Wi-Fi..."));

    WiFi.begin(
        NetworkConfig::WIFI_SSID,
        NetworkConfig::WIFI_PASSWORD
    );
}

void NetworkManager::sendTelemetry() {
    service::Telemetry telemetry;

    if (xQueuePeek(
            telemetryQueue_,
            &telemetry,
            0) != pdTRUE) {
        return;
    }

    JsonDocument documento;

    // A API exige um numero. -127 representa temperatura invalida.
    documento["temperaturaAtual"] =
        telemetry.temperatureValid
            ? telemetry.temperatureC
            : -127.0f;

    documento["temperaturaAlvo"] = telemetry.targetC;
    documento["histerese"] = telemetry.hysteresisC;
    documento["vazao"] = telemetry.flowLpm;
    documento["volumeTransferido"] = telemetry.volumeL;

    // Estado logico comandado pelo servico, nao confirmacao
    // de abertura fisica da valvula.
    documento["valvulaAberta"] = telemetry.valveOpen;

    documento["estadoSistema"] =
        static_cast<int>(telemetry.state);

    documento["alerta"] = service::alertCode(telemetry.alert);

    String payload;
    serializeJson(documento, payload);

    HTTPClient http;
    http.setTimeout(NetworkConfig::HTTP_TIMEOUT_MS);

    const String url =
        String(NetworkConfig::API_BASE_URL) + "/api/leituras";

    if (!http.begin(url)) return;

    http.addHeader("Content-Type", "application/json");

    const int status = http.POST(payload);

    if (status == 201) {
        Serial.println(F("[REDE] Telemetria enviada."));
    } else {
        Serial.print(F("[REDE] Falha ao enviar telemetria: "));
        Serial.println(status);
    }

    http.end();
}

void NetworkManager::fetchCommands() {
    HTTPClient http;
    http.setTimeout(NetworkConfig::HTTP_TIMEOUT_MS);

    const String url =
        String(NetworkConfig::API_BASE_URL) + "/api/comandos";

    if (!http.begin(url)) return;

    const int status = http.GET();

    if (status != 200) {
        Serial.print(F("[REDE] Erro ao consultar comandos: "));
        Serial.println(status);
        http.end();
        return;
    }

    JsonDocument documento;
    const DeserializationError erro =
        deserializeJson(documento, http.getString());

    http.end();

    if (erro) {
        Serial.println(F("[REDE] JSON de comandos invalido."));
        return;
    }

    JsonArray comandos =
        documento["comandos"].as<JsonArray>();

    if (comandos.isNull() || comandos.size() == 0) return;

    JsonObject primeiro = comandos[0];

    NetworkCommand command = {};

    command.id = primeiro["id"] | -1;
    command.code = primeiro["comando"] | -1;

    command.hasTargetTemperature =
        primeiro["temperaturaAlvo"].is<float>() ||
        primeiro["temperaturaAlvo"].is<int>();

    command.targetTemperature =
        command.hasTargetTemperature
            ? primeiro["temperaturaAlvo"].as<float>()
            : 0.0f;

    // O ID precisa ser valido para permitir a confirmacao na API.
    // Codigos fora do contrato seguem ao servico, que os recusa e registra,
    // evitando que um registro inconsistente fique pendente para sempre.
    if (command.id < 0) {
        Serial.println(F("[REDE] Comando sem ID valido; ignorado."));
        return;
    }

    if (xQueueSend(commandQueue_, &command, 0) == pdTRUE) {
        commandInFlight_ = true;
        inFlightCommandId_ = command.id;

        Serial.print(F("[REDE] Comando recebido: "));
        Serial.println(command.id);
    }
}

bool NetworkManager::confirmCommand(int commandId) {
    HTTPClient http;
    http.setTimeout(NetworkConfig::HTTP_TIMEOUT_MS);

    const String url =
        String(NetworkConfig::API_BASE_URL) +
        "/api/comandos/" +
        String(commandId) +
        "/confirmar";

    if (!http.begin(url)) return false;

    const int status = http.POST("");

    http.end();

    // 404 tambem encerra o fluxo: a API informa que o comando ja foi
    // processado ou nao existe (por exemplo, repeticao apos reinicio).
    return status == 200 || status == 404;
}

}  // namespace network
