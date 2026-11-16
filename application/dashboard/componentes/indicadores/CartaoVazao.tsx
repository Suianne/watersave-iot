import type { Telemetria } from '../../contrato'
import { formatarNumero } from '../../formatar'
import { Cartao } from '../Cartao'

interface Props {
  telemetria: Telemetria | null
  atualizado: boolean
}

export function CartaoVazao({ telemetria, atualizado }: Props) {
  const escoando = (telemetria?.vazao ?? 0) > 0
  return (
    <Cartao titulo="Vazão" destaque={escoando ? 'info' : 'neutro'}>
      <p className={`valor ${atualizado ? '' : 'valor--desatualizado'}`} data-testid="vazao">
        {telemetria ? formatarNumero(telemetria.vazao, 1) : '--'}
        <span className="valor__unidade"> L/min</span>
      </p>
      <p className="nota">
        Volume transferido:{' '}
        <strong data-testid="volume">{telemetria ? `${formatarNumero(telemetria.volumeTransferido, 2)} L` : '--'}</strong>
      </p>
      <p className="nota nota--suave">Medido pelo YF-S201, contado desde a última inicialização do ESP32</p>
    </Cartao>
  )
}
