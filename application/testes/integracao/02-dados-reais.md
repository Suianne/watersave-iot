# 2. Receber e apresentar dados reais

**Objetivo:** verificar que os valores medidos pelo ESP32 chegam ao dashboard sem distorção.

**Pré-requisitos:** teste 1 aprovado; termômetro de referência e um recipiente graduado.

## Passos

1. Com o sistema em repouso, comparar a temperatura do dashboard com o termômetro de referência.
2. Comparar os valores publicados (temperatura, vazão, volume) com o Monitor Serial do Arduino IDE.
3. Abrir a válvula e conferir a vazão e o volume com o recipiente graduado.
4. Publicar um pacote inválido no tópico `watersave/estado` (ex.: pelo MQTT Explorer) com `"vazao": "abc"`.

## Resultado esperado

- Os valores do dashboard batem com os do Monitor Serial: 1 casa decimal na temperatura e na vazão, 2 no volume.
- A diferença para o termômetro de referência fica dentro da precisão do DS18B20 (±0,5 °C).
- O pacote inválido não altera os indicadores e aparece o aviso "Pacote fora do contrato de dados recebido".

**Automatizado:** `automatizados/contrato.test.ts` cobre a validação do formato dos pacotes.

## Registro

| Data | Responsável | Fonte (simulação / ESP32) | Resultado | Evidência |
|---|---|---|---|---|
| | | | | |
