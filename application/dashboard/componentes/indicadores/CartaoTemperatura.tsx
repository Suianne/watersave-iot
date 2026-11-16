import { zonaTemperatura, type Telemetria, type ZonaTemperatura } from '../../contrato'
import { formatarTemperatura } from '../../formatar'
import { Cartao, type Destaque } from '../Cartao'

const TEXTO_ZONA: Record<ZonaTemperatura, string> = {
  acima: 'No alvo ou acima: condição de abertura da válvula',
  faixa: 'Na faixa de histerese: a válvula mantém o estado atual',
  abaixo: 'Abaixo da faixa: condição de válvula fechada',
}

const DESTAQUE_ZONA: Record<ZonaTemperatura, Destaque> = { acima: 'aviso', faixa: 'info', abaixo: 'neutro' }

interface Props {
  telemetria: Telemetria | null
  atualizado: boolean
}

export function CartaoTemperatura({ telemetria, atualizado }: Props) {
  const temperatura = telemetria?.temperaturaAtual ?? null
  const zona =
    telemetria && temperatura !== null
      ? zonaTemperatura(temperatura, telemetria.temperaturaAlvo, telemetria.histerese)
      : null
  const leituraInvalida = telemetria !== null && temperatura === null

  return (
    <Cartao titulo="Temperatura atual" destaque={leituraInvalida ? 'falha' : zona ? DESTAQUE_ZONA[zona] : 'neutro'}>
      <p className={`valor ${atualizado ? '' : 'valor--desatualizado'}`} data-testid="temperatura-atual">
        {formatarTemperatura(temperatura)}
      </p>
      {leituraInvalida && <p className="nota nota--falha">Leitura inválida do DS18B20</p>}
      {zona && <p className="nota">{TEXTO_ZONA[zona]}</p>}
      {telemetria && (
        <p className="nota nota--suave">
          Abre em ≥ {formatarTemperatura(telemetria.temperaturaAlvo)} · fecha em ≤{' '}
          {formatarTemperatura(telemetria.temperaturaAlvo - telemetria.histerese)}
        </p>
      )}
    </Cartao>
  )
}
