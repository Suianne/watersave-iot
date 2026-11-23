# Testes da API

## Testes automatizados

Os testes automatizados usam o cliente de testes do Flask e um SQLite temporário. Não precisam que a API esteja aberta e não alteram o banco real.

Na raiz do repositório:

~~~bash
python -m pytest -q
~~~

## Roteiros manuais

Os arquivos teste_comunicacao.py, teste_estabilidade.py, teste_recuperacao_api.py e testes_validacao.py são roteiros de integração manual. Eles dependem da API em execução; o teste de recuperação também pede que o operador pare e reinicie o servidor. Por isso, não são coletados automaticamente pelo pytest.
