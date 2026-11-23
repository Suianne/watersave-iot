# Firmware WaterSave

Sketch integrado para a placa ESP32-WROOM, desenvolvido na Arduino IDE.

## O que faz

- Lê temperatura com o DS18B20.
- Mede vazão com o YF-S201.
- Executa controle automático com alvo padrão de 35 °C e histerese de 2 °C.
- Aplica as proteções da camada de serviço.
- Envia telemetria à API e consulta comandos por HTTP.

## Camadas

~~~text
Sensores -> WaterSaveService -> ValveController
                  |
                  +----------> NetworkManager -> API Flask
~~~

- sensors: leitura dos sensores.
- services: controle, estados, validação e segurança.
- actuators: acionamento lógico do relé.
- network: conexão Wi-Fi e chamadas HTTP.

A comunicação é executada pelo próprio loop principal, sem filas ou tarefa FreeRTOS dedicada. Isso deixa o fluxo mais simples para acompanhar durante a demonstração. As requisições HTTP são síncronas e podem pausar brevemente o loop; esta versão é voltada ao protótipo didático, não a uma instalação de produção.

## Preparar a Arduino IDE

Instale pelo Library Manager:

- OneWire
- DallasTemperature
- ArduinoJson 7.4.3

Abra firmware/WaterSave/WaterSave.ino e selecione a placa ESP32-WROOM correspondente.

## Configurar a rede

Edite localmente src/network/NetworkConfig.h:

- WIFI_SSID: nome da rede.
- WIFI_PASSWORD: senha da rede.
- API_BASE_URL: IP do computador que executa a API, por exemplo http://192.168.1.10:5000.

Não publique credenciais reais no GitHub. O computador e o ESP32 precisam estar na mesma rede.

## Pinos de referência

| Componente | GPIO |
|---|---:|
| DS18B20 DATA | 4 |
| YF-S201 SIGNAL | 27 |
| Relé IN1 | 26 |

Confirme os GPIOs na placa utilizada e confira o diagrama de ligação antes de energizar o circuito.

## Segurança

A saída física do relé permanece desabilitada em src/config/Config.h (PHYSICAL_OUTPUT_ENABLED = false). Assim, os testes de software e a demonstração serial/API podem ocorrer sem acionar a válvula.

Não habilite o relé antes de verificar tensão, corrente, polaridade, compatibilidade elétrica, proteção contra transientes e funcionamento hidráulico. O campo valvulaAberta da API representa a decisão lógica do serviço, não uma confirmação física.
