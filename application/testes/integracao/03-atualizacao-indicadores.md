# 3. Validar a atualização dos indicadores

**Objetivo:** garantir que os indicadores acompanham a telemetria e avisam quando os dados ficam velhos.

**Pré-requisitos:** dashboard recebendo dados (simulação ou ESP32).

## Passos

1. Observar o selo "Atualizado há X s" por 30 s.
2. Aquecer a água (na simulação, "Adicionar água quente") e acompanhar a temperatura.
3. Desligar o Wi-Fi do ESP32 (na simulação, "Derrubar o Wi-Fi por 15 s").
4. Religar e esperar a reconexão.

## Resultado esperado

- Com o ESP32 online, o selo nunca passa de uns 3 s (a publicação é a cada 2 s).
- A temperatura e a frase da faixa de histerese mudam conforme a água aquece.
- Sem dados por mais de 10 s: valores esmaecidos, banner "ESP32 offline" ou "Dados desatualizados" e comandos bloqueados.
- Na volta, evento "ESP32 voltou a ficar online" e indicadores normais em até 2 s.

**Automatizado:** `automatizados/interface.test.tsx` (formatação dos indicadores e aviso de dados desatualizados).

## Registro

| Data | Responsável | Fonte (simulação / ESP32) | Resultado | Evidência |
|---|---|---|---|---|
| | | | | |
