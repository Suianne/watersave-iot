# Contrato de dados: ESP32 ⇄ dashboard

> **Status:** v1. Os **nomes das variáveis estão definidos**. O **protocolo de comunicação ainda será
> decidido pelo grupo**: o MQTT descrito abaixo é a proposta da camada de aplicação, e frequência e regras
> de controle são sugestões para as camadas de rede e de serviço validarem.
> Qualquer mudança aqui precisa ser combinada no grupo, porque o dashboard depende destes nomes.
> No código do dashboard, a referência é `application/dashboard/contrato.ts`.

## Visão geral

```
 ESP32 (firmware)  ──MQTT (TCP/TLS)──▶  Broker MQTT  ◀──MQTT sobre WebSocket──  Dashboard (navegador)
   publica estado e online                                  publica comandos e temperatura-alvo
   assina comando e temperaturaAlvo                         assina estado e online
```

Não existe backend próprio: o ESP32 e o dashboard só conversam pelo broker.

| Uso | Broker | ESP32 | Dashboard |
|---|---|---|---|
| Desenvolvimento | `broker.hivemq.com` (público, sem senha) | porta 1883 (TCP) | `wss://broker.hivemq.com:8884/mqtt` |
| Apresentação | HiveMQ Cloud, plano gratuito (cluster próprio, com usuário e senha) | porta 8883 (TLS) | `wss://<cluster>.hivemq.cloud:8884/mqtt` |

No broker público qualquer pessoa pode ler e publicar nos tópicos. Serve só para testes; para a
apresentação, use um cluster próprio. Se o MQTT der muito problema, o plano B é o Arduino IoT Cloud
(ver o fim deste documento).

## Tópicos

Prefixo padrão: `watersave` (configurável no dashboard).

| Tópico | Direção | Conteúdo | QoS | Retido | Quando |
|---|---|---|---|---|---|
| `watersave/estado` | ESP32 → dashboard | JSON da telemetria (abaixo) | 0 | não | a cada **2 s** e logo depois de qualquer mudança de estado, válvula, alerta ou alvo |
| `watersave/online` | ESP32 → dashboard | `"1"` ou `"0"` | 1 | **sim** | `"1"` ao conectar; `"0"` vem do **Last Will** quando o ESP32 cai |
| `watersave/temperaturaAlvo/set` | dashboard → ESP32 | número em °C, ex.: `"38.5"` | 1 | **sim** | quando o usuário muda o alvo |
| `watersave/comando` | dashboard → ESP32 | inteiro, ex.: `"5"` | 1 | **não** | quando o usuário envia um comando |

- O alvo é **retido** para o ESP32 recebê-lo assim que (re)conectar.
- O comando **não pode ser retido**: senão um "abrir válvula" antigo seria executado de novo quando o ESP32 reconectar.

## Telemetria (`watersave/estado`)

```json
{
  "temperaturaAtual": 36.25,
  "temperaturaAlvo": 35.0,
  "histerese": 2.0,
  "vazao": 4.8,
  "volumeTransferido": 1.234,
  "valvulaAberta": true,
  "estadoSistema": 2,
  "alerta": ""
}
```

| Campo | Tipo | Unidade | Descrição |
|---|---|---|---|
| `temperaturaAtual` | float | °C | Leitura do DS18B20. Enviar o valor bruto: `-127` (desconectado) ou `null` aparecem como leitura inválida |
| `temperaturaAlvo` | float | °C | Alvo em uso pelo firmware (o dashboard confirma a alteração por este campo) |
| `histerese` | float | °C | Largura da faixa de histerese |
| `vazao` | float | L/min | Vazão calculada a partir dos pulsos do YF-S201 |
| `volumeTransferido` | float | L | Volume acumulado desde a inicialização do ESP32. **Opcional:** se o firmware não enviar, o dashboard mostra `--` no volume e usa o resto do pacote |
| `valvulaAberta` | bool | | `true`/`false` (também aceita `1`/`0`) |
| `estadoSistema` | int | | Código da máquina de estados (tabela abaixo) |
| `alerta` | string | | Código do alerta ativo; `""` quando não há alerta |

Pacotes fora deste formato são descartados pelo dashboard e registrados como "pacote fora do contrato".

## Estados do sistema (`estadoSistema`)

| Código | Nome | Válvula | Significado |
|---|---|---|---|
| 0 | `INICIANDO` | fechada | Acabou de ligar; espera a primeira leitura válida |
| 1 | `AGUARDANDO` | fechada | Automático, temperatura abaixo do alvo |
| 2 | `TRANSFERINDO` | aberta | Automático, transferindo água |
| 3 | `MANUAL` | conforme o usuário | Automático desligado; só abre ou fecha por comando |
| 4 | `FALHA` | fechada | Uma proteção atuou; espera reset ou modo manual |

## Comandos (`watersave/comando`)

O firmware **precisa validar** cada comando: o dashboard também bloqueia, mas não pode ser a única barreira.

| Código | Comando | Aceito quando | Efeito |
|---|---|---|---|
| 1 | Parada de emergência | sempre | Fecha a válvula, `FALHA` com alerta `PARADA_EMERGENCIA` |
| 2 | Resetar falha | em `FALHA` **e** com leitura de temperatura válida | Limpa o alerta e volta para `AGUARDANDO` |
| 3 | Modo manual | em `AGUARDANDO`, `TRANSFERINDO` ou `FALHA` | Fecha a válvula e vai para `MANUAL` |
| 4 | Modo automático | em `MANUAL` **e** com leitura de temperatura válida | Fecha a válvula e vai para `AGUARDANDO` |
| 5 | Abrir válvula | em `MANUAL` com a válvula fechada | Abre a válvula |
| 6 | Fechar válvula | em `MANUAL` com a válvula aberta | Fecha a válvula |

O modo manual existe para operar mesmo com defeito (ex.: sensor de temperatura quebrado). Nele, a falha
do sensor só fica sinalizada no `alerta`, mas o tempo máximo de abertura e as verificações de fluxo continuam valendo.

## Alertas (`alerta`)

| Código | Quando | Ação do firmware |
|---|---|---|
| `SENSOR_TEMP_DESCONECTADO` | DS18B20 lendo `-127` por 1 s ou mais | Fecha a válvula, `FALHA` (no `MANUAL` só sinaliza) |
| `LEITURA_TEMP_INVALIDA` | leitura fora de -10 a 100 °C por 1 s ou mais | Igual ao anterior |
| `SEM_FLUXO_VALVULA_ABERTA` | válvula aberta e vazão < 0,2 L/min por mais de 5 s | Fecha a válvula, `FALHA` |
| `FLUXO_VALVULA_FECHADA` | válvula fechada e vazão > 0,5 L/min por mais de 5 s | `FALHA` (vazamento ou válvula travada) |
| `TEMPO_MAXIMO_EXCEDIDO` | válvula aberta por mais de 120 s seguidos | Fecha a válvula, `FALHA` |
| `PARADA_EMERGENCIA` | comando 1 | Fecha a válvula, `FALHA` |

Códigos novos podem ser criados: o dashboard mostra o código cru até ele entrar nesta tabela.

## Regras de controle esperadas (camada de serviço)

- **Histerese:** abre quando `temperaturaAtual >= temperaturaAlvo`; fecha quando `temperaturaAtual <= temperaturaAlvo - histerese`; entre os dois, mantém o estado. Sugestão: alvo 35 °C e histerese 2 °C.
- **Faixa do alvo:** de 20 a 70 °C. O YF-S201 suporta no máximo 80 °C, então nada de água fervendo.
- **Após reinicializar:** válvula fechada, estado `INICIANDO`, volume zerado, alvo recuperado da memória (NVS) ou do tópico retido.
- **Sem Wi-Fi:** o controle local continua (temperatura, histerese e proteções). Ao reconectar, publica `online = "1"` e volta a mandar a telemetria.

O simulador do dashboard (`application/dashboard/transporte/simulado.ts`) implementa exatamente essas
regras, e `application/testes/automatizados/simulador.test.ts` mostra os casos esperados. Os dois servem
de referência para o firmware.

## Exemplo para o firmware (camada de rede adapta)

Bibliotecas: `PubSubClient` e `ArduinoJson` (v7).

```cpp
WiFiClient wifi;              // HiveMQ Cloud: WiFiClientSecure e porta 8883
PubSubClient mqtt(wifi);

void conectarMqtt() {
  mqtt.setBufferSize(512);    // o padrão (256 bytes) é pequeno para o JSON da telemetria
  // Last Will: se o ESP32 cair, o broker publica "0" em watersave/online sozinho
  if (mqtt.connect("watersave-esp32", USUARIO, SENHA, "watersave/online", 1, true, "0")) {
    mqtt.publish("watersave/online", "1", true);
    mqtt.subscribe("watersave/comando", 1);
    mqtt.subscribe("watersave/temperaturaAlvo/set", 1);
  }
}

void publicarEstado() {
  JsonDocument doc;
  doc["temperaturaAtual"] = temperaturaAtual;   // -127 se o DS18B20 estiver desconectado
  doc["temperaturaAlvo"] = temperaturaAlvo;
  doc["histerese"] = HISTERESE;
  doc["vazao"] = vazaoLmin;
  doc["volumeTransferido"] = volumeLitros;
  doc["valvulaAberta"] = valvulaAberta;
  doc["estadoSistema"] = (int)estado;
  doc["alerta"] = alertaAtivo;                  // "" quando não há alerta
  char buffer[384];
  size_t tamanho = serializeJson(doc, buffer);
  mqtt.publish("watersave/estado", (const uint8_t*)buffer, tamanho, false);
}

void aoReceberMensagem(char* topico, byte* payload, unsigned int tamanho) {
  String texto;
  for (unsigned int i = 0; i < tamanho; i++) texto += (char)payload[i];
  if (strcmp(topico, "watersave/comando") == 0) tratarComando(texto.toInt());       // validar intertravamentos
  else if (strcmp(topico, "watersave/temperaturaAlvo/set") == 0) definirAlvo(texto.toFloat());  // validar 20 a 70 °C
}
```

No broker público, troque `"watersave-esp32"` por um ID único (dois clientes com o mesmo ID se derrubam).

## Plano B: Arduino IoT Cloud

Se o grupo voltar para o Arduino IoT Cloud, use os mesmos nomes como variáveis da Thing:

| Variável | Tipo | Permissão |
|---|---|---|
| `temperaturaAtual`, `histerese`, `vazao`, `volumeTransferido` | float | Read Only |
| `temperaturaAlvo` | float | Read & Write |
| `valvulaAberta` | bool | Read Only |
| `estadoSistema` | int | Read Only |
| `alerta` | String | Read Only |
| `comando` | int | Read & Write |

São 9 variáveis: confira o limite de variáveis por Thing do plano gratuito antes de decidir.
