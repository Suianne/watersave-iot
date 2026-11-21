# WaterSave — Camada de Rede

Este diretório contém a API HTTP/REST, o banco SQLite, o firmware de teste da camada de rede e os testes executados no computador.

## 1. O que está implementado

- API REST em Flask, executada na porta `5000`.
- Recebimento de leituras em `POST /api/leituras`.
- Cadastro de comandos em `POST /api/comandos`.
- Consulta de comandos pendentes em `GET /api/comandos`.
- Confirmação de comandos em `POST /api/comandos/<id>/confirmar`.
- Comunicação com JSON.
- Persistência em SQLite (`api/watersave.db`).
- Firmware de teste com Wi-Fi, reconexão periódica, envio de leituras simuladas e consulta de comandos.
- Testes de validação, comunicação, persistência, estabilidade e recuperação da API.

O protocolo adotado neste projeto é **HTTP/REST**. Não é utilizada integração com Arduino IoT Cloud.

## 2. Executar a API no computador

Abra um terminal PowerShell na pasta principal `Watersave` e execute:

```powershell
py -m pip install -r .\api\requirements.txt
cd .\api
py app.py
```

A API ficará disponível em:

```text
http://127.0.0.1:5000
```

A rota inicial deve responder com `status: online`.

**Importante:** mantenha esse terminal aberto enquanto executar os testes e enquanto a ESP32 estiver se comunicando com o computador.

## 3. Executar os testes no computador

Com a API em execução, abra outro PowerShell na pasta principal `Watersave`.

Execute:

```powershell
py .\tests\teste_comunicacao.py
py .\tests\testes_validacao.py
py .\tests\teste_estabilidade.py
py .\tests\teste_persistencia.py
```

Resultados esperados:

- Comunicação: envio de leitura, cadastro, consulta e confirmação de comando aprovados.
- Validação: dados incompletos e inválidos rejeitados.
- Estabilidade: `100` envios, `100` sucessos e `0` falhas.
- Persistência: tabelas criadas, leitura e comando gravados e dados preservados após reinicialização.

### Teste de recuperação da API

Esse teste é interativo:

```powershell
py .\tests\teste_recuperacao_api.py
```

Siga as instruções exibidas pelo próprio teste: interrompa a API com `CTRL+C`, confirme no terminal do teste, inicie novamente a API e confirme quando ela estiver online. O teste verifica se a API voltou a responder e se aceita uma nova leitura.

Esse teste verifica a recuperação após a **indisponibilidade da API**. Ele não substitui o teste de perda e reconexão do Wi-Fi feito com a ESP32.

## 4. Preparar o firmware para a ESP32

Arquivos:

- `firmware/WaterSave_Rede_Test.ino`
- `firmware/Config.h`

Antes de enviar o firmware para a placa, abra `Config.h` e altere:

```cpp
#define WIFI_SSID "NOME_DA_REDE"
#define WIFI_PASSWORD "SENHA_DA_REDE"
#define API_BASE_URL "http://192.168.0.100:5000"
```

Preencha com:

- Nome e senha da rede Wi-Fi que será usada pela placa.
- Endereço IPv4 do computador que está executando a API.

Para descobrir o IPv4 no Windows, execute `ipconfig` e procure o endereço IPv4 do adaptador conectado à mesma rede Wi-Fi da ESP32.

**Não use `127.0.0.1` nem `localhost` em `API_BASE_URL`: esses endereços apontam para a própria placa, não para o computador.**

O computador e a ESP32 precisam estar na mesma rede. Se o Firewall do Windows bloquear a conexão, autorize o Python na rede privada.

No Arduino IDE:

1. Instale o suporte à placa ESP32, caso ainda não esteja instalado.
2. Instale a biblioteca `ArduinoJson` pelo Gerenciador de Bibliotecas.
3. Abra `WaterSave_Rede_Test.ino`.
4. Selecione a placa ESP32 correspondente ao modelo físico utilizado.
5. Selecione a porta serial da placa.
6. Envie o código.
7. Abra o Monitor Serial em `115200` baud.

Mantenha a API em execução no computador durante o teste.

## 5. O que o firmware de teste faz

O firmware atual:

- tenta conectar à rede Wi-Fi;
- detecta quando perde a conexão;
- tenta reconectar periodicamente;
- envia um JSON de leitura a cada `2` segundos enquanto estiver conectado;
- consulta os comandos pendentes na API;
- atualiza a variável simulada `temperaturaAlvo` quando o comando contém esse campo;
- exibe os códigos de comando recebidos no Monitor Serial;
- confirma o comando na API.

Os valores de temperatura, vazão, volume, estado e válvula são **simulados e fixos** neste firmware. Eles servem para verificar o transporte dos dados, não representam leituras reais dos sensores.

### Enviar um comando de teste

Com a API e o firmware em execução, use outro PowerShell:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/comandos" -Method Post -ContentType "application/json" -Body '{"temperaturaAlvo":38.0,"comando":4}'
```

O firmware consulta a fila periodicamente. O comando deve aparecer no Monitor Serial e ser confirmado pela API.

Códigos definidos no contrato:

| Código | Comando |
|---:|---|
| 1 | Emergência |
| 2 | Resetar falha |
| 3 | Modo manual |
| 4 | Modo automático |
| 5 | Abrir válvula |
| 6 | Fechar válvula |

## 6. Limites deste firmware de teste

Este arquivo testa a **camada de rede**. Ele não lê o DS18B20, não calcula a vazão do YF-S201 e não aciona fisicamente a válvula.

No firmware de teste, a confirmação do comando significa que ele foi recebido e exibido pelo código de rede. Na integração definitiva, a confirmação deve ocorrer somente depois que a camada responsável pelo controle informar que o comando foi tratado. A recepção de um comando de abrir/fechar válvula, por si só, não movimenta a válvula neste firmware.

## 7. O que ainda precisa ser validado na placa

Quando o integrante estiver com a ESP32:

- conexão à rede Wi-Fi real;
- comunicação ESP32 → computador/API;
- perda e recuperação do Wi-Fi;
- recebimento dos comandos pelo firmware;
- integração com os sensores e com a válvula;
- funcionamento do controle local sem internet, junto às demais camadas.

Os testes executados no computador validam a API e a comunicação HTTP simulada. 