const formatadores = new Map<number, Intl.NumberFormat>()

export function formatarNumero(valor: number, casas = 1): string {
  let formatador = formatadores.get(casas)
  if (!formatador) {
    formatador = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
    formatadores.set(casas, formatador)
  }
  return formatador.format(valor)
}

export function formatarTemperatura(valor: number | null): string {
  return valor === null ? '--' : `${formatarNumero(valor, 1)} °C`
}

export function formatarHora(instante: number): string {
  return new Date(instante).toLocaleTimeString('pt-BR')
}

export function formatarHoraCurta(instante: number): string {
  return new Date(instante).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Rótulo do eixo de tempo: com segundos quando o período mostrado é curto. */
export function formatadorEixoTempo(duracaoMs: number): (instante: number) => string {
  return duracaoMs <= 20 * 60_000 ? formatarHora : formatarHoraCurta
}

/** Hora do evento; inclui a data quando não é de hoje. */
export function formatarMomento(instante: number, agora = Date.now()): string {
  const data = new Date(instante)
  if (data.toDateString() === new Date(agora).toDateString()) return formatarHora(instante)
  return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${formatarHora(instante)}`
}

export function formatarTempoDecorrido(ms: number): string {
  const segundos = Math.max(0, Math.round(ms / 1000))
  if (segundos < 60) return `há ${segundos} s`
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `há ${minutos} min`
  return `há ${Math.floor(minutos / 60)} h`
}
