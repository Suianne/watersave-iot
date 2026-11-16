# 5. Testar a exibição dos estados da válvula

**Objetivo:** o indicador da válvula precisa refletir o estado físico real.

**Pré-requisitos:** válvula instalada e visível, ou um LED em paralelo para ver o acionamento.

## Passos

1. Com a água fria, confirmar que a válvula está fechada no dashboard e fisicamente.
2. Aquecer a água até o alvo.
3. Resfriar a água abaixo de alvo menos histerese.
4. Acionar a parada de emergência com a válvula aberta.
5. Entrar no modo manual e abrir a válvula pelo dashboard.

## Resultado esperado

- Água fria: "Fechada / Controle automático por temperatura".
- No alvo: "Aberta", área azul no gráfico de vazão e evento "Válvula aberta".
- Abaixo da faixa: "Fechada" e evento "Válvula fechada".
- Emergência: "Fechada / Bloqueada fechada por falha".
- Manual: "Aberta / Controle manual pelo dashboard".
- Em todos os casos o dashboard acompanha o estado físico em até 2 s.

**Automatizado:** `automatizados/interface.test.tsx` (textos de cada estado).

## Registro

| Data | Responsável | Fonte (simulação / ESP32) | Resultado | Evidência |
|---|---|---|---|---|
| | | | | |
