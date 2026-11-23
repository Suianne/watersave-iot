import { descreverAlerta, type Telemetria } from '../contrato'

interface Props {
  telemetria: Telemetria | null
  dispositivoOnline: boolean
  dadosAtualizados: boolean
  /** antes da primeira telemetria não há o que avisar */
  jaRecebeuDados: boolean
  /** motivo da falha de conexão com a API, quando houver */
  falhaApi?: string
}

export function BannerStatus({ telemetria, dispositivoOnline, dadosAtualizados, jaRecebeuDados, falhaApi }: Props) {
  const alerta = telemetria?.alerta ? descreverAlerta(telemetria.alerta) : null
  const semConexao = jaRecebeuDados && (!dispositivoOnline || !dadosAtualizados)

  if (!alerta && !semConexao && !falhaApi) return null

  return (
    <div className="banners">
      {falhaApi && (
        <div className="banner banner--aviso" role="status">
          <strong>Sem conexão com a API.</strong> {falhaApi}
        </div>
      )}
      {alerta && (
        <div className={`banner banner--${alerta.nivel}`} role="alert">
          <strong>{alerta.titulo}.</strong> {alerta.mensagem}
        </div>
      )}
      {semConexao && (
        <div className="banner banner--aviso" role="status">
          <strong>{dispositivoOnline ? 'Dados desatualizados.' : 'ESP32 offline.'}</strong> O controle local continua
          funcionando no ESP32: a válvula segue a temperatura e as proteções. Os dados voltam quando a conexão for
          restabelecida.
        </div>
      )}
    </div>
  )
}
