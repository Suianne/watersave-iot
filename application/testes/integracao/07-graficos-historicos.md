# 7. Testar a atualização dos gráficos históricos

**Objetivo:** os gráficos de temperatura e de vazão mostram a evolução correta no tempo.

**Pré-requisitos:** dashboard recebendo dados há pelo menos 5 minutos.

## Passos

1. Fazer um ciclo completo: água quente (abre) e depois água fria (fecha).
2. Alternar o período entre 5 min, 15 min, 1 h e Tudo.
3. Derrubar o Wi-Fi do ESP32 por 30 s e religar.
4. Recarregar a página (F5).
5. Com o ESP32 ligado, fechar o dashboard por 2 minutos e abrir de novo (ou abrir em outro aparelho).

## Resultado esperado

- Gráfico de temperatura: a curva sobe, cruza a linha tracejada vermelha (abre) e depois a pontilhada azul (fecha).
- Gráfico de vazão: área azul nos períodos de válvula aberta, com a vazão próxima da medida.
- Trocar o período muda o recorte do eixo de tempo.
- A queda de Wi-Fi aparece como um buraco nas linhas, sem reta ligando os pontos.
- Depois do F5 o histórico continua lá, porque fica guardado no navegador.
- Passo 5: os gráficos já abrem com os 2 minutos em que o dashboard ficou fechado, carregados da API (últimas 3 h).

**Automatizado:** `automatizados/historico-eventos.test.ts` (lacunas, limite de pontos e recorte por período).

## Registro

| Data | Responsável | Fonte (simulação / ESP32) | Resultado | Evidência |
|---|---|---|---|---|
| | | | | |
