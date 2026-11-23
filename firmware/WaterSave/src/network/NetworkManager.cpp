#include "NetworkManager.h"

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "NetworkConfig.h"

namespace network {

bool NetworkManager::begin() {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    connectWiFi();

    const unsigned long now = millis();
    lastTelemetryMs_ = now - NetworkConfig::COMMUNICATION_INTERVAL_MS;
    lastCommandPollMs_ = now - NetworkConfig::COMMUNICATION_INTERVAL_MS;
    lastReconnectMs_ = now;
    return true;
}

bool NetworkManager::isConnected() const {
    return WiFi.status() == WL_CONNECTED;
}

void NetworkManager::connectWiFi() {
    Serial.println(F("[REDE] Conectando ao Wi-Fi..."));
    WiFi.begin(NetworkConfig::WIFI_SSID, NetworkConfig::WIFI_PASSWORD);
}

bool NetworkManager::update(
    const service::Telemetry& telemetry,
    NetworkCommand& command
) {
    const unsigned long now = millis();

    if (!isConnected()) {
        if (now - lastReconnectMs_ >= NetworkConfig::RECONNECT_INTERVAL_MS) {
            lastReconnectMs_ = now;
            connectWiFi();
        }
        return false;
    }

    if (now - lastTelemetryMs_ >= NetworkConfig::COMMUNICATION_INTERVAL_MS) {
        lastTelemetryMs_ = now;
        sendTelemetry(telemetry);
    }

    if (now - lastCommandPollMs_ >= NetworkConfig::COMMUNICATION_INTERVAL_MS) {
        lastCommandPollMs_ = now;
        return fetchCommand(command);
    }

    return false;
}

void NetworkManager::sendTelemetry(const service::Telemetry& telemetry) {
    JsonDocument document;
    document["temperaturaAtual"] =
        telemetry.temperatureValid ? telemetry.temperatureC : -127.0f;
    document["temperaturaAlvo"] = telemetry.targetC;
    document["histerese"] = telemetry.hysteresisC;
    document["vazao"] = telemetry.flowLpm;
    document["volumeTransferido"] = telemetry.volumeL;
    document["valvulaAberta"] = telemetry.valveOpen;
    document["estadoSistema"] = static_cast<int>(telemetry.state);
    document["alerta"] = service::alertCode(telemetry.alert);

    String payload;
    serializeJson(document, payload);

    HTTPClient http;
    http.setTimeout(NetworkConfig::HTTP_TIMEOUT_MS);
    const String url = String(NetworkConfig::API_BASE_URL) + "/api/leituras";
    if (!http.begin(url)) return;

    http.addHeader("Content-Type", "application/json");
    const int status = http.POST(payload);
    http.end();

    if (status == 201) {
        Serial.println(F("[REDE] Telemetria enviada."));
    } else {
        Serial.print(F("[REDE] Falha ao enviar telemetria: "));
        Serial.println(status);
    }
}

bool NetworkManager::fetchCommand(NetworkCommand& command) {
    HTTPClient http;
    http.setTimeout(NetworkConfig::HTTP_TIMEOUT_MS);
    const String url = String(NetworkConfig::API_BASE_URL) + "/api/comandos";
    if (!http.begin(url)) return false;

    const int status = http.GET();
    if (status != 200) {
        http.end();
        return false;
    }

    JsonDocument document;
    const DeserializationError error =
        deserializeJson(document, http.getString());
    http.end();

    if (error) {
        Serial.println(F("[REDE] Resposta de comandos invalida."));
        return false;
    }

    JsonArray commands = document["comandos"].as<JsonArray>();
    if (commands.isNull() || commands.size() == 0) return false;

    JsonObject first = commands[0];
    command.id = first["id"] | -1;
    command.code = first["comando"] | -1;
    command.hasTargetTemperature =
        first["temperaturaAlvo"].is<float>() ||
        first["temperaturaAlvo"].is<int>();
    command.targetTemperature = command.hasTargetTemperature
        ? first["temperaturaAlvo"].as<float>()
        : 0.0f;

    if (command.id < 0) {
        Serial.println(F("[REDE] Comando sem ID valido; ignorado."));
        return false;
    }

    Serial.print(F("[REDE] Comando recebido: "));
    Serial.println(command.id);
    return true;
}

bool NetworkManager::confirmCommand(int commandId) {
    HTTPClient http;
    http.setTimeout(NetworkConfig::HTTP_TIMEOUT_MS);
    const String url =
        String(NetworkConfig::API_BASE_URL) +
        "/api/comandos/" + String(commandId) + "/confirmar";

    if (!http.begin(url)) return false;
    const int status = http.POST("");
    http.end();

    if (status == 200 || status == 404) {
        Serial.print(F("[REDE] Comando avaliado: "));
        Serial.println(commandId);
        return true;
    }

    Serial.print(F("[REDE] Falha ao confirmar comando: "));
    Serial.println(status);
    return false;
}

}  // namespace network
