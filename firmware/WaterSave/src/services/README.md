# Camada de serviço

Lógica de controle do WaterSave IoT: decide quando a válvula abre e fecha, mantém a máquina de estados, valida comandos e leituras, aplica as proteções e registra os eventos. Este documento explica como a camada funciona e por que cada escolha foi feita.

A camada não conhece pinos, Wi-Fi nem MQTT. Isso a mantém independente das camadas de percepção e de rede e permite testá-la no PC, sem hardware. O comportamento segue `docs/contrato-de-dados.md`, e o simulador do dashboard (`application/dashboard/transporte/simulado.ts`) serviu de referência para os testes.

## Funcionamento

```
percepção (sensores)  ->  Inputs  ->  WaterSaveService.update()  ->  valveShouldBeOpen()  ->  ValveController
                                              |
rede (comandos, alvo)  ->  handleCommand() / setTargetTemperature()
                                              |
                                  telemetry() / changeSequence() / log()  ->  rede, serial
```

A cada iteração do `loop()`, o `update()` executa nesta ordem:

1. Calcula o tempo desde a chamada anterior.
2. Valida a vazão e integra o volume transferido.
3. Registra a amostra de temperatura, se houver uma nova.
4. Executa o controle (estado, histerese, abertura e fechamento).
5. Executa as proteções. Qualquer falha fecha a válvula antes de registrar o alerta.

O serviço apenas decide. Quem aciona o relé é o `.ino`, que repassa o resultado ao `ValveController` quando o estado lógico muda.

### Uso pela camada de rede

```cpp
waterSave.handleCommand(codigo);                      // comandos 1 a 6, validados contra o estado atual
waterSave.setTargetTemperature(valor);                // 20 a 70 °C, grava na NVS só se mudou
const service::Telemetry t = waterSave.telemetry();   // campos do JSON de watersave/estado
waterSave.changeSequence();                           // mudou: publicar sem esperar os 2 s
```

`telemetry().temperatureValid == false` indica leitura inválida: enviar o valor bruto (`-127`) ou `null`, conforme o protocolo escolhido. O `loop()` não pode bloquear esperando Wi-Fi, porque o tempo máximo de abertura e as demais proteções dependem de `update()` rodar.

## Arquivos

| Arquivo | Papel |
|---|---|
| `WaterSaveService` | Máquina de estados, comandos e orquestração. É a única classe que a rede e o `.ino` usam |
| `HysteresisController` | Alvo configurável (20 a 70 °C) e decisão de abrir ou fechar |
| `SensorValidator` | Classifica a leitura do DS18B20 (válida, desconectado, inválida) e saneia a vazão |
| `SafetyMonitor` | Tempo máximo aberta, ausência de fluxo, fluxo com a válvula fechada |
| `EventLog` | Registro circular de 32 eventos |
| `TargetStore`, `NvsTargetStore` | Persistência do alvo (NVS no ESP32, memória nos testes) |
| `ServiceConfig.h` | Todos os limites e tempos num lugar só |
| `ServiceTypes` | Estados, comandos, alertas e telemetria, com os códigos do contrato |

## Escolhas de projeto

### 1. Temperatura-alvo configurável

- **Padrão de 35 °C**, conforme o contrato e o fluxograma da apresentação. O `Config.h` da percepção traz 25 °C, usado apenas pelo `ThermalControl`, que o `.ino` deixou de chamar.
- **Faixa de 20 a 70 °C.** O limite superior deixa margem para os 80 °C que o YF-S201 suporta. Valor fora da faixa, `NAN` ou infinito é recusado e o alvo anterior permanece.
- **Arredondamento para 0,1 °C**, para que o valor confirmado na telemetria seja o mesmo digitado no dashboard.
- **Persistência na NVS**, gravada apenas quando o valor muda, para não desgastar a flash. No boot, o alvo guardado é recuperado, e um valor corrompido ou fora da faixa é ignorado em favor do padrão.
- **Pode ser alterado em qualquer estado.** Se mudar com a válvula aberta, a histerese é reavaliada na hora.

### 2. Comparação entre temperatura atual e alvo

- A decisão usa a **última amostra válida** do DS18B20, com resolução de 12 bits (0,0625 °C).
- **Abertura exige duas leituras válidas seguidas.** É a mesma proposta de `VALID_READINGS_TO_REOPEN` do código da percepção. Evita abrir por uma leitura isolada ou logo depois de uma leitura inválida.
- **Fechamento exige uma leitura válida**, porque fechar é a direção segura.
- Sem leitura válida, o serviço não toma decisão de temperatura: a válvula permanece como está até a falha de sensor ser declarada (item 9).

### 3. Histerese

- **Valor fixo de 2 °C**, informado na telemetria no campo `histerese`. Não é configurável pelo usuário, o que mantém o contrato simples.
- A válvula **abre** com `temperatura >= alvo`, **fecha** com `temperatura <= alvo - histerese` e, entre os dois limites, **mantém o estado**. Com o alvo padrão, abre em 35 °C ou mais e fecha em 33 °C ou menos.
- A faixa evita aberturas e fechamentos repetidos quando a leitura oscila perto do alvo, como previsto na Obs.3 do documento de acompanhamento.

### 4. Algoritmo de abertura e fechamento

- Em `AGUARDANDO`, se a leitura é estável e a decisão da histerese é abrir, a válvula abre e o estado passa a `TRANSFERINDO`.
- Em `TRANSFERINDO`, se a decisão da histerese é fechar, a válvula fecha e o estado volta a `AGUARDANDO`.
- Qualquer falha passa por uma única função (`fail()`), que **fecha a válvula antes de registrar o alerta**.
- Em `FALHA` a válvula **não reabre sozinha**, mesmo com a água quente. Só sai por comando.

### 5. Máquina de estados

| Código | Estado | Válvula | Saídas possíveis |
|---|---|---|---|
| 0 | `INICIANDO` | fechada | primeira leitura válida para `AGUARDANDO`; falha de sensor para `FALHA` |
| 1 | `AGUARDANDO` | fechada | alvo atingido para `TRANSFERINDO`; comando manual; falha |
| 2 | `TRANSFERINDO` | aberta | fechamento pela histerese para `AGUARDANDO`; comando manual; falha |
| 3 | `MANUAL` | por comando | comando automático (com leitura válida) para `AGUARDANDO`; falha de fluxo ou tempo |
| 4 | `FALHA` | fechada | reset (com leitura válida) para `AGUARDANDO`; modo manual |

Os seis comandos (1 emergência, 2 resetar, 3 manual, 4 automático, 5 abrir, 6 fechar) são validados no firmware contra o estado atual, sem depender do bloqueio do dashboard. Comando desconhecido é recusado. Os códigos numéricos e os textos dos alertas são idênticos aos do contrato, e há teste automatizado para isso.

No modo manual, a falha do sensor de temperatura não bloqueia a válvula e fica apenas sinalizada no alerta. O tempo máximo e a checagem de fluxo continuam valendo.

**Reinicialização.** Após reiniciar a ESP32, a válvula fica fechada, o estado é `INICIANDO`, o volume zera e o alvo é recuperado da NVS. Uma falha anterior não persiste: se a causa continuar, ela é detectada de novo.

### 6. Cálculo da vazão

- A vazão instantânea em L/min é calculada pela camada de percepção (`FlowSensor`), a cada 1 s, a partir dos pulsos do YF-S201. O fator usado é o nominal de 7,5 Hz por L/min, **ainda não calibrado** neste protótipo.
- O serviço não recalcula: ele **valida e interpreta** o valor. Vazão `NAN`, infinita ou negativa é tratada como zero, o que no pior caso gera falha de ausência de fluxo e fecha a válvula.
- Limiares das proteções: menor que 0,2 L/min com a válvula aberta e maior que 0,5 L/min com a válvula fechada, em ambos os casos por mais de 5 s.

### 7. Cálculo do volume transferido

- O volume é a integral da vazão no tempo: `vazão (L/min) x intervalo (ms) / 60000`, acumulada em `double` para não perder precisão em somas longas.
- O intervalo é calculado por subtração sem sinal, o que continua correto quando o `millis()` volta a zero (a cada cerca de 49,7 dias). Há testes que cruzam essa virada durante a integração.
- O volume zera a cada reinicialização, conforme o contrato, e não é persistido.
- Como a vazão chega em janelas de 1 s, o volume pode ficar levemente abaixo do real logo após a abertura, e a calibração do sensor define a exatidão final.

### 8. Tempo máximo de abertura

- **120 s seguidos**, contados desde a abertura e zerados a cada nova abertura. A falha ocorre quando o tempo passa de 120 s.
- Ao estourar, a válvula fecha, o alerta `TEMPO_MAXIMO_EXCEDIDO` é registrado e o estado vai para `FALHA`.
- Vale também no modo manual.
- É um valor de segurança do contrato. Se a transferência do protótipo precisar de mais tempo, o ajuste é a constante `MAX_OPEN_TIME_MS`.

### 9. Validação das leituras dos sensores

**Temperatura (DS18B20).** O serviço recebe o valor bruto, porque o driver da percepção devolve `NAN` em qualquer leitura ruim e perderia a distinção entre os alertas.

| Leitura | Classificação | Alerta |
|---|---|---|
| -10 a 100 °C | válida | nenhum |
| -127 °C | sensor desconectado | `SENSOR_TEMP_DESCONECTADO` |
| fora da faixa, `NAN` ou infinito | inválida | `LEITURA_TEMP_INVALIDA` |
| 85,0 °C | inválida (valor de reset do DS18B20) | `LEITURA_TEMP_INVALIDA` |

- A falha só é declarada com **pelo menos 2 amostras inválidas seguidas e 1 s ou mais**. Como a amostra chega a 1 Hz, uma leitura ruim isolada não derruba o sistema.
- O 85,0 °C é tratado como inválido porque, além de ser o valor de reset do sensor, ficaria acima do alvo e abriria a válvula indevidamente.
- Resetar a falha e entrar no modo automático exigem leitura válida no momento do comando.

**Demais proteções:**

| Alerta | Condição |
|---|---|
| `SEM_FLUXO_VALVULA_ABERTA` | válvula aberta e vazão baixa por mais de 5 s |
| `FLUXO_VALVULA_FECHADA` | válvula fechada e vazão alta por mais de 5 s |
| `TEMPO_MAXIMO_EXCEDIDO` | válvula aberta por mais de 120 s |
| `PARADA_EMERGENCIA` | comando 1, aceito em qualquer estado |

## Registro de eventos

Estados, alertas, comandos aceitos ou recusados (com o motivo), abertura e fechamento da válvula e mudanças de alvo vão para um registro circular de 32 eventos em RAM. Os eventos mais antigos são sobrescritos, e `totalCount()` continua contando. O registro pode ser impresso na serial, como no exemplo de integração abaixo.

## Testes

Os 62 testes rodam no PC e passam também com AddressSanitizer e UBSan:

```bash
cd firmware/testes/services
make test        # compila com g++ e roda
make test-san    # o mesmo com sanitizers
```

Eles cobrem histerese, falhas de sensor e de fluxo, tempo máximo, comandos, reinício, persistência do alvo, registro de eventos e a virada do `millis()`. Os passos que só se fecham com a bancada montada estão em `firmware/testes/services/integracao.md`.

## Integração com a percepção

A camada de serviço funciona sem alterar nenhum arquivo da percepção. Para ligá-la ao hardware, são necessárias duas mudanças pequenas, entregues à parte no patch `integracao-percepcao.patch`:

- `TemperatureSensor` ganha o getter `getLastRawC()`, que expõe a leitura bruta para distinguir sensor desconectado de leitura inválida.
- O `loop()` do `WaterSave.ino` passa a chamar `waterSave.update()` e repassa a decisão ao `ValveController`.

Aplicação, a partir da raiz do repositório: `git apply --ignore-whitespace integracao-percepcao.patch`.

## Pendências e decisões abertas

- Validar tudo na bancada com a ESP32, os sensores e a válvula, seguindo `firmware/testes/services/integracao.md`.
- Habilitar a saída do relé (`PHYSICAL_OUTPUT_ENABLED`) somente após confirmar polaridade e corrente. Enquanto estiver desabilitada, ou sem água na bancada, o alerta de ausência de fluxo dispara em cerca de 5 s, como esperado.
- Calibrar o fator do YF-S201, do qual dependem a vazão e o volume.
- Confirmar com o grupo o alvo padrão de 35 °C, as duas amostras para falha de sensor, o tratamento do 85,0 °C e as duas leituras para abrir a válvula.
- A chave bypass do fluxograma não está no contrato nem no `Config.h`, por isso ficou fora desta camada.
