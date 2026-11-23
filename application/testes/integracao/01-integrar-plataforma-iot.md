# 1. Integrar o dashboard à plataforma IoT

**Objetivo:** confirmar que o dashboard conversa com a API REST e enxerga o ESP32.

**Pré-requisitos:** API rodando (`cd api && python app.py`) e firmware com o `API_BASE_URL` apontando para o
computador da API, conforme `docs/contrato-de-dados.md`. Sem o ESP32, dá para fazer os passos 1 a 5 com
`python application/testes/esp32_simulado.py` no lugar dele.

## Passos

1. Rodar `npm run dev` e abrir o dashboard.
2. Em **Fonte de dados**, escolher **ESP32 real pela API**, conferir o endereço (porta 5000 do computador da
   API) e clicar em **Salvar e conectar**, com o ESP32 ainda desligado.
3. Ligar o ESP32.
4. Desligar o ESP32 da tomada e esperar 15 s.
5. Parar a API (Ctrl+C no terminal dela) e depois iniciá-la de novo.
6. Em **Fonte de dados**, trocar o endereço por um errado (ex.: porta 5001).

## Resultado esperado

- Passo 2: selos **API online** e **ESP32 offline**, "Sem dados ainda".
- Passo 3: selo **ESP32 online** e o evento "Primeiros dados recebidos do ESP32" em até 3 s depois do
  primeiro envio do ESP32.
- Passo 4: depois de 10 s sem leitura nova, selo **ESP32 offline**, banner de offline, evento "ESP32 ficou
  offline" e comandos bloqueados.
- Passo 5: selo **API offline** e o aviso "Sem conexão com a API" com o endereço usado. Ao reiniciar a API,
  tudo volta sozinho, sem recarregar a página.
- Passo 6: o mesmo aviso do passo 5, e a página não trava.

**Automatizado:** `automatizados/transporte-http.test.ts` cobre a consulta, a presença do ESP32 e as falhas
de conexão contra uma API falsa.

## Registro

| Data | Responsável | Fonte (simulação / ESP32) | Resultado | Evidência |
|---|---|---|---|---|
| | | | | |
