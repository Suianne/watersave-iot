import { Comando, NOME_COMANDO } from '../contrato'
import { avaliarComando, verificarConexao, type ContextoComando } from '../intertravamentos'
import { Cartao } from './Cartao'

interface Props {
  contexto: ContextoComando
  /** comando enviado aguardando confirmação do ESP32 */
  pendente: Comando | null
  aoSolicitar: (comando: Comando) => void
}

export function PainelComandos({ contexto, pendente, aoSolicitar }: Props) {
  const conexao = verificarConexao(contexto)

  function botao(comando: Comando, classe = '') {
    const { permitido, motivo } = avaliarComando(comando, contexto)
    return (
      <div className="comando">
        <button
          type="button"
          className={`botao ${classe}`}
          disabled={!permitido}
          aria-busy={pendente === comando}
          onClick={() => aoSolicitar(comando)}
        >
          {pendente === comando ? 'Aguardando ESP32…' : NOME_COMANDO[comando]}
        </button>
        {/* sem conexão o motivo é o mesmo para todos: aparece uma vez só, no topo */}
        {!permitido && conexao.permitido && motivo && <span className="comando__motivo">{motivo}</span>}
      </div>
    )
  }

  return (
    <Cartao titulo="Comandos" className="painel-comandos">
      {!conexao.permitido && <p className="nota nota--aviso">{conexao.motivo}</p>}
      {botao(Comando.PARADA_EMERGENCIA, 'botao--perigo botao--grande')}

      <h3 className="subtitulo">Modo de operação</h3>
      <div className="grupo-comandos">
        {botao(Comando.MODO_AUTOMATICO)}
        {botao(Comando.MODO_MANUAL)}
      </div>

      <h3 className="subtitulo">Válvula (modo manual)</h3>
      <div className="grupo-comandos">
        {botao(Comando.ABRIR_VALVULA, 'botao--primario')}
        {botao(Comando.FECHAR_VALVULA)}
      </div>

      <h3 className="subtitulo">Falhas</h3>
      {botao(Comando.RESETAR_FALHA)}
    </Cartao>
  )
}
