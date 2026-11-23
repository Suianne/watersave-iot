# Testes da camada de aplicação

Seguindo a Obs.4: cada teste de "Integração e testes" da camada de aplicação tem um roteiro em markdown
em `integracao/`. O que já dá para automatizar está em `automatizados/` e roda com:

```bash
cd application
npm test
```

| # | Teste do planejamento | Automatizado | Roteiro manual | Situação |
|---|---|---|---|---|
| 1 | Integrar o dashboard à plataforma IoT | `transporte-http.test.ts` | [01](integracao/01-integrar-plataforma-iot.md) | Parcial (API + ESP32 simulado) |
| 2 | Receber e apresentar dados reais | `contrato.test.ts` (formato dos dados) | [02](integracao/02-dados-reais.md) | Parcial |
| 3 | Validar a atualização dos indicadores | `interface.test.tsx` | [03](integracao/03-atualizacao-indicadores.md) | Parcial |
| 4 | Testar a configuração remota da temperatura-alvo | `intertravamentos.test.ts`, `interface.test.tsx` | [04](integracao/04-temperatura-alvo-remota.md) | Parcial |
| 5 | Testar a exibição dos estados da válvula | `interface.test.tsx` | [05](integracao/05-estados-valvula.md) | Parcial |
| 6 | Validar os alertas de falhas | `historico-eventos.test.ts`, `simulador.test.ts` | [06](integracao/06-alertas-falhas.md) | Parcial |
| 7 | Testar a atualização dos gráficos históricos | `historico-eventos.test.ts` | [07](integracao/07-graficos-historicos.md) | Parcial |
| 8 | Validar os comandos do usuário e seus intertravamentos | `intertravamentos.test.ts`, `interface.test.tsx` | [08](integracao/08-comandos-intertravamentos.md) | Parcial |
| 9 | Testar a interface em diferentes dispositivos | — | [09](integracao/09-diferentes-dispositivos.md) | Pendente |

**Parcial** = a lógica já está coberta por testes automatizados e validada no modo simulação ou com a API e
o ESP32 simulado; falta repetir o roteiro com o ESP32 real.

## Arquivos automatizados

- `contrato.test.ts`: validação dos pacotes recebidos do ESP32 e regra de histerese.
- `intertravamentos.test.ts`: quais comandos são liberados em cada estado, confirmações e validação da temperatura-alvo.
- `simulador.test.ts`: comportamento esperado do firmware (histerese, proteções, reinício). Serve de referência para a camada de serviço.
- `historico-eventos.test.ts`: lacunas nos gráficos quando o Wi-Fi cai e registro de ocorrências.
- `interface.test.tsx`: indicadores, estados da válvula, campo da temperatura-alvo e painel de comandos.
- `transporte-http.test.ts`: comunicação com a API REST (leituras, histórico, presença do ESP32, situação dos comandos e falhas de conexão), contra uma API falsa.

Os testes da API em si (validade dos comandos, histórico) ficam em `tests/test_api.py`, na raiz, e rodam com `python -m pytest -q`.

## ESP32 simulado

`esp32_simulado.py` faz o papel do ESP32 junto da API de verdade: envia leituras a cada 2 s, busca os
comandos e aplica as regras do contrato de dados. Com ele dá para executar os roteiros sem o hardware:

```bash
python application/testes/esp32_simulado.py            # API em http://127.0.0.1:5000
python application/testes/esp32_simulado.py --api http://192.168.0.10:5000
```

## Como registrar um teste manual

Preencha a tabela **Registro** no fim do roteiro com data, quem executou, o resultado (passou ou falhou)
e a evidência (print ou vídeo em `testes/evidencias/`).
