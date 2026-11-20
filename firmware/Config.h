
#ifndef CONFIG_H
#define CONFIG_H

// Dados da rede Wi-Fi
#define WIFI_SSID "NOME_DA_REDE"
#define WIFI_PASSWORD "SENHA_DA_REDE"

// IP do computador que executa a API
#define API_BASE_URL "http://192.168.0.100:5000"

// Intervalo de comunicacao
#define INTERVALO_COMUNICACAO 2000

// Intervalo entre tentativas de reconexao
#define INTERVALO_RECONEXAO 5000

// Tempo limite das requisicoes HTTP
#define HTTP_TIMEOUT 1500

#endif
