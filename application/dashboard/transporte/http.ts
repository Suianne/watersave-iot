// Conexão com o ESP32 real pela API REST (api/app.py). O ESP32 envia as leituras para a API e busca
// nela os comandos; o dashboard consulta a última leitura e cadastra comandos na fila da API.

import { COMANDO_ATUALIZAR_ALVO, LIMITE_DADOS_ATUALIZADOS_S, parseTelemetria, type Comando } from '../contrato'
import type { ConfigApi } from '../configuracao'
import { MAX_PONTOS } from '../historico'
import type { EventosTransporte, LeituraHistorica, StatusConexao, Transporte } from './tipos'

/** o ESP32 envia a cada 2 s: consultando a cada 1 s, a leitura nova aparece sem atraso perceptível */
export const INTERVALO_CONSULTA_MS = 1000
const TEMPO_LIMITE_REQUISICAO_MS = 3000
/** histórico carregado da API ao conectar: o mesmo período que o navegador guarda */
export const JANELA_HISTORICO_S = 3 * 60 * 60

interface ComandoNaFila {
  id: number
  validadeS: number | null
  resolver: () => void
  rejeitar: (erro: Error) => void
}

class ErroApi extends Error {
  /** true quando a API nem respondeu (fora do ar, endereço errado, sem rede) */
  readonly semResposta: boolean
  readonly status: number | null

  constructor(mensagem: string, semResposta = false, status: number | null = null) {
    super(mensagem)
    this.semResposta = semResposta
    this.status = status
  }
}

const mensagemDe = (erro: unknown) => (erro instanceof Error ? erro.message : String(erro))

export class TransporteHttp implements Transporte {
  // a API descarta em 10 s o comando que o ESP32 não buscou e só informa depois de mais 5 s de folga
  readonly tempoConfirmacaoMs = 20_000
  private readonly base: string
  private readonly encerramento = new AbortController()
  private eventos: EventosTransporte | null = null
  private temporizador: ReturnType<typeof setTimeout> | null = null
  private status: StatusConexao | null = null
  private detalhe: string | undefined
  private online: boolean | null = null
  private historicoCarregado = false
  private ultimoId: unknown = null
  private ultimaLeitura: number | null = null
  private ultimaConsulta: number | null = null
  private fila: ComandoNaFila[] = []

  constructor(config: ConfigApi) {
    this.base = config.url.trim().replace(/\/+$/, '')
  }

  iniciar(eventos: EventosTransporte): void {
    this.eventos = eventos
    this.mudarConexao('conectando')
    void this.consultar()
  }

  encerrar(): void {
    this.eventos = null
    if (this.temporizador) clearTimeout(this.temporizador)
    this.temporizador = null
    this.encerramento.abort()
  }

  enviarComando(comando: Comando): Promise<void> {
    return this.cadastrar({ comando })
  }

  enviarTemperaturaAlvo(valor: number): Promise<void> {
    return this.cadastrar({ comando: COMANDO_ATUALIZAR_ALVO, temperaturaAlvo: valor })
  }

  private async consultar(): Promise<void> {
    try {
      const corpo = await this.requisitar('/api/leituras/ultima')
      if (typeof corpo !== 'object' || corpo === null || !('leitura' in corpo))
        throw new ErroApi(`${this.base} respondeu, mas não parece ser a API do WaterSave.`)
      this.mudarConexao('conectado')
      if (!this.historicoCarregado) await this.carregarHistorico()
      const agora = Date.now()
      this.processarLeitura(corpo.leitura, agora)
      this.atualizarPresenca(agora)
      this.ultimaConsulta = agora
      if (this.fila.length > 0) await this.acompanharFila()
    } catch (erro) {
      if (this.encerramento.signal.aborted) return
      this.mudarConexao(erro instanceof ErroApi && erro.semResposta ? 'desconectado' : 'erro', mensagemDe(erro))
    } finally {
      if (!this.encerramento.signal.aborted)
        this.temporizador = setTimeout(() => void this.consultar(), INTERVALO_CONSULTA_MS)
    }
  }

  /** Preenche os gráficos com as leituras que a API guardou enquanto o dashboard estava fechado. */
  private async carregarHistorico(): Promise<void> {
    this.historicoCarregado = true
    const desde = Math.floor(Date.now() / 1000) - JANELA_HISTORICO_S
    let corpo: unknown
    try {
      corpo = await this.requisitar(`/api/leituras?desde=${desde}&limite=${MAX_PONTOS}`)
    } catch {
      // sem o histórico o dashboard continua funcionando, só com os gráficos vazios
      return
    }
    const leituras = (corpo as { leituras?: unknown } | null)?.leituras
    if (!Array.isArray(leituras)) return
    const agora = Date.now()
    const pontos: LeituraHistorica[] = []
    for (const leitura of leituras) {
      const telemetria = parseTelemetria(leitura)
      const { timestamp } = (leitura ?? {}) as { timestamp?: unknown }
      if (telemetria && typeof timestamp === 'number')
        pontos.push({ telemetria, instante: Math.min(agora, timestamp * 1000) })
    }
    if (pontos.length > 0) this.eventos?.aoReceberHistorico(pontos)
  }

  private processarLeitura(leitura: unknown, agora: number): void {
    // null: a API ainda não recebeu nenhuma leitura do ESP32
    if (typeof leitura !== 'object' || leitura === null) return
    const { id, timestamp } = leitura as { id?: unknown; timestamp?: unknown }
    // a mesma leitura volta a cada consulta até o ESP32 enviar a próxima
    if (id === this.ultimoId) return
    this.ultimoId = id

    const telemetria = parseTelemetria(leitura)
    if (!telemetria) {
      this.eventos?.aoReceberPacoteInvalido(JSON.stringify(leitura))
      return
    }

    // timestamp é o horário Unix (s) do servidor. Se a leitura mudou desde a consulta anterior,
    // ela é mais nova que essa consulta: isso compensa relógios um pouco diferentes
    const doServidor = typeof timestamp === 'number' ? timestamp * 1000 : agora
    const instante = Math.min(agora, Math.max(doServidor, this.ultimaConsulta ?? -Infinity))
    this.ultimaLeitura = instante
    this.eventos?.aoReceberTelemetria(telemetria, instante)
  }

  /** Online enquanto chegam leituras novas. Só muda quando a API responde: sem ela, não dá para saber. */
  private atualizarPresenca(agora: number): void {
    const online = this.ultimaLeitura !== null && agora - this.ultimaLeitura <= LIMITE_DADOS_ATUALIZADOS_S * 1000
    if (online === this.online) return
    this.online = online
    this.eventos?.aoMudarDispositivoOnline(online)
  }

  /** Resolve quando o ESP32 avaliar o comando; rejeita se a API recusar ou descartar o comando. */
  private async cadastrar(corpo: object): Promise<void> {
    const resposta = await this.requisitar('/api/comandos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
    const { id, validadeSegundos } = (resposta ?? {}) as { id?: unknown; validadeSegundos?: unknown }
    // sem id não há como acompanhar: a telemetria continua mostrando se o comando foi aplicado
    if (typeof id !== 'number') return
    const validadeS = typeof validadeSegundos === 'number' ? validadeSegundos : null
    return new Promise<void>((resolver, rejeitar) => {
      this.fila.push({ id, validadeS, resolver, rejeitar })
    })
  }

  /** Consulta a situação de cada comando enviado: avaliado pelo ESP32, expirado ou ainda pendente. */
  private async acompanharFila(): Promise<void> {
    for (const comando of [...this.fila]) {
      let situacao: unknown
      try {
        const corpo = (await this.requisitar(`/api/comandos/${comando.id}`)) as { comando?: { situacao?: unknown } } | null
        situacao = corpo?.comando?.situacao
      } catch (erro) {
        // API antiga, sem a rota de situação: a confirmação fica só pela telemetria
        if (erro instanceof ErroApi && erro.status === 404) this.removerDaFila(comando)
        continue
      }
      if (situacao === 'avaliado') {
        this.removerDaFila(comando)
        comando.resolver()
      } else if (situacao === 'expirado') {
        this.removerDaFila(comando)
        const prazo = comando.validadeS === null ? 'dentro do prazo' : `em ${comando.validadeS} s`
        comando.rejeitar(
          new Error(`O ESP32 não buscou o comando ${prazo}, então a API o descartou. Ele não será executado.`),
        )
      }
    }
  }

  private removerDaFila(comando: ComandoNaFila): void {
    this.fila = this.fila.filter((outro) => outro !== comando)
  }

  private async requisitar(caminho: string, opcoes: RequestInit = {}): Promise<unknown> {
    const controlador = new AbortController()
    const abortar = () => controlador.abort()
    const limite = setTimeout(abortar, TEMPO_LIMITE_REQUISICAO_MS)
    this.encerramento.signal.addEventListener('abort', abortar)
    try {
      let resposta: Response
      try {
        resposta = await fetch(this.base + caminho, { ...opcoes, signal: controlador.signal })
      } catch {
        throw new ErroApi(
          `Sem resposta da API em ${this.base}. Confira se ela está rodando (python app.py) e se o endereço está certo.`,
          true,
        )
      }
      const corpo: unknown = await resposta.json().catch(() => null)
      if (!resposta.ok) {
        const erro = (corpo as { erro?: unknown } | null)?.erro
        throw new ErroApi(
          `A API respondeu com erro ${resposta.status}${typeof erro === 'string' ? `: ${erro}` : ''}.`,
          false,
          resposta.status,
        )
      }
      return corpo
    } finally {
      clearTimeout(limite)
      this.encerramento.signal.removeEventListener('abort', abortar)
    }
  }

  private mudarConexao(status: StatusConexao, detalhe?: string): void {
    if (status === this.status && detalhe === this.detalhe) return
    this.status = status
    this.detalhe = detalhe
    this.eventos?.aoMudarConexao(status, detalhe)
  }
}
