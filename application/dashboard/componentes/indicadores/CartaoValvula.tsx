import { EstadoSistema, type Telemetria } from '../../contrato'
import { Cartao } from '../Cartao'

function descreverControle(estado: EstadoSistema): string {
  switch (estado) {
    case EstadoSistema.MANUAL:
      return 'Controle manual pelo dashboard'
    case EstadoSistema.FALHA:
      return 'Bloqueada fechada por falha'
    case EstadoSistema.INICIANDO:
      return 'Fechada durante a inicialização'
    default:
      return 'Controle automático por temperatura'
  }
}

interface Props {
  telemetria: Telemetria | null
}

export function CartaoValvula({ telemetria }: Props) {
  const aberta = telemetria?.valvulaAberta ?? false
  return (
    <Cartao titulo="Válvula solenoide" destaque={!telemetria ? 'neutro' : aberta ? 'info' : 'neutro'}>
      <p className="valor valor--com-indicador" data-testid="estado-valvula">
        <span className={`luz ${telemetria ? (aberta ? 'luz--aberta' : 'luz--fechada') : ''}`} aria-hidden="true" />
        {telemetria ? (aberta ? 'Aberta' : 'Fechada') : '--'}
      </p>
      {telemetria && <p className="nota">{descreverControle(telemetria.estadoSistema)}</p>}
    </Cartao>
  )
}
