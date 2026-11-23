# 1. Integrar o dashboard à plataforma IoT

**Objetivo:** confirmar que o dashboard conecta no broker MQTT e enxerga o ESP32.

**Pré-requisitos:** broker configurado (HiveMQ Cloud ou público), firmware publicando conforme `docs/contrato-de-dados.md`.

## Passos

1. Rodar `npm run dev` e abrir o dashboard.
2. Em **Fonte de dados**, escolher **ESP32 real via MQTT** e preencher endereço WebSocket, usuário, senha e prefixo.
3. Ligar o ESP32.
4. Desligar o ESP32 da tomada e esperar até 1 minuto.

## Resultado esperado

- Selo **Broker: conectado** em verde logo depois de salvar.
- Selo **ESP32 online** e evento "Primeiros dados recebidos do ESP32" depois de ligar o ESP32.
- Ao desligar o ESP32, o Last Will publica `online = 0`: selo **ESP32 offline**, banner de offline e comandos bloqueados.
- Com senha errada, o selo do broker fica vermelho ("erro") e a página não trava.

## Registro

| Data | Responsável | Fonte (simulação / ESP32) | Resultado | Evidência |
|---|---|---|---|---|
| | | | | |
