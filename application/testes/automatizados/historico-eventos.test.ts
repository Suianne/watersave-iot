import { describe, expect, it } from 'vitest'
import { EstadoSistema, type Telemetria } from '../../dashboard/contrato'
import { eventosDaTransicao } from '../../dashboard/eventos'
import {
  MAX_PONTOS,
  adicionarPonto,
  adicionarPontos,
  ehLacuna,
  filtrarJanela,
  pontoDaTelemetria,
  reduzir,
  type PontoHistorico,
} from '../../dashboard/historico'

function telemetria(parcial: Partial<Telemetria> = {}): Telemetria {
  return {
    temperaturaAtual: 30,
    temperaturaAlvo: 35,
    histerese: 2,
    vazao: 0,
    volumeTransferido: 0,
    valvulaAberta: false,
    estadoSistema: EstadoSistema.AGUARDANDO,
    alerta: '',
    ...parcial,
  }
}

describe('histórico dos gráficos', () => {
  it('guarda o limite de abertura e o de fechamento junto de cada ponto', () => {
    const ponto = pontoDaTelemetria(1000, telemetria({ valvulaAberta: true, vazao: 4.5 }))
    expect(ponto).toEqual({ t: 1000, temperatura: 30, alvo: 35, fecha: 33, vazao: 4.5, valvula: 1 })
  })

  it('insere uma lacuna quando o ESP32 fica mais de 10 s sem enviar (queda de Wi-Fi)', () => {
    let historico: PontoHistorico[] = []
    historico = adicionarPonto(historico, pontoDaTelemetria(0, telemetria()))
    historico = adicionarPonto(historico, pontoDaTelemetria(2_000, telemetria()))
    historico = adicionarPonto(historico, pontoDaTelemetria(30_000, telemetria()))
    expect(historico).toHaveLength(4)
    expect(ehLacuna(historico[2])).toBe(true)
  })

  it('ignora leitura que não é mais nova que o último ponto (a API repete a última ao recarregar a página)', () => {
    let historico: PontoHistorico[] = []
    historico = adicionarPonto(historico, pontoDaTelemetria(2_000, telemetria()))
    historico = adicionarPonto(historico, pontoDaTelemetria(1_000, telemetria()))
    historico = adicionarPonto(historico, pontoDaTelemetria(2_000, telemetria()))
    expect(historico.map((ponto) => ponto.t)).toEqual([2_000])
  })

  it('junta o histórico da API ao salvo no navegador, com lacuna onde o ESP32 ficou sem enviar', () => {
    const salvo = [pontoDaTelemetria(0, telemetria())]
    const daApi = [0, 2_000, 4_000, 60_000].map((t) => pontoDaTelemetria(t, telemetria()))
    const historico = adicionarPontos(salvo, daApi)
    expect(historico.map((ponto) => (ehLacuna(ponto) ? 'lacuna' : ponto.t))).toEqual([0, 2_000, 4_000, 'lacuna', 60_000])
    // nada de novo: devolve o mesmo histórico, sem redesenhar os gráficos
    expect(adicionarPontos(historico, [pontoDaTelemetria(60_000, telemetria())])).toBe(historico)
  })

  it('limita a quantidade de pontos guardados', () => {
    let historico: PontoHistorico[] = []
    for (let i = 0; i < MAX_PONTOS + 50; i++) historico = adicionarPonto(historico, pontoDaTelemetria(i * 2000, telemetria()))
    expect(historico).toHaveLength(MAX_PONTOS)
    expect(historico.at(-1)?.t).toBe((MAX_PONTOS + 49) * 2000)
  })

  it('filtra pela janela de tempo escolhida', () => {
    const historico = [0, 60_000, 120_000].map((t) => pontoDaTelemetria(t, telemetria()))
    expect(filtrarJanela(historico, 60_000, 120_000)).toHaveLength(2)
    expect(filtrarJanela(historico, null, 120_000)).toHaveLength(3)
  })

  it('reduz pontos para o gráfico sem perder lacunas nem o último ponto', () => {
    let historico: PontoHistorico[] = []
    for (let i = 0; i < 2000; i++) historico = adicionarPonto(historico, pontoDaTelemetria(i * 2000, telemetria()))
    historico = adicionarPonto(historico, pontoDaTelemetria(2000 * 2000 + 60_000, telemetria()))
    const reduzido = reduzir(historico, 300)
    expect(reduzido.length).toBeLessThanOrEqual(310)
    expect(reduzido.some(ehLacuna)).toBe(true)
    expect(reduzido.at(-1)).toBe(historico.at(-1))
  })
})

describe('registro de ocorrências', () => {
  it('registra os primeiros dados e um alerta que já esteja ativo', () => {
    const eventos = eventosDaTransicao(null, telemetria({ alerta: 'FLUXO_VALVULA_FECHADA' }))
    expect(eventos.map((e) => e.titulo)).toEqual(['Primeiros dados recebidos do ESP32', 'Fluxo com a válvula fechada'])
  })

  it('registra abertura e fechamento da válvula', () => {
    expect(eventosDaTransicao(telemetria(), telemetria({ valvulaAberta: true })).map((e) => e.titulo)).toContain(
      'Válvula aberta',
    )
  })

  it('registra falhas com nível "falha" e a resolução do alerta', () => {
    const falha = eventosDaTransicao(
      telemetria(),
      telemetria({ estadoSistema: EstadoSistema.FALHA, alerta: 'TEMPO_MAXIMO_EXCEDIDO' }),
    )
    expect(falha.find((e) => e.titulo === 'Tempo máximo de abertura excedido')?.nivel).toBe('falha')

    const resolvido = eventosDaTransicao(telemetria({ alerta: 'TEMPO_MAXIMO_EXCEDIDO' }), telemetria())
    expect(resolvido[0].titulo).toBe('Alerta resolvido: Tempo máximo de abertura excedido')
  })

  it('avisa quando o ESP32 reinicia', () => {
    const eventos = eventosDaTransicao(telemetria(), telemetria({ estadoSistema: EstadoSistema.INICIANDO }))
    expect(eventos[0]).toMatchObject({ nivel: 'aviso', titulo: 'ESP32 reiniciou' })
  })

  it('não registra nada quando nada relevante mudou', () => {
    expect(eventosDaTransicao(telemetria(), telemetria({ temperaturaAtual: 30.5, vazao: 0 }))).toEqual([])
  })
})
