import { LIMITE_DADOS_ATUALIZADOS_S, type Telemetria } from './contrato'

export interface PontoHistorico {
  t: number
  temperatura: number | null
  /** temperatura-alvo (limite de abertura) */
  alvo: number | null
  /** alvo - histerese (limite de fechamento) */
  fecha: number | null
  vazao: number | null
  /** 1 = válvula aberta, 0 = fechada (área sombreada no gráfico de vazão) */
  valvula: number | null
}

/** ~3 h de dados a cada 2 s */
export const MAX_PONTOS = 6000
export const MAX_PONTOS_GRAFICO = 600

export function pontoDaTelemetria(instante: number, telemetria: Telemetria): PontoHistorico {
  return {
    t: instante,
    temperatura: telemetria.temperaturaAtual,
    alvo: telemetria.temperaturaAlvo,
    fecha: telemetria.temperaturaAlvo - telemetria.histerese,
    vazao: telemetria.vazao,
    valvula: telemetria.valvulaAberta ? 1 : 0,
  }
}

function lacuna(instante: number): PontoHistorico {
  return { t: instante, temperatura: null, alvo: null, fecha: null, vazao: null, valvula: null }
}

export function ehLacuna(ponto: PontoHistorico): boolean {
  return ponto.temperatura === null && ponto.vazao === null && ponto.alvo === null
}

/**
 * Acrescenta um ponto. Se o ESP32 ficou sem enviar dados (queda de Wi-Fi), insere uma
 * lacuna para o gráfico mostrar o buraco em vez de ligar os pontos com uma reta.
 */
export function adicionarPonto(historico: PontoHistorico[], ponto: PontoHistorico): PontoHistorico[] {
  const ultimo = historico.at(-1)
  const semDados = ultimo !== undefined && ponto.t - ultimo.t > LIMITE_DADOS_ATUALIZADOS_S * 1000
  const novo = semDados ? [...historico, lacuna(ultimo.t + 1), ponto] : [...historico, ponto]
  return novo.length > MAX_PONTOS ? novo.slice(novo.length - MAX_PONTOS) : novo
}

/** janelaMs = null mostra tudo */
export function filtrarJanela(historico: PontoHistorico[], janelaMs: number | null, agora: number): PontoHistorico[] {
  if (janelaMs === null) return historico
  const inicio = agora - janelaMs
  return historico.filter((ponto) => ponto.t >= inicio)
}

/** Reduz a quantidade de pontos para o gráfico continuar leve, sem perder as lacunas. */
export function reduzir(historico: PontoHistorico[], maxPontos = MAX_PONTOS_GRAFICO): PontoHistorico[] {
  if (historico.length <= maxPontos) return historico
  const passo = Math.ceil(historico.length / maxPontos)
  return historico.filter(
    (ponto, indice) => indice % passo === 0 || indice === historico.length - 1 || ehLacuna(ponto),
  )
}
