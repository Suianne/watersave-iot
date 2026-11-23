# Testes da camada de aplicação

Seguindo a Obs.4: cada teste de "Integração e testes" da camada de aplicação tem um roteiro em markdown
em `integracao/`. O que já dá para automatizar está em `automatizados/` e roda com:

```bash
cd application
npm test
```

| # | Teste do planejamento | Automatizado | Roteiro manual | Situação |
|---|---|---|---|---|
| 1 | Integrar o dashboard à plataforma IoT | — | [01](integracao/01-integrar-plataforma-iot.md) | Pendente (broker + ESP32) |
| 2 | Receber e apresentar dados reais | `contrato.test.ts` (formato dos dados) | [02](integracao/02-dados-reais.md) | Parcial |
| 3 | Validar a atualização dos indicadores | `interface.test.tsx` | [03](integracao/03-atualizacao-indicadores.md) | Parcial |
| 4 | Testar a configuração remota da temperatura-alvo | `intertravamentos.test.ts`, `interface.test.tsx` | [04](integracao/04-temperatura-alvo-remota.md) | Parcial |
| 5 | Testar a exibição dos estados da válvula | `interface.test.tsx` | [05](integracao/05-estados-valvula.md) | Parcial |
| 6 | Validar os alertas de falhas | `historico-eventos.test.ts`, `simulador.test.ts` | [06](integracao/06-alertas-falhas.md) | Parcial |
| 7 | Testar a atualização dos gráficos históricos | `historico-eventos.test.ts` | [07](integracao/07-graficos-historicos.md) | Parcial |
| 8 | Validar os comandos do usuário e seus intertravamentos | `intertravamentos.test.ts`, `interface.test.tsx` | [08](integracao/08-comandos-intertravamentos.md) | Parcial |
| 9 | Testar a interface em diferentes dispositivos | — | [09](integracao/09-diferentes-dispositivos.md) | Pendente |

**Parcial** = a lógica já está coberta por testes automatizados e validada no modo simulação; falta
repetir o roteiro com o ESP32 real.

## Arquivos automatizados

- `contrato.test.ts`: validação dos pacotes recebidos do ESP32 e regra de histerese.
- `intertravamentos.test.ts`: quais comandos são liberados em cada estado, confirmações e validação da temperatura-alvo.
- `simulador.test.ts`: comportamento esperado do firmware (histerese, proteções, reinício). Serve de referência para a camada de serviço.
- `historico-eventos.test.ts`: lacunas nos gráficos quando o Wi-Fi cai e registro de ocorrências.
- `interface.test.tsx`: indicadores, estados da válvula, campo da temperatura-alvo e painel de comandos.

## Como registrar um teste manual

Preencha a tabela **Registro** no fim do roteiro com data, quem executou, o resultado (passou ou falhou)
e a evidência (print ou vídeo em `testes/evidencias/`).
