import { useState } from 'react'
import type { NivelAlerta } from '../contrato'
import type { Evento } from '../eventos'
import { formatarMomento } from '../formatar'
import { Cartao } from './Cartao'

const ROTULO_NIVEL: Record<NivelAlerta, string> = { info: 'Info', aviso: 'Aviso', falha: 'Falha' }

interface Props {
  eventos: Evento[]
  agora: number
}

export function PainelAlertas({ eventos, agora }: Props) {
  const [soImportantes, setSoImportantes] = useState(false)
  const lista = soImportantes ? eventos.filter((evento) => evento.nivel !== 'info') : eventos

  return (
    <Cartao
      titulo="Alertas e ocorrências"
      className="painel-alertas"
      acoes={
        <div className="segmentado" role="group" aria-label="Filtro de ocorrências">
          <button
            type="button"
            className="segmentado__opcao"
            aria-pressed={!soImportantes}
            onClick={() => setSoImportantes(false)}
          >
            Todas
          </button>
          <button
            type="button"
            className="segmentado__opcao"
            aria-pressed={soImportantes}
            onClick={() => setSoImportantes(true)}
          >
            Falhas e avisos
          </button>
        </div>
      }
    >
      {lista.length === 0 ? (
        <p className="nota nota--suave">Nenhuma ocorrência registrada.</p>
      ) : (
        <ol className="eventos" aria-live="polite">
          {lista.map((evento) => (
            <li key={evento.id} className={`evento evento--${evento.nivel}`}>
              <span className="evento__nivel">{ROTULO_NIVEL[evento.nivel]}</span>
              <div className="evento__corpo">
                <strong>{evento.titulo}</strong>
                {evento.detalhe && <p>{evento.detalhe}</p>}
              </div>
              <time className="evento__hora" dateTime={new Date(evento.t).toISOString()}>
                {formatarMomento(evento.t, agora)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Cartao>
  )
}
