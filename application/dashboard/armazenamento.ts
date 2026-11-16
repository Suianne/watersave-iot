// localStorage pode estar bloqueado (aba anônima, cota cheia): tudo aqui falha em silêncio.

export function lerJson<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave)
    return bruto === null ? padrao : (JSON.parse(bruto) as T)
  } catch {
    return padrao
  }
}

export function gravarJson(chave: string, valor: unknown): void {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    // sem armazenamento: o dashboard continua funcionando, só não guarda o histórico
  }
}

export function lerLista<T>(chave: string): T[] {
  const valor = lerJson<unknown>(chave, [])
  return Array.isArray(valor) ? (valor as T[]) : []
}
