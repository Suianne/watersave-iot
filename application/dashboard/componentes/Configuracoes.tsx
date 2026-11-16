import { useState, type ComponentProps } from 'react'
import { topicos } from '../contrato'
import type { ConfigMqtt, Configuracao, TipoFonte } from '../configuracao'
import { Dialogo } from './Dialogo'

interface Props {
  configuracao: Configuracao
  aoSalvar: (configuracao: Configuracao) => void
  aoLimparHistorico: () => void
  aoFechar: () => void
}

export function Configuracoes({ configuracao, aoSalvar, aoLimparHistorico, aoFechar }: Props) {
  const [fonte, setFonte] = useState<TipoFonte>(configuracao.fonte)
  const [mqtt, setMqtt] = useState<ConfigMqtt>(configuracao.mqtt)
  const urlValida = /^wss?:\/\/.+/.test(mqtt.url.trim())
  const prefixo = mqtt.prefixo.trim().replace(/\/+$/, '')
  const podeSalvar = fonte === 'simulacao' || (urlValida && prefixo !== '')

  const campo = (chave: keyof ConfigMqtt, rotulo: string, extra: ComponentProps<'input'> = {}) => (
    <label className="campo">
      <span className="campo__rotulo">{rotulo}</span>
      <input
        className="campo__entrada"
        value={mqtt[chave]}
        onChange={(evento) => setMqtt({ ...mqtt, [chave]: evento.target.value })}
        autoComplete="off"
        spellCheck={false}
        {...extra}
      />
    </label>
  )

  const t = topicos(prefixo || 'prefixo')

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
            onClick={() => aoSalvar({ fonte, mqtt: { ...mqtt, url: mqtt.url.trim(), prefixo } })}
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
          <input type="radio" name="fonte" checked={fonte === 'mqtt'} onChange={() => setFonte('mqtt')} />
          <span>
            <strong>ESP32 real via MQTT</strong>: conecta no broker por WebSocket
          </span>
        </label>
      </fieldset>

      {fonte === 'mqtt' && (
        <div className="campos">
          {campo('url', 'Endereço WebSocket do broker', { placeholder: 'wss://seu-cluster.hivemq.cloud:8884/mqtt' })}
          {!urlValida && <p className="nota nota--falha">O endereço precisa começar com wss:// (ou ws:// em rede local).</p>}
          {campo('usuario', 'Usuário (opcional em broker público)')}
          {campo('senha', 'Senha', { type: 'password' })}
          {campo('prefixo', 'Prefixo dos tópicos', { placeholder: 'watersave' })}
          <p className="nota nota--suave">
            Tópicos usados: <code>{t.estado}</code>, <code>{t.online}</code>, <code>{t.temperaturaAlvo}</code> e{' '}
            <code>{t.comando}</code>. Usuário e senha ficam salvos só neste navegador.
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
