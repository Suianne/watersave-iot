// Transporte HTTP contra uma API falsa que responde como api/app.py: consulta da última leitura,
// histórico, presença do ESP32, situação dos comandos e falhas de conexão.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Comando, type Telemetria } from '../../dashboard/contrato'
import { MAX_PONTOS } from '../../dashboard/historico'
import { JANELA_HISTORICO_S, TransporteHttp } from '../../dashboard/transporte/http'
import type { EventosTransporte, LeituraHistorica, StatusConexao } from '../../dashboard/transporte/tipos'

const BASE = 'http://192.168.0.10:5000'
const INICIO = new Date('2026-11-23T12:00:00Z').getTime()

type Leitura = Record<string, unknown>
type Situacao = 'pendente' | 'avaliado' | 'expirado'

/** leitura como a API devolve, feita há `segundosAtras` no relógio do servidor */
function leitura(id: number, segundosAtras = 0, parcial: Leitura = {}): Leitura {
  return {
    id,
    data_hora: '2026-11-23 12:00:00',
    timestamp: Math.floor(Date.now() / 1000) - segundosAtras,
    temperaturaAtual: 34.75,
    temperaturaAlvo: 35,
    histerese: 2,
    vazao: 0,
    volumeTransferido: 1.234,
    valvulaAberta: false,
    estadoSistema: 1,
    alerta: '',
    ...parcial,
  }
}

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response
}

function apiFalsa() {
  const api = {
    leitura: null as Leitura | null,
    historico: [] as Leitura[],
    situacoes: new Map<number, Situacao>(),
    proximoId: 1,
    /** fetch falha na hora, como com a API desligada */
    fora: false,
    /** fetch nunca responde, só termina quando o transporte aborta */
    travada: false,
    /** resposta que não é da API do WaterSave */
    outroServidor: false,
    /** API antiga, sem as rotas de histórico e de situação do comando */
    antiga: false,
    erroComando: null as { status: number; erro: string } | null,
    chamadas: [] as { metodo: string; caminho: string; corpo?: unknown }[],
  }

  const fetchFalso = vi.fn(async (url: string, opcoes: RequestInit = {}): Promise<Response> => {
    const metodo = opcoes.method ?? 'GET'
    const caminho = url.replace(BASE, '')
    api.chamadas.push({ metodo, caminho, corpo: opcoes.body ? JSON.parse(String(opcoes.body)) : undefined })
    if (api.fora) throw new TypeError('Failed to fetch')
    if (api.travada)
      return new Promise((_resolver, rejeitar) =>
        opcoes.signal?.addEventListener('abort', () => rejeitar(new DOMException('abortado', 'AbortError'))),
      )
    if (api.outroServidor) return resposta(200, { ola: 'mundo' })

    const situacao = caminho.match(/^\/api\/comandos\/(\d+)$/)
    if (metodo === 'GET' && caminho === '/api/leituras/ultima') return resposta(200, { leitura: api.leitura })
    if (metodo === 'GET' && caminho.startsWith('/api/leituras?') && !api.antiga)
      return resposta(200, { quantidade: api.historico.length, leituras: api.historico })
    if (metodo === 'GET' && situacao && !api.antiga) {
      const id = Number(situacao[1])
      return resposta(200, { comando: { id, situacao: api.situacoes.get(id) ?? 'pendente' } })
    }
    if (metodo === 'POST' && caminho === '/api/comandos') {
      if (api.erroComando) return resposta(api.erroComando.status, { erro: api.erroComando.erro })
      return resposta(201, { mensagem: 'Comando cadastrado', id: api.proximoId++, validadeSegundos: 10 })
    }
    return resposta(404, null)
  })

  vi.stubGlobal('fetch', fetchFalso)
  return api
}

function eventosFalsos() {
  const registro = {
    telemetrias: [] as { telemetria: Telemetria; instante?: number }[],
    historicos: [] as LeituraHistorica[][],
    conexao: [] as { status: StatusConexao; detalhe?: string }[],
    online: [] as boolean[],
    invalidos: [] as string[],
  }
  const eventos: EventosTransporte = {
    aoReceberTelemetria: (telemetria, instante) => registro.telemetrias.push({ telemetria, instante }),
    aoReceberHistorico: (leituras) => registro.historicos.push(leituras),
    aoMudarConexao: (status, detalhe) => registro.conexao.push({ status, detalhe }),
    aoMudarDispositivoOnline: (online) => registro.online.push(online),
    aoReceberPacoteInvalido: (conteudo) => registro.invalidos.push(conteudo),
  }
  return { eventos, registro }
}

const esperar = (ms = 0) => vi.advanceTimersByTimeAsync(ms)
const ultimaConexao = (registro: ReturnType<typeof eventosFalsos>['registro']) => registro.conexao.at(-1)

/** acompanha uma promessa sem deixar rejeição solta */
function situacaoDe(promessa: Promise<void>) {
  const estado: { resultado: 'esperando' | 'resolvida' | 'rejeitada'; erro?: Error } = { resultado: 'esperando' }
  promessa.then(
    () => (estado.resultado = 'resolvida'),
    (erro: Error) => Object.assign(estado, { resultado: 'rejeitada', erro }),
  )
  return estado
}

let transporte: TransporteHttp | null = null

function conectar() {
  const { eventos, registro } = eventosFalsos()
  // a barra no fim do endereço não pode gerar "//api"
  transporte = new TransporteHttp({ url: `${BASE}/` })
  transporte.iniciar(eventos)
  return { transporte, registro }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(INICIO)
})

afterEach(() => {
  transporte?.encerrar()
  transporte = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('consulta da última leitura', () => {
  it('mostra a leitura recente com o horário do servidor e marca o ESP32 online', async () => {
    const api = apiFalsa()
    api.leitura = leitura(1, 1)
    const { registro } = conectar()
    await esperar()

    expect(api.chamadas[0]).toEqual({ metodo: 'GET', caminho: '/api/leituras/ultima', corpo: undefined })
    expect(registro.conexao.map((c) => c.status)).toEqual(['conectando', 'conectado'])
    expect(registro.telemetrias).toHaveLength(1)
    expect(registro.telemetrias[0].telemetria.temperaturaAtual).toBe(34.75)
    expect(registro.telemetrias[0].instante).toBe(INICIO - 1000)
    expect(registro.online).toEqual([true])
  })

  it('não repete a mesma leitura e marca o ESP32 offline quando ele para de enviar', async () => {
    const api = apiFalsa()
    api.leitura = leitura(1)
    const { registro } = conectar()
    await esperar(5000)
    expect(registro.telemetrias).toHaveLength(1)
    expect(registro.online).toEqual([true])

    await esperar(6000) // mais de 10 s sem leitura nova
    expect(registro.online).toEqual([true, false])

    api.leitura = leitura(2)
    await esperar(1000)
    expect(registro.telemetrias).toHaveLength(2)
    expect(registro.online).toEqual([true, false, true])
  })

  it('leitura antiga (ESP32 desligado) aparece com o horário real e o ESP32 offline', async () => {
    const api = apiFalsa()
    api.leitura = leitura(1, 3600)
    const { registro } = conectar()
    await esperar()

    expect(registro.telemetrias[0].instante).toBe(INICIO - 3600 * 1000)
    expect(registro.online).toEqual([false])
  })

  it('compensa o relógio do servidor atrasado: leitura que mudou desde a última consulta é recente', async () => {
    const api = apiFalsa()
    api.leitura = leitura(1, 60) // servidor 60 s atrasado
    const { registro } = conectar()
    await esperar()
    expect(registro.online).toEqual([false])

    api.leitura = leitura(2, 60)
    await esperar(1000)
    expect(registro.telemetrias[1].instante).toBeGreaterThanOrEqual(INICIO)
    expect(registro.online).toEqual([false, true])
  })

  it('API sem nenhuma leitura ainda: conectado, sem dados e com o ESP32 offline', async () => {
    apiFalsa()
    const { registro } = conectar()
    await esperar()

    expect(ultimaConexao(registro)?.status).toBe('conectado')
    expect(registro.telemetrias).toHaveLength(0)
    expect(registro.online).toEqual([false])
  })

  it('pacote fora do contrato gera um único aviso, mesmo voltando em todas as consultas', async () => {
    const api = apiFalsa()
    api.leitura = leitura(1, 0, { estadoSistema: 9 })
    const { registro } = conectar()
    await esperar(3000)

    expect(registro.invalidos).toHaveLength(1)
    expect(registro.telemetrias).toHaveLength(0)
  })

  it('encerrar para as consultas', async () => {
    const api = apiFalsa()
    const { transporte } = conectar()
    await esperar(2000)
    const chamadas = api.chamadas.length
    transporte.encerrar()
    await esperar(5000)

    expect(api.chamadas).toHaveLength(chamadas)
  })
})

describe('histórico guardado na API', () => {
  it('carrega as últimas 3 h uma única vez ao conectar, antes da leitura atual', async () => {
    const api = apiFalsa()
    api.historico = [leitura(1, 30), leitura(2, 28, { estadoSistema: 9 }), leitura(3, 26)]
    api.leitura = leitura(3, 26)
    const { registro } = conectar()
    await esperar(3000)

    const pedidos = api.chamadas.filter((c) => c.caminho.startsWith('/api/leituras?'))
    expect(pedidos).toEqual([
      {
        metodo: 'GET',
        caminho: `/api/leituras?desde=${INICIO / 1000 - JANELA_HISTORICO_S}&limite=${MAX_PONTOS}`,
        corpo: undefined,
      },
    ])
    // a leitura fora do contrato fica de fora
    expect(registro.historicos).toHaveLength(1)
    expect(registro.historicos[0].map((l) => l.instante)).toEqual([INICIO - 30_000, INICIO - 26_000])
    expect(registro.telemetrias).toHaveLength(1)
  })

  it('API antiga, sem a rota de histórico: segue normalmente', async () => {
    const api = apiFalsa()
    api.antiga = true
    api.leitura = leitura(1)
    const { registro } = conectar()
    await esperar()

    expect(registro.historicos).toEqual([])
    expect(ultimaConexao(registro)?.status).toBe('conectado')
    expect(registro.telemetrias).toHaveLength(1)
  })
})

describe('falhas de conexão com a API', () => {
  it('API fora do ar: avisa com o endereço e não muda a presença do ESP32', async () => {
    const api = apiFalsa()
    api.fora = true
    const { registro } = conectar()
    await esperar(3000)

    expect(ultimaConexao(registro)?.status).toBe('desconectado')
    expect(ultimaConexao(registro)?.detalhe).toContain(BASE)
    // o status só é repassado quando muda, não a cada consulta
    expect(registro.conexao).toHaveLength(2)
    expect(registro.online).toEqual([])

    api.fora = false
    api.leitura = leitura(1)
    await esperar(1000)
    expect(ultimaConexao(registro)?.status).toBe('conectado')
    expect(registro.online).toEqual([true])
  })

  it('API que não responde é abortada depois de 3 s', async () => {
    const api = apiFalsa()
    api.travada = true
    const { registro } = conectar()
    await esperar(2900)
    expect(ultimaConexao(registro)?.status).toBe('conectando')

    await esperar(200)
    expect(ultimaConexao(registro)?.status).toBe('desconectado')
  })

  it('endereço que responde, mas não é a API do WaterSave, vira erro', async () => {
    const api = apiFalsa()
    api.outroServidor = true
    const { registro } = conectar()
    await esperar()

    expect(ultimaConexao(registro)?.status).toBe('erro')
    expect(ultimaConexao(registro)?.detalhe).toContain('não parece ser a API do WaterSave')
  })
})

describe('comandos', () => {
  it('cadastra comandos e a temperatura-alvo no formato da API', async () => {
    const api = apiFalsa()
    const { transporte } = conectar()
    situacaoDe(transporte.enviarComando(Comando.MODO_MANUAL))
    situacaoDe(transporte.enviarTemperaturaAlvo(38.5))
    await esperar()

    const posts = api.chamadas.filter((c) => c.metodo === 'POST')
    expect(posts).toEqual([
      { metodo: 'POST', caminho: '/api/comandos', corpo: { comando: 3 } },
      { metodo: 'POST', caminho: '/api/comandos', corpo: { comando: 7, temperaturaAlvo: 38.5 } },
    ])
  })

  it('resolve quando o ESP32 avalia o comando e para de consultar a situação dele', async () => {
    const api = apiFalsa()
    api.leitura = leitura(1)
    const { transporte } = conectar()
    await esperar()
    const envio = situacaoDe(transporte.enviarComando(Comando.MODO_MANUAL))
    await esperar(2000)
    expect(envio.resultado).toBe('esperando')
    expect(api.chamadas.some((c) => c.caminho === '/api/comandos/1')).toBe(true)

    api.situacoes.set(1, 'avaliado')
    await esperar(1000)
    expect(envio.resultado).toBe('resolvida')
    const consultas = api.chamadas.filter((c) => c.caminho === '/api/comandos/1').length
    await esperar(5000)
    expect(api.chamadas.filter((c) => c.caminho === '/api/comandos/1')).toHaveLength(consultas)
  })

  it('rejeita quando a API descarta o comando que o ESP32 não buscou', async () => {
    const api = apiFalsa()
    api.leitura = leitura(1)
    const { transporte } = conectar()
    await esperar()
    const envio = situacaoDe(transporte.enviarComando(Comando.ABRIR_VALVULA))
    await esperar(2000)

    api.situacoes.set(1, 'expirado')
    await esperar(1000)
    expect(envio.resultado).toBe('rejeitada')
    expect(envio.erro?.message).toBe(
      'O ESP32 não buscou o comando em 10 s, então a API o descartou. Ele não será executado.',
    )
  })

  it('API antiga, sem a rota de situação: para de acompanhar sem mudar o status da conexão', async () => {
    const api = apiFalsa()
    api.antiga = true
    api.leitura = leitura(1)
    const { transporte, registro } = conectar()
    await esperar()
    const envio = situacaoDe(transporte.enviarComando(Comando.MODO_MANUAL))
    await esperar(5000)

    // a confirmação fica só pela telemetria, como antes
    expect(envio.resultado).toBe('esperando')
    expect(api.chamadas.filter((c) => c.caminho === '/api/comandos/1')).toHaveLength(1)
    expect(ultimaConexao(registro)?.status).toBe('conectado')
  })

  it('rejeita com a mensagem da API quando ela recusa o comando', async () => {
    const api = apiFalsa()
    api.erroComando = { status: 400, erro: 'temperaturaAlvo deve estar entre 20 e 70 C' }
    const { transporte } = conectar()

    await expect(transporte.enviarTemperaturaAlvo(80)).rejects.toThrow('erro 400: temperaturaAlvo deve estar entre 20 e 70 C')
  })

  it('rejeita quando a API está fora do ar', async () => {
    const api = apiFalsa()
    api.fora = true
    const { transporte } = conectar()

    await expect(transporte.enviarComando(Comando.PARADA_EMERGENCIA)).rejects.toThrow('Sem resposta da API')
  })
})
