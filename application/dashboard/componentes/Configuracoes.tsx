import { useState } from 'react'
import { urlApiPadrao, type Configuracao, type TipoFonte } from '../configuracao'
import { Dialogo } from './Dialogo'

interface Props {
  configuracao: Configuracao
  aoSalvar: (configuracao: Configuracao) => void
  aoLimparHistorico: () => void
  aoFechar: () => void
}

export function Configuracoes({ configuracao, aoSalvar, aoLimparHistorico, aoFechar }: Props) {
  const [fonte, setFonte] = useState<TipoFonte>(configuracao.fonte)
  const [url, setUrl] = useState(configuracao.api.url)
  const urlLimpa = url.trim().replace(/\/+$/, '')
  const urlValida = /^https?:\/\/.+/.test(urlLimpa)
  const podeSalvar = fonte === 'simulacao' || urlValida
  // página em https não pode chamar API em http: o navegador bloqueia (conteúdo misto)
  const bloqueadoPeloNavegador = location.protocol === 'https:' && urlLimpa.startsWith('http://')

  return (
    <Dialogo
      titulo="Fonte de dados"
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="botao botao--primario"
            disabled={!podeSalvar}
            onClick={() => aoSalvar({ fonte, api: { url: urlLimpa } })}
          >
            Salvar e conectar
          </button>
        </>
      }
    >
      <fieldset className="opcoes-fonte">
        <legend className="visualmente-oculto">De onde vêm os dados</legend>
        <label className="alternador">
          <input type="radio" name="fonte" checked={fonte === 'simulacao'} onChange={() => setFonte('simulacao')} />
          <span>
            <strong>Simulação</strong>: sem hardware, o navegador simula o ESP32 e os reservatórios
          </span>
        </label>
        <label className="alternador">
          <input type="radio" name="fonte" checked={fonte === 'api'} onChange={() => setFonte('api')} />
          <span>
            <strong>ESP32 real pela API</strong>: o dashboard consulta a API Flask, que recebe os dados do ESP32
          </span>
        </label>
      </fieldset>

      {fonte === 'api' && (
        <div className="campos">
          <label className="campo">
            <span className="campo__rotulo">Endereço da API</span>
            <input
              className="campo__entrada"
              value={url}
              onChange={(evento) => setUrl(evento.target.value)}
              placeholder={urlApiPadrao()}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {!urlValida && <p className="nota nota--falha">O endereço precisa começar com http:// ou https://.</p>}
          {bloqueadoPeloNavegador && (
            <p className="nota nota--falha">
              Esta página foi aberta por https, então o navegador bloqueia a API em http. Abra o dashboard pelo{' '}
              <code>npm run dev</code>, que usa http.
            </p>
          )}
          <p className="nota nota--suave">
            É o endereço do computador que roda <code>python app.py</code>, na porta 5000. Se o dashboard foi aberto
            pelo <code>npm run dev</code> desse mesmo computador, o endereço padrão já aponta para ele, inclusive no
            celular. O dashboard lê{' '}
            <code>/api/leituras/ultima</code> a cada segundo e cadastra os comandos em <code>/api/comandos</code>.
          </p>
        </div>
      )}

      <hr className="separador" />
      <button
        type="button"
        className="botao botao--discreto"
        onClick={() => {
          aoLimparHistorico()
          aoFechar()
        }}
      >
        Apagar histórico e ocorrências salvos neste navegador
      </button>
    </Dialogo>
  )
}
