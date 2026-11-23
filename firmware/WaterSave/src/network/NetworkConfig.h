#ifndef WATERSAVE_NETWORK_CONFIG_H
#define WATERSAVE_NETWORK_CONFIG_H

// Configure localmente. Não publique credenciais reais no repositório.
namespace NetworkConfig {
constexpr char WIFI_SSID[] = "NOME_DA_REDE";
constexpr char WIFI_PASSWORD[] = "SENHA_DA_REDE";
constexpr char API_BASE_URL[] = "http://192.168.0.100:5000";

constexpr unsigned long COMMUNICATION_INTERVAL_MS = 2000;
constexpr unsigned long RECONNECT_INTERVAL_MS = 5000;
constexpr unsigned long HTTP_TIMEOUT_MS = 700;
}

#endif
