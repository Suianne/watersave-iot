# Validação da camada de serviço com hardware

Estes roteiros cobrem a parte "Integração e validação" da camada de serviço, que só se fecha com a bancada montada. A lógica em si já é testada no PC (`make test`); aqui se confirma que o firmware real se comporta do mesmo jeito. Quando houver um teste que execute o passo, troque o roteiro pelo arquivo.

**Antes de começar:** saída do relé habilitada (`PHYSICAL_OUTPUT_ENABLED = true`) só depois de confirmar a polaridade de IN1 e a corrente, conforme `firmware/README.md`. Monitor serial em 115200 baud: os eventos aparecem como `[ms] ESTADO ...`, `ALERTA ...`, `VALVULA ...`.

## 1. Algoritmo com sensores reais

1. Ligar a ESP32 com o DS18B20 no reservatório 1 e o YF-S201 na tubulação.
2. Observar a linha de status (a cada 2 s).

**Esperado:** estado `AGUARDANDO` em cerca de 1 s, temperatura próxima da real, vazão `0.00`.

## 2. Abertura automática por temperatura e 3. Fechamento automático

1. Alvo em 35 °C (padrão). Aquecer o reservatório 1 até passar de 35 °C.
2. Depois da abertura, adicionar água fria até a leitura chegar a 33 °C.

**Esperado:** `VALVULA ABERTA` e `TRANSFERINDO` com duas leituras acima de 35 °C; `VALVULA FECHADA` e `AGUARDANDO` quando a leitura chegar a 33 °C ou menos.

## 4. Histerese

1. Com a válvula aberta, manter a água entre 33 e 35 °C por 30 s.

**Esperado:** a válvula não muda de estado dentro da faixa.

## 5. Encerramento por tempo

1. Manter a água acima de 35 °C com a válvula aberta por mais de 120 s.

**Esperado:** `ALERTA TEMPO_MAXIMO_EXCEDIDO`, válvula fechada, estado `FALHA`.

## 6. Falhas durante a operação

| Falha provocada | Esperado |
|---|---|
| Desconectar o DS18B20 por mais de 2 s | `SENSOR_TEMP_DESCONECTADO`, válvula fechada, `FALHA` |
| Fechar o registro manual com a válvula aberta | `SEM_FLUXO_VALVULA_ABERTA` em cerca de 5 s |
| Com a válvula fechada, soprar ou passar água pelo YF-S201 (por fora da válvula) por mais de 5 s | `FLUXO_VALVULA_FECHADA`, estado `FALHA` |
| Religar o DS18B20 e enviar o comando 2 (resetar) | volta para `AGUARDANDO` |

## 7. Mecanismos de segurança com a válvula física

1. Em cada falha acima, conferir no multímetro ou pelo som do relé que a válvula realmente fechou.
2. Reiniciar a ESP32 (botão EN) com a válvula aberta.

**Esperado:** a válvula fecha no reinício e o estado volta para `INICIANDO`. Anotar resets ou ruído na serial no momento em que a válvula desliga: o protótipo está sem diodo flyback.

## 8. Registros de eventos

1. Executar os passos 2 a 6.
2. Conferir na serial que cada mudança de estado, alerta, comando e abertura ou fechamento da válvula aparece uma vez, na ordem em que ocorreu.

## Registro

| Data | Responsável | Item | Resultado | Evidência |
|---|---|---|---|---|
| | | | | |
