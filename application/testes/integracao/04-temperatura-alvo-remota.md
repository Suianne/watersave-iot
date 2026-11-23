# 4. Testar a configuração remota da temperatura-alvo

**Objetivo:** alterar a temperatura-alvo pelo dashboard e confirmar que o ESP32 passa a usá-la.

**Pré-requisitos:** dashboard recebendo dados do ESP32.

## Passos

1. Digitar `38,5` no campo da temperatura-alvo e clicar em **Aplicar**.
2. Digitar `90` e clicar em **Aplicar**.
3. Reiniciar o ESP32 e observar o alvo depois que ele voltar.
4. Aquecer a água até o novo alvo.

## Resultado esperado

- Passo 1: aparece "aguardando o ESP32" e, em até 2 s, o indicador mostra 38,5 °C. O valor exibido vem da telemetria, não do campo.
- Passo 2: mensagem "Use um valor entre 20 e 70 °C." e nada é enviado.
- Passo 3: o alvo continua 38,5 °C (tópico retido ou NVS).
- Passo 4: a válvula abre em 38,5 °C e fecha em 36,5 °C (alvo menos a histerese).
- Se o ESP32 não confirmar em 6 s, aparece o evento "Sem confirmação do ESP32".

**Automatizado:** `automatizados/intertravamentos.test.ts` (validação do valor) e `automatizados/interface.test.tsx` (campo e envio).

## Registro

| Data | Responsável | Fonte (simulação / ESP32) | Resultado | Evidência |
|---|---|---|---|---|
| | | | | |
