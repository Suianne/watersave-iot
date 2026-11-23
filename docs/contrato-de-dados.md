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
~~~

O ESP32 envia telemetria e consulta comandos a cada 2 segundos. A API armazena leituras e mantém comandos pendentes até o firmware confirmar que os avaliou.

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | / | Verificar se a API está online |
| POST | /api/leituras | Receber telemetria |
| GET | /api/leituras/ultima | Consultar a leitura mais recente |
| GET | /api/comandos | Consultar comandos pendentes |
| POST | /api/comandos | Cadastrar comando |
| POST | /api/comandos/<id>/confirmar | Marcar comando como avaliado |

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

O alvo permitido é de 20 a 70 °C. O código 7 exige temperaturaAlvo.

## Regras principais

- Alvo padrão: 35 °C.
- Histerese: 2 °C. Abre ao atingir o alvo e fecha ao atingir alvo menos histerese.
- Controle e proteções são executados localmente no ESP32.
- A comunicação HTTP é chamada pelo loop principal, com timeout de 700 ms.
- valvulaAberta informa o estado lógico, não confirma movimento físico da válvula.
- A saída física do relé permanece desabilitada até validação elétrica e hidráulica.
- A confirmação significa que o serviço avaliou o comando; não significa necessariamente que o aceitou.
