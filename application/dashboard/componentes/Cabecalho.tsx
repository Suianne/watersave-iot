import type { TipoFonte } from '../configuracao'
import { formatarTempoDecorrido } from '../formatar'
import type { StatusConexao } from '../transporte/tipos'

const TEXTO_CONEXAO: Record<StatusConexao, string> = {
  conectando: 'API: conectando…',
  conectado: 'API online',
  desconectado: 'API offline',
  erro: 'API com erro',
}

const SELO_CONEXAO: Record<StatusConexao, string> = {
  conectando: 'aviso',
  conectado: 'ok',
  desconectado: 'falha',
  erro: 'falha',
}

interface Props {
  fonte: TipoFonte
  conexao: { status: StatusConexao; detalhe?: string }
  dispositivoOnline: boolean
  ultimaAtualizacao: number | null
  agora: number
  notificacoes: { suportadas: boolean; ativas: boolean; alternar: () => void }
  aoAbrirConfiguracoes: () => void
}

export function Cabecalho({
  fonte,
  conexao,
  dispositivoOnline,
  ultimaAtualizacao,
  agora,
  notificacoes,
  aoAbrirConfiguracoes,
}: Props) {
  return (
    <header className="cabecalho">
      <div className="marca">
        <svg className="marca__icone" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5c-.3 0-.6.2-.8.4C9.4 5.3 5 11 5 14.6 5 18.7 8.1 22 12 22s7-3.3 7-7.4C19 11 14.6 5.3 12.8 2.9c-.2-.2-.5-.4-.8-.4z" />
        </svg>
        <div>
          <h1 className="marca__nome">WaterSave IoT</h1>
          <p className="marca__descricao">Transferência de água controlada por temperatura</p>
        </div>
      </div>

      <div className="cabecalho__status" role="status" aria-live="polite">
        {fonte === 'simulacao' ? (
          <span className="selo selo--aviso">Simulação</span>
        ) : (
          <span className={`selo selo--${SELO_CONEXAO[conexao.status]}`} title={conexao.detalhe}>
            {TEXTO_CONEXAO[conexao.status]}
          </span>
        )}
        <span className={`selo selo--${dispositivoOnline ? 'ok' : 'falha'}`}>
          ESP32 {dispositivoOnline ? 'online' : 'offline'}
        </span>
        <span className="selo selo--neutro">
          {ultimaAtualizacao === null
            ? 'Sem dados ainda'
            : `Atualizado ${formatarTempoDecorrido(agora - ultimaAtualizacao)}`}
        </span>
      </div>

      <div className="cabecalho__acoes">
        {notificacoes.suportadas && (
          <button type="button" className="botao botao--discreto" aria-pressed={notificacoes.ativas} onClick={notificacoes.alternar}>
            {notificacoes.ativas ? 'Notificações ligadas' : 'Ativar notificações'}
          </button>
        )}
        <button type="button" className="botao" onClick={aoAbrirConfiguracoes}>
          Fonte de dados
        </button>
      </div>
    </header>
  )
}
