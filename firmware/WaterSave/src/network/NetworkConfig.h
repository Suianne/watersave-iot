
#ifndef WATERSAVE_NETWORK_CONFIG_H
#define WATERSAVE_NETWORK_CONFIG_H

// ============================================================
// WaterSave IoT - configuracoes da camada de rede
// Os valores reais serao definidos no computador de integracao.
// Nao adicionar credenciais reais ao repositorio.
// ============================================================

namespace NetworkConfig {

constexpr char WIFI_SSID[] = "NOME_DA_REDE";
constexpr char WIFI_PASSWORD[] = "SENHA_DA_REDE";

constexpr char API_BASE_URL[] = "http://192.168.0.100:5000";

constexpr unsigned long COMMUNICATION_INTERVAL_MS = 2000;
constexpr unsigned long RECONNECT_INTERVAL_MS = 5000;
constexpr unsigned long HTTP_TIMEOUT_MS = 1500;
constexpr unsigned long COMMAND_RETRY_INTERVAL_MS = 1000;

constexpr unsigned long TASK_INTERVAL_MS = 50;

}  // namespace NetworkConfig

#endif  // WATERSAVE_NETWORK_CONFIG_H
