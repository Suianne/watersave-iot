// Registro de ocorrências mostrado na área de alertas: derivado das mudanças na telemetria.

import { EstadoSistema, NOME_ESTADO, descreverAlerta, type NivelAlerta, type Telemetria } from './contrato'
import { formatarTemperatura } from './formatar'

export interface Evento {
  id: string
  t: number
  nivel: NivelAlerta
  titulo: string
  detalhe?: string
}

export type NovoEvento = Omit<Evento, 'id' | 't'>

function eventoDeAlerta(codigo: string): NovoEvento {
  const alerta = descreverAlerta(codigo)
  return { nivel: alerta.nivel, titulo: alerta.titulo, detalhe: alerta.mensagem }
}

export function eventosDaTransicao(anterior: Telemetria | null, atual: Telemetria): NovoEvento[] {
  if (!anterior) {
    const eventos: NovoEvento[] = [
      { nivel: 'info', titulo: 'Primeiros dados recebidos do ESP32', detalhe: NOME_ESTADO[atual.estadoSistema] },
    ]
    if (atual.alerta) eventos.push(eventoDeAlerta(atual.alerta))
    return eventos
  }

  const eventos: NovoEvento[] = []

  if (anterior.estadoSistema !== atual.estadoSistema) {
    if (atual.estadoSistema === EstadoSistema.INICIANDO) {
      eventos.push({
        nivel: 'aviso',
        titulo: 'ESP32 reiniciou',
        detalhe: 'A válvula volta fechada e o volume transferido recomeça do zero.',
      })
    } else {
      eventos.push({
        nivel: 'info',
        titulo: `Estado: ${NOME_ESTADO[atual.estadoSistema]}`,
        detalhe: `Antes: ${NOME_ESTADO[anterior.estadoSistema]}`,
      })
    }
  }

  if (anterior.alerta !== atual.alerta) {
    if (atual.alerta) eventos.push(eventoDeAlerta(atual.alerta))
    else eventos.push({ nivel: 'info', titulo: `Alerta resolvido: ${descreverAlerta(anterior.alerta).titulo}` })
  }

  if (anterior.valvulaAberta !== atual.valvulaAberta) {
    eventos.push({
      nivel: 'info',
      titulo: atual.valvulaAberta ? 'Válvula aberta' : 'Válvula fechada',
      detalhe: `Temperatura no momento: ${formatarTemperatura(atual.temperaturaAtual)}`,
    })
  }

  if (anterior.temperaturaAlvo !== atual.temperaturaAlvo) {
    eventos.push({ nivel: 'info', titulo: `Temperatura-alvo agora é ${formatarTemperatura(atual.temperaturaAlvo)}` })
  }

  return eventos
}
