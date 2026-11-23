# WaterSave IoT

Protótipo para monitorar a temperatura e a vazão da água e controlar uma válvula de desvio quando a água atingir a temperatura desejada.

## Como funciona

1. O DS18B20 mede a temperatura.
2. O YF-S201 mede a vazão.
3. O ESP32 aplica a regra de temperatura com histerese e decide o estado lógico da válvula.
4. A API Flask recebe as leituras e guarda os dados em SQLite.
5. A API também recebe comandos para alterar o alvo ou o modo de operação. Um comando que o ESP32 não buscar em 10 s é descartado.
6. O dashboard (pasta application/) mostra os dados em tempo real, os gráficos e os alertas, e envia os comandos pela API.

O controle principal fica no ESP32. A API não decide quando a válvula deve abrir ou fechar.

## Camadas

| Camada | Responsabilidade |
|---|---|
| Percepção | Ler temperatura e vazão |
| Controle | Aplicar histerese, estados e proteções |
| Comunicação | Enviar leituras e consultar comandos via HTTP |
| API e dados | Validar, armazenar e disponibilizar informações |
| Aplicação | Dashboard web com indicadores, gráficos, alertas e comandos |

## Executar no computador

~~~bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
python -m pytest -q
~~~

Iniciar a API:

~~~bash
cd api
python app.py
~~~

Iniciar o dashboard (precisa do Node.js 22 ou mais novo):

~~~bash
cd application
npm install
npm run dev
~~~

No dashboard, escolha Fonte de dados → ESP32 real pela API. Sem o ESP32, `python application/testes/esp32_simulado.py` faz o papel dele junto da API. Detalhes em application/README.md.

Consulte firmware/README.md para configurar o ESP32 e docs/guia-demonstracao.md para seguir a apresentação.

## Segurança

A saída física do relé permanece desabilitada por padrão. Não conecte a válvula nem habilite o relé antes de confirmar alimentação, corrente, polaridade, proteção elétrica e ligações hidráulicas.
