# Contrato de dados: ESP32 ⇄ API REST ⇄ dashboard

> **Protocolo adotado na integração:** HTTP/REST sobre a rede local. Este contrato substitui a proposta MQTT anterior. O controle térmico e as proteções continuam locais no ESP32; a API transporta telemetria e comandos, mas não executa o controle.

## Arquitetura

```
Sensores/atuadores ⇄ ESP32 (percepção + serviço)
                           │ HTTP/REST
                           ▼
                     API Flask + SQLite
                           ▲
                           │ HTTP/REST
                       Dashboard
```

- O ESP32 envia telemetria a cada 2 s e consulta comandos pendentes.
- A API persiste as leituras e mantém uma fila de comandos no SQLite.
- O dashboard consulta a última leitura e cadastra comandos.
- A perda de Wi-Fi/API não interrompe o controle local do ESP32.
- A tarefa FreeRTOS de rede não acessa o serviço diretamente. O `loop()` principal recebe os comandos, valida-os pelo serviço e devolve o resultado à tarefa de rede.

## Endpoints

| Método | Endpoint | Origem | Finalidade | Resposta esperada |
|---|---|---|---|---|
| `GET` | `/` | qualquer cliente | verificar se a API está online | `200` |
| `POST` | `/api/leituras` | ESP32 | armazenar telemetria | `201` |
| `GET` | `/api/leituras/ultima` | dashboard | obter leitura mais recente e timestamp Unix | `200` |
| `POST` | `/api/comandos` | dashboard | cadastrar comando pendente | `201` |
| `GET` | `/api/comandos` | ESP32 | consultar comandos pendentes, em ordem de ID | `200` |
| `POST` | `/api/comandos/<id>/confirmar` | ESP32 | marcar comando como avaliado pelo serviço | `200` |

A confirmação da API significa que o firmware **avaliou** o comando. A API atual não registra se o serviço aceitou ou recusou a ação; essa informação aparece no Serial do ESP32. O dashboard deve confirmar o efeito pela telemetria seguinte.

## Telemetria

Endpoint: `POST /api/leituras`

```json
{
  "temperaturaAtual": 34.75,
  "temperaturaAlvo": 35.0,
  "histerese": 2.0,
  "vazao": 4.8,
  "volumeTransferido": 1.234,
  "valvulaAberta": false,
  "estadoSistema": 1,
  "alerta": ""
}
```

| Campo | Tipo | Unidade | Descrição |
|---|---|---|---|
| `temperaturaAtual` | número | °C | leitura do DS18B20; `-127` representa leitura inválida/desconectada no payload HTTP |
| `temperaturaAlvo` | número | °C | alvo atualmente configurado no serviço |
| `histerese` | número | °C | largura da faixa de histerese |
| `vazao` | número | L/min | vazão estimada pelo YF-S201 |
| `volumeTransferido` | número | L | volume acumulado desde a inicialização |
| `valvulaAberta` | booleano | — | estado lógico comandado pelo serviço; não confirma abertura física |
| `estadoSistema` | inteiro | — | estado da máquina, de 0 a 4 |
| `alerta` | texto | — | código do alerta; string vazia quando não há alerta |

A API exige todos os oito campos. Valores numéricos não podem ser booleanos. O endpoint de última leitura retorna `{"leitura": ...}`; a leitura inclui `timestamp` Unix para o dashboard detectar dados antigos. Quando ainda não existe leitura, `leitura` é `null`.

## Estados do sistema

| Código | Estado | Significado |
|---|---|---|
| 0 | `INICIANDO` | ESP32 inicializando e aguardando leitura válida |
| 1 | `AGUARDANDO` | controle automático; válvula logicamente fechada |
| 2 | `TRANSFERINDO` | controle automático; válvula logicamente aberta |
| 3 | `MANUAL` | controle automático desativado; operação por comandos |
| 4 | `FALHA` | proteção acionada; válvula logicamente fechada |

## Comandos

Endpoint: `POST /api/comandos`

O corpo contém `comando` e, quando necessário, `temperaturaAlvo`. A API devolve um ID; o ESP32 consulta a fila e processa um comando por vez.

| Código | Comando | Regra de aceitação no serviço |
|---|---|---|
| 1 | Parada de emergência | sempre; fecha a válvula lógica e entra em `FALHA` |
| 2 | Resetar falha | somente em `FALHA` e com leitura de temperatura válida |
| 3 | Modo manual | não pode estar em `INICIANDO` nem já estar em `MANUAL` |
| 4 | Modo automático | somente em `MANUAL` e com leitura válida |
| 5 | Abrir válvula | somente em `MANUAL` e se estiver fechada |
| 6 | Fechar válvula | somente em `MANUAL` e se estiver aberta |
| 7 | Atualizar somente o alvo | exige `temperaturaAlvo` entre 20 e 70 °C; não altera o modo |

Exemplo para alterar o alvo:

```json
{"comando": 7, "temperaturaAlvo": 38.5}
```

O comando 7 é uma extensão do protocolo HTTP para permitir ajuste independente do alvo. Ele não é um novo estado nem um comando da máquina de estados do serviço: o `loop()` chama diretamente `setTargetTemperature()`, que valida e persiste o valor.

Para comandos 1 a 6, o campo `temperaturaAlvo` é opcional. Se vier junto, o firmware valida o alvo antes de executar o comando e só o aplica se o comando principal for aceito.

## Alertas

| Código | Significado |
|---|---|
| `SENSOR_TEMP_DESCONECTADO` | DS18B20 desconectado |
| `LEITURA_TEMP_INVALIDA` | leitura fora da faixa válida |
| `SEM_FLUXO_VALVULA_ABERTA` | válvula lógica aberta sem vazão suficiente |
| `FLUXO_VALVULA_FECHADA` | vazão detectada com válvula lógica fechada |
| `TEMPO_MAXIMO_EXCEDIDO` | tempo máximo de abertura excedido |
| `PARADA_EMERGENCIA` | parada de emergência acionada |

## Regras de controle e segurança

- Alvo padrão: **35 °C**; histerese: **2 °C**.
- Abre quando temperatura >= alvo; fecha quando temperatura <= alvo - histerese; entre os limites mantém o estado.
- Faixa configurável do alvo: 20 a 70 °C.
- O controle continua local mesmo sem Wi-Fi ou API.
- HTTP usa timeout de 1500 ms; comunicação periódica de 2000 ms; a tarefa de rede é separada do `loop()`.
- A válvula física permanece desabilitada no firmware até validar GPIO, polaridade, alimentação, corrente, proteção elétrica e operação hidráulica.
- `valvulaAberta` representa apenas a decisão lógica do serviço. Não deve ser apresentada como confirmação de acionamento físico.
- A bomba ainda não faz parte do contrato de comandos desta integração.

## Limitações conhecidas

- A API confirma que o comando foi avaliado, mas não persiste o resultado aceito/recusado.
- Se o ESP32 reiniciar antes de confirmar um comando, ele pode ser entregue novamente. Não há deduplicação persistente no firmware.
- O dashboard da branch original da camada de aplicação foi desenvolvido com transporte MQTT. Ele ainda precisa de um adaptador HTTP/REST antes de ser integrado a esta arquitetura.
