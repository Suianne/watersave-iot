import { gravarJson, lerJson } from './armazenamento'

export interface ConfigApi {
  /** endereço da API Flask (api/app.py), ex.: http://192.168.0.10:5000 */
  url: string
}

export type TipoFonte = 'simulacao' | 'api'

export interface Configuracao {
  fonte: TipoFonte
  api: ConfigApi
}

/**
 * A API roda na porta 5000 do mesmo computador que serve o dashboard (npm run dev).
 * Aberto no celular pelo IP da rede, o endereço da página já aponta para esse computador.
 */
export function urlApiPadrao(): string {
  const host = typeof location !== 'undefined' && location.hostname ? location.hostname : 'localhost'
  return `http://${host}:5000`
}

const CHAVE = 'watersave:configuracao'

export function carregarConfiguracao(): Configuracao {
  const salva = lerJson<Partial<Configuracao>>(CHAVE, {})
  return {
    // configurações antigas com fonte "mqtt" voltam para a simulação
    fonte: salva.fonte === 'api' ? 'api' : 'simulacao',
    api: { url: salva.api?.url || urlApiPadrao() },
  }
}

export function salvarConfiguracao(configuracao: Configuracao): void {
  gravarJson(CHAVE, configuracao)
}
