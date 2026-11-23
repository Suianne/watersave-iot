import { DESCRICAO_ESTADO, EstadoSistema, NOME_ESTADO, type Telemetria } from '../../contrato'
import { Cartao, type Destaque } from '../Cartao'

const DESTAQUE_ESTADO: Record<EstadoSistema, Destaque> = {
  [EstadoSistema.INICIANDO]: 'neutro',
  [EstadoSistema.AGUARDANDO]: 'ok',
  [EstadoSistema.TRANSFERINDO]: 'info',
  [EstadoSistema.MANUAL]: 'aviso',
  [EstadoSistema.FALHA]: 'falha',
}

interface Props {
  telemetria: Telemetria | null
  atualizado: boolean
  dispositivoOnline: boolean
}

export function CartaoSistema({ telemetria, atualizado, dispositivoOnline }: Props) {
  if (!telemetria) {
    return (
      <Cartao titulo="Estado do sistema">
        <p className="valor valor--texto" data-testid="estado-sistema">
          Aguardando dados
        </p>
        <p className="nota nota--suave">Nenhuma telemetria recebida do ESP32 ainda.</p>
      </Cartao>
    )
  }

  const estado = telemetria.estadoSistema
  return (
    <Cartao titulo="Estado do sistema" destaque={DESTAQUE_ESTADO[estado]}>
      <p className={`valor valor--texto ${atualizado ? '' : 'valor--desatualizado'}`} data-testid="estado-sistema">
        {NOME_ESTADO[estado]}
      </p>
      <p className="nota">{DESCRICAO_ESTADO[estado]}</p>
      {(!dispositivoOnline || !atualizado) && (
        <p className="nota nota--aviso">Último estado conhecido: o ESP32 não está enviando dados agora.</p>
      )}
    </Cartao>
  )
}
