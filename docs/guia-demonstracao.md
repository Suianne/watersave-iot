# Guia rápido de demonstração do WaterSave

## Objetivo

Demonstrar que o protótipo mede temperatura e vazão, decide localmente quando a água atingiu o alvo e disponibiliza os dados e comandos pela rede.

## Antes da aula

1. Conecte DS18B20 e YF-S201 à ESP32.
2. Mantenha a válvula desconectada ou a saída do relé desabilitada.
3. Configure Wi-Fi e endereço da API em NetworkConfig.h.
4. Conecte computador e ESP32 à mesma rede.
5. Inicie a API:

   ~~~bash
   cd api
   python app.py
   ~~~

6. Grave firmware/WaterSave/WaterSave.ino na ESP32 e abra o Monitor Serial em 115200 baud.

## Roteiro

1. Mostre no Monitor Serial temperatura, alvo, vazão e estado.
2. Aproxime o sensor de uma fonte de calor controlada, sem molhar conexões nem ultrapassar os limites do sensor.
3. Explique a histerese: com alvo de 35 °C e histerese de 2 °C, a lógica abre ao atingir 35 °C e fecha ao cair para 33 °C.
4. Mostre a mudança do estado lógico da válvula no firmware.
5. Consulte GET http://localhost:5000/api/leituras/ultima para mostrar a telemetria armazenada.
6. Cadastre um ajuste de alvo:

   ~~~bash
   curl -X POST http://localhost:5000/api/comandos \
     -H "Content-Type: application/json" \
     -d '{"comando":7,"temperaturaAlvo":38}'
   ~~~

7. Mostre no Monitor Serial o recebimento e a avaliação do comando.

## Endpoints úteis

- GET http://localhost:5000/ — verificar API.
- GET http://localhost:5000/api/leituras/ultima — última leitura.
- GET http://localhost:5000/api/comandos — comandos pendentes.

## O que explicar ao professor

- O controle e as proteções ficam no ESP32; a API não decide o acionamento.
- A comunicação usa HTTP/REST e SQLite, sem broker MQTT.
- A arquitetura tem quatro responsabilidades: percepção, controle, comunicação e armazenamento.
- A saída física do relé está desabilitada nesta etapa. A demonstração comprova leitura, decisão lógica e comunicação, não o acionamento hidráulico real.

## Limitação

As chamadas HTTP são síncronas e podem pausar brevemente o loop. Isso foi escolhido para simplificar o fluxo do protótipo. Uma versão futura pode separar a comunicação em uma tarefa se a frequência de controle exigir.
