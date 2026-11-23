# Firmware — WaterSave IoT

Firmware da camada de percepção e controle local do protótipo WaterSave.

## Plataforma de referência

- Placa de desenvolvimento: ESP32-PICO-KIT V4.1.
- Ambiente: Arduino IDE.
- Placa temporária usada em testes anteriores: ESP32-S3.

## Estrutura

```text
firmware/
├── WaterSave/
│   ├── WaterSave.ino
│   └── src/
│       ├── config/Config.h
│       ├── sensors/
│       │   ├── TemperatureSensor.h
│       │   ├── TemperatureSensor.cpp
│       │   ├── FlowSensor.h
│       │   └── FlowSensor.cpp
│       ├── actuators/
│       │   ├── ValveController.h
│       │   └── ValveController.cpp
│       └── control/
│           ├── ThermalControl.h
│           └── ThermalControl.cpp
└── testes/
    └── perception/
        ├── test_ds18b20/
        ├── test_yfs201/
        └── test_relay_valve/
```

Os testes independentes ficam fora do sketch principal e podem ser abertos individualmente no Arduino IDE.

## Bibliotecas

Instalar pelo Library Manager do Arduino IDE:

- OneWire (Paul Stoffregen).
- DallasTemperature (Miles Burton).

As bibliotecas padrão do core ESP32 fornecem GPIO, interrupções e temporização.

## Parâmetros implementados

| Parâmetro | Valor |
|---|---:|
| DS18B20 | 12 bits |
| Intervalo de leitura da temperatura | 1000 ms |
| Tempo de conversão considerado | 750 ms |
| Temperatura-alvo | 25 °C |
| Histerese | 2 °C |
| Fechamento térmico | 23 °C |
| YF-S201 — intervalo de vazão | 1000 ms |
| YF-S201 — fator inicial | 7,5 Hz/(L/min) |
| Ausência de pulsos na janela | 0 L/min |
| GPIO DS18B20 | 4 (em validação) |
| GPIO YF-S201 | 27 (em validação) |
| GPIO relé | 26 (em validação) |

A conversão do DS18B20 é não bloqueante para que a contagem de pulsos do YF-S201 continue durante a aquisição da temperatura.

## Segurança: saída do relé

A saída física do relé está **desabilitada por padrão** em `src/config/Config.h`:

`ValveConfig::PHYSICAL_OUTPUT_ENABLED = false`

O módulo JQC3F-03VDC-C respondeu ao teste com alimentação de 3,3 V da ESP32-S3, mas a polaridade de IN1 e a corrente consumida ainda não foram confirmadas. Não habilitar a saída até validar esses dados na placa real.

A válvula é de 12 V e normalmente fechada. A decisão atual do protótipo é não instalar diodo flyback externo; essa escolha mantém o risco de sobretensão indutiva na desenergização da bobina e deve ser reavaliada se houver instabilidade, interferência ou desgaste dos contatos.

## Pendências antes da montagem integrada

- Confirmar a revisão física da ESP32-PICO-KIT e validar os GPIOs 4, 27 e 26.
- Confirmar o tipo de saída do YF-S201 e definir o condicionamento para garantir nível lógico máximo de 3,3 V.
- Verificar se a saída de 5 V da placa suporta o sensor de vazão.
- Confirmar corrente do módulo relé e compatibilidade de IN1 com 3,3 V.
- Confirmar corrente nominal da válvula e capacidade da fonte de 12 V.
- Confirmar polaridade ativa do relé antes de habilitar a saída física.
- Reavaliar a proteção contra transientes da bobina durante os testes físicos.
- Calibrar o fator do YF-S201 durante os testes físicos, com procedimento simples.
- Validar a leitura do DS18B20 com os testes físicos.

## Observação de escopo

O firmware mede somente a vazão instantânea. O volume acumulado não faz parte desta implementação.
