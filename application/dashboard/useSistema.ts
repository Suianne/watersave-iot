import { useCallback, useEffect, useRef, useState } from 'react'
import { LIMITE_DADOS_ATUALIZADOS_S, NOME_COMANDO, type Comando, type Telemetria } from './contrato'
import { gravarJson, lerLista } from './armazenamento'
import type { Configuracao, TipoFonte } from './configuracao'
import { eventosDaTransicao, type Evento, type NovoEvento } from './eventos'
import { formatarTemperatura } from './formatar'
import { adicionarPonto, adicionarPontos, pontoDaTelemetria, type PontoHistorico } from './historico'
import { comandoConfirmado } from './intertravamentos'
import { notificar } from './notificacoes'
import { TransporteHttp } from './transporte/http'
import { TransporteSimulado } from './transporte/simulado'
import type { StatusConexao, Transporte } from './transporte/tipos'

/** entregueEm: quando o transporte informou que o ESP32 recebeu e avaliou o comando */
export type Pendente = (
  | { tipo: 'comando'; comando: Comando }
  | { tipo: 'alvo'; valor: number }
) & { enviadoEm: number; entregueEm?: number }

/** depois de avaliado pelo ESP32, o efeito aparece na leitura seguinte (2 s): 6 s dá folga */
const PRAZO_APOS_ENTREGA_MS = 6000
const MAX_EVENTOS = 200
const INTERVALO_SALVAMENTO_MS = 5000

const chaveHistorico = (fonte: TipoFonte) => `watersave:historico:${fonte}`
const chaveEventos = (fonte: TipoFonte) => `watersave:eventos:${fonte}`

let contadorEventos = 0

function descreverPendente(pendente: Pendente): string {
  return pendente.tipo === 'comando'
    ? NOME_COMANDO[pendente.comando]
    : `temperatura-alvo ${formatarTemperatura(pendente.valor)}`
}

/**
 * Estado do dashboard: conecta na fonte de dados, guarda histórico e ocorrências
 * e acompanha se os comandos enviados foram aplicados pelo ESP32.
 * O componente que usa este hook deve ser remontado (key) quando a fonte mudar.
 */
export function useSistema(configuracao: Configuracao) {
  const { fonte } = configuracao
  // string estável: reconecta só quando a fonte ou o endereço da API mudam
  const idConexao = JSON.stringify(fonte === 'api' ? configuracao.api : 'simulacao')

  const [telemetria, setTelemetria] = useState<Telemetria | null>(null)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<number | null>(null)
  const [conexao, setConexao] = useState<{ status: StatusConexao; detalhe?: string }>({ status: 'conectando' })
  const [dispositivoOnline, setDispositivoOnline] = useState(false)
  const [historico, setHistorico] = useState<PontoHistorico[]>(() => lerLista(chaveHistorico(fonte)))
  const [eventos, setEventos] = useState<Evento[]>(() => lerLista(chaveEventos(fonte)))
  const [pendente, setPendente] = useState<Pendente | null>(null)
  const [simulador, setSimulador] = useState<TransporteSimulado | null>(null)
  const [agora, setAgora] = useState(() => Date.now())

  const transporteRef = useRef<Transporte | null>(null)
  const anteriorRef = useRef<Telemetria | null>(null)
  const onlineRef = useRef<boolean | null>(null)
  const historicoRef = useRef(historico)
  const eventosRef = useRef(eventos)
  const ultimoSalvamentoRef = useRef(0)

  const registrar = useCallback((novos: NovoEvento[]) => {
    if (novos.length === 0) return
    const instante = Date.now()
    const comId = novos.map((evento) => ({ ...evento, t: instante, id: `${instante}-${contadorEventos++}` }))
    setEventos((atuais) => [...comId.reverse(), ...atuais].slice(0, MAX_EVENTOS))
    for (const evento of novos) if (evento.nivel === 'falha') notificar(evento.titulo, evento.detalhe)
  }, [])

  // conexão com a fonte de dados
  useEffect(() => {
    const config = JSON.parse(idConexao) as Configuracao['api'] | 'simulacao'
    const transporte = config === 'simulacao' ? new TransporteSimulado() : new TransporteHttp(config)
    transporteRef.current = transporte
    anteriorRef.current = null
    onlineRef.current = null
    setTelemetria(null)
    setUltimaAtualizacao(null)
    setPendente(null)
    setDispositivoOnline(false)
    setSimulador(transporte instanceof TransporteSimulado ? transporte : null)

    const mudarOnline = (online: boolean) => {
      const antes = onlineRef.current
      if (antes === online) return
      onlineRef.current = online
      setDispositivoOnline(online)
      if (antes === null) return
      registrar([
        online
          ? { nivel: 'info', titulo: 'ESP32 voltou a ficar online' }
          : {
              nivel: 'aviso',
              titulo: 'ESP32 ficou offline',
              detalhe:
                'O controle local continua no ESP32. O dashboard volta a receber dados quando a conexão for restabelecida.',
            },
      ])
    }

    transporte.iniciar({
      aoReceberTelemetria(nova, instante = Date.now()) {
        registrar(eventosDaTransicao(anteriorRef.current, nova))
        anteriorRef.current = nova
        setTelemetria(nova)
        setUltimaAtualizacao(instante)
        setHistorico((atual) => adicionarPonto(atual, pontoDaTelemetria(instante, nova)))
      },
      aoReceberHistorico(leituras) {
        const pontos = leituras.map(({ telemetria, instante }) => pontoDaTelemetria(instante, telemetria))
        setHistorico((atual) => adicionarPontos(atual, pontos))
      },
      aoMudarConexao(status, detalhe) {
        setConexao({ status, detalhe })
      },
      aoMudarDispositivoOnline: mudarOnline,
      aoReceberPacoteInvalido(conteudo) {
        registrar([
          {
            nivel: 'aviso',
            titulo: 'Pacote fora do contrato de dados recebido',
            detalhe: conteudo.length > 160 ? `${conteudo.slice(0, 160)}…` : conteudo,
          },
        ])
      },
    })

    return () => {
      transporte.encerrar()
      transporteRef.current = null
    }
  }, [idConexao, registrar])

  // relógio para "atualizado há X s", dados desatualizados e timeout de comandos
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // confirmação dos comandos pela telemetria
  useEffect(() => {
    if (!pendente || !telemetria) return
    const confirmado =
      pendente.tipo === 'comando'
        ? comandoConfirmado(pendente.comando, telemetria)
        : Math.abs(telemetria.temperaturaAlvo - pendente.valor) < 0.05
    if (confirmado) setPendente(null)
  }, [telemetria, pendente])

  useEffect(() => {
    if (!pendente) return
    const prazo =
      pendente.entregueEm !== undefined
        ? pendente.entregueEm + PRAZO_APOS_ENTREGA_MS
        : pendente.enviadoEm + (transporteRef.current?.tempoConfirmacaoMs ?? 0)
    if (agora <= prazo) return
    registrar([
      pendente.entregueEm !== undefined
        ? {
            nivel: 'aviso',
            titulo: `O ESP32 não aplicou: ${descreverPendente(pendente)}`,
            detalhe:
              'O ESP32 recebeu o comando, mas a telemetria não mostrou o efeito: ele foi recusado pelos ' +
              'intertravamentos do firmware. O motivo aparece no Monitor Serial.',
          }
        : {
            nivel: 'aviso',
            titulo: `Sem confirmação do ESP32: ${descreverPendente(pendente)}`,
            detalhe: 'O comando pode ter sido recusado pelos intertravamentos do firmware ou não chegou ao dispositivo.',
          },
    ])
    setPendente(null)
  }, [agora, pendente, registrar])

  // persistência local do histórico e das ocorrências
  useEffect(() => {
    historicoRef.current = historico
    if (Date.now() - ultimoSalvamentoRef.current < INTERVALO_SALVAMENTO_MS) return
    ultimoSalvamentoRef.current = Date.now()
    gravarJson(chaveHistorico(fonte), historico)
  }, [historico, fonte])

  useEffect(() => {
    eventosRef.current = eventos
    gravarJson(chaveEventos(fonte), eventos)
  }, [eventos, fonte])

  useEffect(() => {
    const salvarAgora = () => gravarJson(chaveHistorico(fonte), historicoRef.current)
    window.addEventListener('pagehide', salvarAgora)
    document.addEventListener('visibilitychange', salvarAgora)
    return () => {
      window.removeEventListener('pagehide', salvarAgora)
      document.removeEventListener('visibilitychange', salvarAgora)
      salvarAgora()
    }
  }, [fonte])

  // o transporte informa se o comando chegou ao ESP32; a telemetria, se ele foi aplicado
  const acompanharEnvio = useCallback(
    (pedido: Pendente, envio: Promise<void>) => {
      setPendente(pedido)
      envio.then(
        () => setPendente((atual) => (atual === pedido ? { ...pedido, entregueEm: Date.now() } : atual)),
        (erro: unknown) => {
          // não chegou (API fora do ar, recusado pela API ou expirado): não há o que esperar na telemetria
          setPendente((atual) => (atual === pedido ? null : atual))
          registrar([
            {
              nivel: 'aviso',
              titulo: `Comando não entregue: ${descreverPendente(pedido)}`,
              detalhe: erro instanceof Error ? erro.message : String(erro),
            },
          ])
        },
      )
    },
    [registrar],
  )

  const enviarComando = useCallback(
    (comando: Comando) => {
      const transporte = transporteRef.current
      if (!transporte) return
      registrar([{ nivel: 'info', titulo: `Comando enviado: ${NOME_COMANDO[comando]}` }])
      acompanharEnvio({ tipo: 'comando', comando, enviadoEm: Date.now() }, transporte.enviarComando(comando))
    },
    [registrar, acompanharEnvio],
  )

  const enviarTemperaturaAlvo = useCallback(
    (valor: number) => {
      const transporte = transporteRef.current
      if (!transporte) return
      registrar([{ nivel: 'info', titulo: `Nova temperatura-alvo enviada: ${formatarTemperatura(valor)}` }])
      acompanharEnvio({ tipo: 'alvo', valor, enviadoEm: Date.now() }, transporte.enviarTemperaturaAlvo(valor))
    },
    [registrar, acompanharEnvio],
  )

  const limparHistorico = useCallback(() => {
    setHistorico([])
    setEventos([])
    gravarJson(chaveHistorico(fonte), [])
  }, [fonte])

  const dadosAtualizados =
    ultimaAtualizacao !== null && agora - ultimaAtualizacao <= LIMITE_DADOS_ATUALIZADOS_S * 1000

  return {
    telemetria,
    ultimaAtualizacao,
    dadosAtualizados,
    conexao,
    dispositivoOnline,
    historico,
    eventos,
    pendente,
    simulador,
    agora,
    enviarComando,
    enviarTemperaturaAlvo,
    limparHistorico,
  }
}

export type Sistema = ReturnType<typeof useSistema>
