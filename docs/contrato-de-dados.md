# Contrato de dados WaterSave

A comunicação entre ESP32 e API usa HTTP/REST na rede local. O controle térmico permanece no ESP32.

## Fluxo

~~~text
DS18B20 + YF-S201
        |
        v
ESP32: percepção + controle
        | HTTP
        v
API Flask <-> SQLite
        ^
        | HTTP
Dashboard (application/)
~~~

O ESP32 envia telemetria e consulta comandos a cada 2 segundos. A API armazena leituras e mantém comandos pendentes até o firmware confirmar que os avaliou ou até eles expirarem. O dashboard consulta a última leitura a cada segundo e cadastra os comandos.

## Endpoints

| Método | Rota | Quem usa | Uso |
|---|---|---|---|
| GET | `/` | todos | Verificar se a API está online |
| POST | `/api/leituras` | ESP32 | Receber telemetria |
| GET | `/api/leituras/ultima` | dashboard | Consultar a leitura mais recente |
| GET | `/api/leituras?desde=<timestamp>&limite=<n>` | dashboard | Histórico para os gráficos |
| GET | `/api/comandos` | ESP32 | Consultar comandos pendentes e dentro da validade |
| POST | `/api/comandos` | dashboard | Cadastrar comando |
| GET | `/api/comandos/<id>` | dashboard | Consultar a situação de um comando |
| POST | `/api/comandos/<id>/confirmar` | ESP32 | Marcar comando como avaliado |

As leituras devolvidas pela API trazem também `id`, `data_hora` e `timestamp` (horário Unix do servidor, em segundos). Sem nenhuma leitura, `/api/leituras/ultima` devolve `{"leitura": null}`.

## Telemetria

POST /api/leituras

~~~json
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
~~~

| Campo | Tipo | Unidade |
|---|---|---|
| temperaturaAtual | número | °C; -127 representa leitura inválida |
| temperaturaAlvo | número | °C |
| histerese | número | °C |
| vazao | número | L/min |
| volumeTransferido | número | L |
| valvulaAberta | booleano | Estado lógico decidido pelo serviço |
| estadoSistema | inteiro de 0 a 4 | Código de estado |
| alerta | texto | Código do alerta ou texto vazio |

## Estados

| Código | Estado |
|---:|---|
| 0 | INICIANDO |
| 1 | AGUARDANDO |
| 2 | TRANSFERINDO |
| 3 | MANUAL |
| 4 | FALHA |

## Alertas

| Código | Significado |
|---|---|
| SENSOR_TEMP_DESCONECTADO | DS18B20 desconectado |
| LEITURA_TEMP_INVALIDA | Leitura fora da faixa válida |
| SEM_FLUXO_VALVULA_ABERTA | Válvula lógica aberta sem vazão suficiente |
| FLUXO_VALVULA_FECHADA | Vazão detectada com a válvula lógica fechada |
| TEMPO_MAXIMO_EXCEDIDO | Tempo máximo de abertura excedido |
| PARADA_EMERGENCIA | Parada de emergência acionada |

## Comandos

POST /api/comandos

| Código | Ação |
|---:|---|
| 1 | Parada de emergência |
| 2 | Resetar falha |
| 3 | Entrar no modo manual |
| 4 | Voltar ao modo automático |
| 5 | Abrir válvula no modo manual |
| 6 | Fechar válvula no modo manual |
| 7 | Atualizar somente a temperatura-alvo |

Exemplo:

~~~json
{"comando": 7, "temperaturaAlvo": 38.5}
~~~

O alvo permitido é de 20 a 70 °C. O código 7 exige temperaturaAlvo. A resposta traz o `id` do comando e a validade:

~~~json
{"mensagem": "Comando cadastrado", "id": 12, "validadeSegundos": 10}
~~~

### Validade dos comandos

Um comando que o ESP32 não buscar em 10 segundos é descartado: `GET /api/comandos` deixa de devolvê-lo. Isso impede que um comando antigo, como "abrir válvula", seja executado quando o ESP32 voltar de uma queda de Wi-Fi, talvez muito tempo depois. Comandos expirados também não bloqueiam os comandos seguintes na fila.

`GET /api/comandos/<id>` informa a situação do comando:

| situacao | Significado |
|---|---|
| pendente | Ainda pode ser buscado pelo ESP32, ou foi buscado no fim do prazo e aguarda a confirmação |
| avaliado | O ESP32 confirmou que avaliou o comando (aceito ou recusado pelos intertravamentos) |
| expirado | O ESP32 não buscou o comando dentro da validade; ele não será executado |

Um comando só aparece como expirado 5 segundos depois do fim da validade. Essa folga existe para o ESP32 confirmar um comando que buscou no último instante. Os dois prazos ficam em `api/database.py` (`VALIDADE_COMANDO_S` e `FOLGA_CONFIRMACAO_S`).

### Histórico

`GET /api/leituras?desde=<timestamp>` devolve as leituras a partir do horário Unix informado, em ordem cronológica. `limite` vai de 1 a 6000 (padrão 1000); se houver mais leituras, ficam as mais recentes. O dashboard usa essa rota para preencher os gráficos ao ser aberto.

## Regras principais

- Alvo padrão: 35 °C.
- Histerese: 2 °C. Abre ao atingir o alvo e fecha ao atingir alvo menos histerese.
- Controle e proteções são executados localmente no ESP32.
- A comunicação HTTP é chamada pelo loop principal, com timeout de 700 ms.
- valvulaAberta informa o estado lógico, não confirma movimento físico da válvula.
- A saída física do relé permanece desabilitada até validação elétrica e hidráulica.
- A confirmação significa que o serviço avaliou o comando; não significa necessariamente que o aceitou. O dashboard confere o efeito na telemetria seguinte.
- Comandos expiram em 10 s se o ESP32 não os buscar.
