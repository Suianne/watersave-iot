# 9. Testar a interface em diferentes dispositivos

**Objetivo:** o dashboard funciona e é legível no computador, no celular e no tablet.

**Pré-requisitos:** `npm run dev` rodando e os dispositivos na mesma rede (endereço `Network` do terminal), ou o dashboard publicado.

## Passos

Em cada dispositivo: abrir o dashboard, ler os indicadores, mudar a temperatura-alvo, enviar um comando com confirmação e rolar até os alertas.

| Dispositivo | Navegador | Largura | Tema |
|---|---|---|---|
| Notebook | Chrome ou Edge | 1280 px ou mais | claro e escuro |
| Celular Android | Chrome | ~390 px | claro e escuro |
| iPhone (se tiver) | Safari | ~390 px | claro |
| Tablet (se tiver) | qualquer | ~800 px | claro |

## Resultado esperado

- Nenhum tamanho de tela tem rolagem horizontal.
- No celular os cartões ficam empilhados e os botões têm pelo menos 40 px de altura.
- Os gráficos se ajustam à largura da tela.
- O tema escuro do sistema é respeitado, com contraste legível.
- Os diálogos de confirmação cabem na tela do celular.

Pré-teste: em 16/11/2026, a simulação foi conferida no Chromium a 1366 px e a 390 px, sem rolagem horizontal.

## Registro

| Data | Responsável | Fonte (simulação / ESP32) | Resultado | Evidência |
|---|---|---|---|---|
| | | | | |
