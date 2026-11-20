
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "Config.h"

// ==================================================
// CONTROLE DOS INTERVALOS
// ==================================================

unsigned long ultimaComunicacao = 0;
unsigned long ultimaTentativaWiFi = 0;

bool wifiAnteriormenteConectado = false;

// ==================================================
// DADOS SIMULADOS DOS SENSORES
// ==================================================

float temperaturaAtual = 32.5;
float temperaturaAlvo = 35.0;
float histerese = 2.0;
float vazao = 4.5;
float volumeTransferido = 12.8;

bool valvulaAberta = true;

int estadoSistema = 1;

String alerta = "Sistema funcionando normalmente";

// ==================================================
// CONEXAO WI-FI
// ==================================================

void iniciarWiFi() {

    WiFi.mode(WIFI_STA);

    WiFi.setAutoReconnect(true);
    WiFi.persistent(false);

    Serial.println("\nConectando ao Wi-Fi...");

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    ultimaTentativaWiFi = millis();
}

void verificarWiFi() {

    unsigned long agora = millis();

    if (WiFi.status() == WL_CONNECTED) {

        if (!wifiAnteriormenteConectado) {

            wifiAnteriormenteConectado = true;

            Serial.println("\n[APROVADO] Wi-Fi conectado!");

            Serial.print("IP do ESP32: ");
            Serial.println(WiFi.localIP());

            // Permite comunicar imediatamente
            ultimaComunicacao = 0;
        }

        return;
    }

    // Detecta perda da conexao
    if (wifiAnteriormenteConectado) {

        wifiAnteriormenteConectado = false;

        Serial.println("\n[ALERTA] Conexao Wi-Fi perdida!");
        Serial.println("Aguardando reconexao...");
    }

    // Tentativas periodicas de reconexao
    if (agora - ultimaTentativaWiFi >= INTERVALO_RECONEXAO) {

        ultimaTentativaWiFi = agora;

        Serial.println("[TENTATIVA] Reconectando ao Wi-Fi...");

        bool reconectando = WiFi.reconnect();

        if (!reconectando) {

            Serial.println("Iniciando nova tentativa de conexao...");

            WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
        }
    }
}

// ==================================================
// ENVIO DAS LEITURAS PARA A API
// ==================================================

void enviarLeituras() {

    if (WiFi.status() != WL_CONNECTED) {

        Serial.println("Sem Wi-Fi. Leitura nao enviada.");

        return;
    }

    HTTPClient http;

    String url = String(API_BASE_URL) + "/api/leituras";

    http.begin(url);

    http.setTimeout(HTTP_TIMEOUT);

    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<384> documento;

    documento["temperaturaAtual"] = temperaturaAtual;
    documento["temperaturaAlvo"] = temperaturaAlvo;
    documento["histerese"] = histerese;
    documento["vazao"] = vazao;
    documento["volumeTransferido"] = volumeTransferido;
    documento["valvulaAberta"] = valvulaAberta;
    documento["estadoSistema"] = estadoSistema;
    documento["alerta"] = alerta;

    String json;

    serializeJson(documento, json);

    Serial.println("\nEnviando leitura para a API:");
    Serial.println(json);

    int codigoHTTP = http.POST(json);

    if (codigoHTTP > 0) {

        Serial.print("Resposta HTTP: ");
        Serial.println(codigoHTTP);

        Serial.println(http.getString());

    } else {

        Serial.print("Erro no envio: ");
        Serial.println(http.errorToString(codigoHTTP));
    }

    http.end();
}

// ==================================================
// CONFIRMACAO DE COMANDO
// ==================================================

void confirmarComando(int id) {

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Sem Wi-Fi. Confirmacao nao enviada.");
        return;
    }

    HTTPClient http;

    String url = String(API_BASE_URL);

    url += "/api/comandos/";
    url += String(id);
    url += "/confirmar";

    http.begin(url);

    http.setTimeout(HTTP_TIMEOUT);

    int codigoHTTP = http.POST("");

    if (codigoHTTP == 200) {

        Serial.print("Comando ");
        Serial.print(id);
        Serial.println(" confirmado pela API.");

    } else {

        Serial.print("Falha ao confirmar comando: ");
        Serial.println(codigoHTTP);
    }

    http.end();
}

// ==================================================
// CONSULTA DE COMANDOS
// ==================================================

void consultarComandos() {

    if (WiFi.status() != WL_CONNECTED) {
        return;
    }

    HTTPClient http;

    String url = String(API_BASE_URL) + "/api/comandos";

    http.begin(url);

    http.setTimeout(HTTP_TIMEOUT);

    int codigoHTTP = http.GET();

    if (codigoHTTP == 200) {

        String resposta = http.getString();

        StaticJsonDocument<512> documento;

        DeserializationError erro = deserializeJson(documento, resposta);

        if (erro) {

            Serial.println("Erro ao interpretar JSON dos comandos.");

            http.end();

            return;
        }

        JsonArray comandos = documento["comandos"].as<JsonArray>();

        if (comandos.size() == 0) {

            Serial.println("Nenhum comando pendente.");
        }

        for (JsonObject item : comandos) {

            int id = item["id"] | 0;

            int codigo = item["comando"] | 0;

            Serial.println("\nComando recebido da API:");

            Serial.print("ID: ");
            Serial.println(id);

            Serial.print("Codigo: ");
            Serial.println(codigo);

            if (item["temperaturaAlvo"].is<float>() ||
                item["temperaturaAlvo"].is<int>()) {

                temperaturaAlvo = item["temperaturaAlvo"];

                Serial.print("Nova temperatura alvo: ");
                Serial.println(temperaturaAlvo);
            }

            switch (codigo) {

                case 1:
                    Serial.println("Comando: emergencia");
                    break;

                case 2:
                    Serial.println("Comando: resetar falha");
                    break;

                case 3:
                    Serial.println("Comando: modo manual");
                    break;

                case 4:
                    Serial.println("Comando: modo automatico");
                    break;

                case 5:
                    Serial.println("Comando: abrir valvula");
                    break;

                case 6:
                    Serial.println("Comando: fechar valvula");
                    break;

                default:
                    Serial.println("Comando desconhecido.");
                    break;
            }

            // Neste firmware de teste, a recepcao e a
            // exibicao no Serial representam o processamento.

            confirmarComando(id);
        }

    } else if (codigoHTTP > 0) {

        Serial.print("Erro HTTP na consulta: ");
        Serial.println(codigoHTTP);

    } else {

        Serial.print("Falha na consulta: ");
        Serial.println(http.errorToString(codigoHTTP));
    }

    http.end();
}

// ==================================================
// SETUP
// ==================================================

void setup() {

    Serial.begin(115200);

    Serial.println("\n================================");
    Serial.println("       WATERSAVE - REDE");
    Serial.println("================================");

    iniciarWiFi();
}

// ==================================================
// LOOP
// ==================================================

void loop() {

    verificarWiFi();

    if (WiFi.status() == WL_CONNECTED) {

        if (ultimaComunicacao == 0 ||
            millis() - ultimaComunicacao >= INTERVALO_COMUNICACAO) {

            ultimaComunicacao = millis();

            enviarLeituras();

            consultarComandos();
        }
    }
}
