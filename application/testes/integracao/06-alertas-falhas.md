# 6. Validar os alertas de falhas

**Objetivo:** cada falha detectada pelo firmware precisa aparecer no banner e no registro de ocorrências.

**Pré-requisitos:** dashboard recebendo dados. Para testar com a aba em segundo plano, clicar em "Ativar notificações" (só funciona em localhost ou HTTPS).

## Passos

| Falha | Como provocar no hardware | Na simulação |
|---|---|---|
| Sensor desconectado | soltar o fio de dados do DS18B20 | "Desconectar o DS18B20" |
| Válvula aberta sem fluxo | fechar o registro manual com a válvula aberta | "Entupir a mangueira" |
| Fluxo com válvula fechada | abrir o registro com a válvula fechada e pressão antes dela | "Vazamento na válvula" |
| Tempo máximo | manter a água quente por mais de 120 s | igual |
| Parada de emergência | botão do dashboard | igual |

Para cada falha: provocar, observar o dashboard, corrigir a causa e clicar em **Resetar falha**.

## Resultado esperado

- Banner vermelho com o título e a explicação da falha; estado "Falha"; válvula "Fechada".
- Evento de nível **Falha** no registro, com o horário.
- Com a aba em segundo plano e as notificações ativas, chega uma notificação do navegador.
- Depois de resetar: evento "Alerta resolvido: …" e estado "Aguardando temperatura".
- Com o sensor ainda desconectado, o reset fica bloqueado e o motivo aparece abaixo do botão.

**Automatizado:** `automatizados/simulador.test.ts` (detecção das falhas) e `automatizados/historico-eventos.test.ts` (registro).

## Registro

| Data | Responsável | Fonte (simulação / ESP32) | Resultado | Evidência |
|---|---|---|---|---|
| | | | | |
