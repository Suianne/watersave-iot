# 8. Validar os comandos do usuário e seus intertravamentos de segurança

**Objetivo:** só os comandos seguros para o estado atual ficam liberados, e o ESP32 obedece.

**Pré-requisitos:** válvula instalada e água no reservatório 1.

## Passos

1. No automático (aguardando), conferir quais botões estão liberados.
2. Clicar em **Modo manual**, confirmar e verificar que a válvula fecha.
3. Clicar em **Abrir válvula**, confirmar e verificar a água passando.
4. Clicar em **Fechar válvula**.
5. Clicar em **Modo automático**.
6. Com a válvula aberta no automático, clicar em **Parada de emergência**.
7. Desligar o Wi-Fi do ESP32 e tentar qualquer comando.
8. Com o sistema no automático, cadastrar o comando `5` (abrir) direto na API:
   `curl -X POST http://localhost:5000/api/comandos -H "Content-Type: application/json" -d '{"comando":5}'`
9. Com o ESP32 em falha, desligar o ESP32 e clicar em **Resetar falha** logo em seguida (antes de o selo virar **ESP32 offline**). Esperar 20 s e religar o ESP32.
10. No modo manual, clicar em **Modo automático** e, antes de o estado mudar, em **Abrir válvula**.

## Resultado esperado

- Passo 1: só **Parada de emergência** e **Modo manual** ficam liberados; os outros botões mostram o motivo do bloqueio.
- Passos 2 e 3 pedem confirmação. A de abrir avisa se houver alerta ativo.
- A parada de emergência não pede confirmação e fecha a válvula na hora.
- Passo 7: todos os botões bloqueados com "ESP32 offline".
- Passo 8: o **firmware** recusa e a válvula não abre. O dashboard não é a única barreira.
- Passo 9: em cerca de 15 s, o evento "Comando não entregue: Resetar falha" (a API descartou o comando). Ao religar, o ESP32 **não** executa o comando antigo: o Monitor Serial não mostra o comando.
- Passo 10: o modo automático é aplicado e o abrir é recusado pelo firmware, porque chega fora do modo manual. Aparece "O ESP32 não aplicou: Abrir válvula".

**Automatizado:** `automatizados/intertravamentos.test.ts` (todos os estados com todos os comandos) e `automatizados/interface.test.tsx` (botões).

## Registro

| Data | Responsável | Fonte (simulação / ESP32) | Resultado | Evidência |
|---|---|---|---|---|
| | | | | |
