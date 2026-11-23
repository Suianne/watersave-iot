// Simulação do ESP32 e dos reservatórios, para desenvolver e apresentar o dashboard sem o hardware.
// A lógica de controle segue o comportamento esperado do firmware, descrito em docs/contrato-de-dados.md.

import {
  ALERTAS_DE_SENSOR,
  Comando,
  DS18B20_DESCONECTADO,
  EstadoSistema,
  FAIXA_TEMPERATURA_ALVO,
  INTERVALO_PUBLICACAO_S,
  leituraTemperaturaValida,
  type Telemetria,
} from '../contrato'
import type { EventosTransporte, Transporte } from './tipos'

export interface ParametrosSimulacao {
  temperaturaAmbiente: number
  temperaturaAlvo: number
  histerese: number
  /** L/min com a válvula aberta */
  vazaoNominal: number
  tempoMaximoAbertaS: number
  /** tempo tolerado com fluxo incoerente com o estado da válvula antes de virar falha */
  toleranciaFluxoS: number
  tempoInicializacaoS: number
  /** ruído entre -1 e 1; nos testes é fixado em 0 */
  ruido: () => number
}

export const PARAMETROS_PADRAO: ParametrosSimulacao = {
  temperaturaAmbiente: 27,
  temperaturaAlvo: 35,
  histerese: 2,
  vazaoNominal: 5,
  tempoMaximoAbertaS: 120,
  toleranciaFluxoS: 5,
  tempoInicializacaoS: 2,
  ruido: () => Math.random() * 2 - 1,
}

const VELOCIDADE_MISTURA = 3 // °C/s enquanto a água adicionada se mistura
const PERDA_TERMICA = 0.001 // fração da diferença para o ambiente perdida por segundo
const RESOLUCAO_DS18B20 = 0.0625 // 12 bits
const VAZAO_VAZAMENTO = 0.8
const VAZAO_MINIMA_ABERTA = 0.2
const VAZAO_MAXIMA_FECHADA = 0.5
const TEMPO_LEITURA_INVALIDA_S = 1
const LATENCIA_COMANDO_MS = 300

export interface FalhasSimuladas {
  sensorDesconectado: boolean
  mangueiraEntupida: boolean
  vazamento: boolean
}

export class DispositivoSimulado {
  readonly parametros: ParametrosSimulacao
  private falhas: FalhasSimuladas = { sensorDesconectado: false, mangueiraEntupida: false, vazamento: false }
  private temperaturaReal: number
  private misturaPendente = 0
  private leitura: number | null = null
  private alvo: number
  private estado: EstadoSistema = EstadoSistema.INICIANDO
  private valvula = false
  private alerta = ''
  private vazao = 0
  private volume = 0
  private tempoNoEstado = 0
  private tempoAberta = 0
  private tempoSemFluxo = 0
  private tempoFluxoFechada = 0
  private tempoLeituraInvalida = 0

  constructor(parametros: Partial<ParametrosSimulacao> = {}) {
    this.parametros = { ...PARAMETROS_PADRAO, ...parametros }
    this.temperaturaReal = this.parametros.temperaturaAmbiente
    this.alvo = this.parametros.temperaturaAlvo
  }

  /** Avança a simulação em dt segundos (um ciclo do loop() do firmware). */
  avancar(dt: number): void {
    this.simularFisica(dt)
    this.lerSensores()
    this.controlar(dt)
    this.verificarSeguranca(dt)
  }

  telemetria(): Telemetria {
    return {
      temperaturaAtual: this.leitura === null ? null : Math.round(this.leitura * 100) / 100,
      temperaturaAlvo: this.alvo,
      histerese: this.parametros.histerese,
      vazao: Math.round(this.vazao * 100) / 100,
      volumeTransferido: Math.round(this.volume * 1000) / 1000,
      valvulaAberta: this.valvula,
      estadoSistema: this.estado,
      alerta: this.alerta,
    }
  }

  /** Muda quando algo importante muda: dispara uma publicação imediata. */
  assinatura(): string {
    return `${this.estado}|${this.valvula}|${this.alerta}|${this.alvo}`
  }

  /** Aplica um comando do dashboard. Retorna false quando o intertravamento recusa. */
  comando(comando: Comando): boolean {
    switch (comando) {
      case Comando.PARADA_EMERGENCIA:
        this.falhar('PARADA_EMERGENCIA')
        return true
      case Comando.RESETAR_FALHA:
        if (this.estado !== EstadoSistema.FALHA || this.leitura === null) return false
        this.alerta = ''
        this.tempoFluxoFechada = 0
        this.mudarEstado(EstadoSistema.AGUARDANDO)
        return true
      case Comando.MODO_MANUAL:
        if (this.estado === EstadoSistema.INICIANDO || this.estado === EstadoSistema.MANUAL) return false
        this.fechar()
        if (!ALERTAS_DE_SENSOR.includes(this.alerta)) this.alerta = ''
        this.mudarEstado(EstadoSistema.MANUAL)
        return true
      case Comando.MODO_AUTOMATICO:
        if (this.estado !== EstadoSistema.MANUAL || this.leitura === null) return false
        this.fechar()
        this.alerta = ''
        this.mudarEstado(EstadoSistema.AGUARDANDO)
        return true
      case Comando.ABRIR_VALVULA:
        if (this.estado !== EstadoSistema.MANUAL || this.valvula) return false
        this.abrir()
        return true
      case Comando.FECHAR_VALVULA:
        if (this.estado !== EstadoSistema.MANUAL || !this.valvula) return false
        this.fechar()
        return true
    }
  }

  definirTemperaturaAlvo(valor: number): boolean {
    if (!Number.isFinite(valor) || valor < FAIXA_TEMPERATURA_ALVO.min || valor > FAIXA_TEMPERATURA_ALVO.max) return false
    this.alvo = Math.round(valor * 10) / 10
    return true
  }

  // --- controles do painel de simulação ---

  /** Positivo = água quente, negativo = água fria. A mistura leva alguns segundos. */
  adicionarAgua(variacao: number): void {
    this.misturaPendente += variacao
  }

  definirTemperaturaReal(valor: number): void {
    this.temperaturaReal = valor
    this.misturaPendente = 0
  }

  definirFalha(falha: keyof FalhasSimuladas, ativa: boolean): void {
    this.falhas = { ...this.falhas, [falha]: ativa }
  }

  falhasAtivas(): FalhasSimuladas {
    return { ...this.falhas }
  }

  /** Comportamento após reinicialização: válvula fechada, volume zerado, alvo mantido (NVS). */
  reiniciar(): void {
    this.fechar()
    this.alerta = ''
    this.volume = 0
    this.leitura = null
    this.tempoLeituraInvalida = 0
    this.mudarEstado(EstadoSistema.INICIANDO)
  }

  // --- internos ---

  private simularFisica(dt: number): void {
    const passo = Math.sign(this.misturaPendente) * Math.min(Math.abs(this.misturaPendente), VELOCIDADE_MISTURA * dt)
    this.temperaturaReal = Math.min(80, Math.max(10, this.temperaturaReal + passo))
    this.misturaPendente -= passo
    this.temperaturaReal += (this.parametros.temperaturaAmbiente - this.temperaturaReal) * PERDA_TERMICA * dt

    let vazaoReal = 0
    if (this.valvula && !this.falhas.mangueiraEntupida) vazaoReal = this.parametros.vazaoNominal
    else if (!this.valvula && this.falhas.vazamento) vazaoReal = VAZAO_VAZAMENTO
    this.vazao = vazaoReal > 0 ? Math.max(0, vazaoReal + this.parametros.ruido() * 0.2) : 0
    this.volume += (this.vazao / 60) * dt
  }

  private lerSensores(): void {
    const bruta = this.falhas.sensorDesconectado
      ? DS18B20_DESCONECTADO
      : this.temperaturaReal + this.parametros.ruido() * 0.15
    this.leitura = leituraTemperaturaValida(bruta) ? Math.round(bruta / RESOLUCAO_DS18B20) * RESOLUCAO_DS18B20 : null
  }

  private controlar(dt: number): void {
    this.tempoNoEstado += dt
    this.tempoLeituraInvalida = this.leitura === null ? this.tempoLeituraInvalida + dt : 0
    const sensorFalhou = this.tempoLeituraInvalida >= TEMPO_LEITURA_INVALIDA_S
    const codigoSensor = this.falhas.sensorDesconectado ? 'SENSOR_TEMP_DESCONECTADO' : 'LEITURA_TEMP_INVALIDA'
    const { histerese, tempoInicializacaoS } = this.parametros

    switch (this.estado) {
      case EstadoSistema.INICIANDO:
        if (this.tempoNoEstado < tempoInicializacaoS) return
        if (this.leitura !== null) this.mudarEstado(EstadoSistema.AGUARDANDO)
        else if (sensorFalhou) this.falhar(codigoSensor)
        return
      case EstadoSistema.AGUARDANDO:
        if (sensorFalhou) this.falhar(codigoSensor)
        else if (this.leitura !== null && this.leitura >= this.alvo) {
          this.abrir()
          this.mudarEstado(EstadoSistema.TRANSFERINDO)
        }
        return
      case EstadoSistema.TRANSFERINDO:
        if (sensorFalhou) this.falhar(codigoSensor)
        else if (this.leitura !== null && this.leitura <= this.alvo - histerese) {
          this.fechar()
          this.mudarEstado(EstadoSistema.AGUARDANDO)
        }
        return
      case EstadoSistema.MANUAL:
        // no manual a falha do sensor não bloqueia a válvula, só fica sinalizada
        if (sensorFalhou) this.alerta = codigoSensor
        else if (ALERTAS_DE_SENSOR.includes(this.alerta)) this.alerta = ''
        return
      case EstadoSistema.FALHA:
        return
    }
  }

  private verificarSeguranca(dt: number): void {
    const { tempoMaximoAbertaS, toleranciaFluxoS } = this.parametros
    if (this.valvula) {
      this.tempoAberta += dt
      this.tempoSemFluxo = this.vazao < VAZAO_MINIMA_ABERTA ? this.tempoSemFluxo + dt : 0
      if (this.tempoAberta > tempoMaximoAbertaS) this.falhar('TEMPO_MAXIMO_EXCEDIDO')
      else if (this.tempoSemFluxo > toleranciaFluxoS) this.falhar('SEM_FLUXO_VALVULA_ABERTA')
    } else {
      this.tempoFluxoFechada = this.vazao > VAZAO_MAXIMA_FECHADA ? this.tempoFluxoFechada + dt : 0
      if (this.estado !== EstadoSistema.FALHA && this.tempoFluxoFechada > toleranciaFluxoS)
        this.falhar('FLUXO_VALVULA_FECHADA')
    }
  }

  private abrir(): void {
    this.valvula = true
    this.tempoAberta = 0
    this.tempoSemFluxo = 0
  }

  private fechar(): void {
    this.valvula = false
    this.tempoFluxoFechada = 0
  }

  private falhar(codigo: string): void {
    this.fechar()
    this.alerta = codigo
    this.mudarEstado(EstadoSistema.FALHA)
  }

  private mudarEstado(estado: EstadoSistema): void {
    this.estado = estado
    this.tempoNoEstado = 0
  }
}

/** Faz o papel do ESP32 + rede: publica a telemetria como o firmware faria. */
export class TransporteSimulado implements Transporte {
  readonly dispositivo: DispositivoSimulado
  private eventos: EventosTransporte | null = null
  private relogio: ReturnType<typeof setInterval> | null = null
  private ultimoTick = 0
  private desdeUltimaPublicacao = 0
  private ultimaAssinatura = ''
  private online = false
  private offlineAte = 0

  constructor(dispositivo = new DispositivoSimulado()) {
    this.dispositivo = dispositivo
  }

  iniciar(eventos: EventosTransporte): void {
    this.eventos = eventos
    eventos.aoMudarConexao('conectado')
    this.definirOnline(true)
    this.ultimoTick = performance.now()
    this.relogio = setInterval(() => this.tick(), 250)
  }

  encerrar(): void {
    if (this.relogio) clearInterval(this.relogio)
    this.relogio = null
    this.eventos = null
  }

  enviarComando(comando: Comando): void {
    if (!this.online) return
    setTimeout(() => {
      this.dispositivo.comando(comando)
      this.publicar()
    }, LATENCIA_COMANDO_MS)
  }

  enviarTemperaturaAlvo(valor: number): void {
    if (!this.online) return
    setTimeout(() => {
      this.dispositivo.definirTemperaturaAlvo(valor)
      this.publicar()
    }, LATENCIA_COMANDO_MS)
  }

  /** O ESP32 continua controlando a válvula localmente; só para de publicar. */
  simularPerdaWifi(segundos: number): void {
    this.offlineAte = Date.now() + segundos * 1000
    this.definirOnline(false)
  }

  reiniciarEsp32(): void {
    this.dispositivo.reiniciar()
    this.simularPerdaWifi(4)
  }

  private tick(): void {
    const agora = performance.now()
    // abas em segundo plano têm o timer atrasado: limita o passo para a física não explodir
    const dt = Math.min((agora - this.ultimoTick) / 1000, 5)
    this.ultimoTick = agora
    this.dispositivo.avancar(dt)

    if (!this.online) {
      if (Date.now() < this.offlineAte) return
      this.definirOnline(true)
    }

    this.desdeUltimaPublicacao += dt
    if (
      this.desdeUltimaPublicacao >= INTERVALO_PUBLICACAO_S ||
      this.dispositivo.assinatura() !== this.ultimaAssinatura
    ) {
      this.publicar()
    }
  }

  private publicar(): void {
    if (!this.eventos || !this.online) return
    this.desdeUltimaPublicacao = 0
    this.ultimaAssinatura = this.dispositivo.assinatura()
    this.eventos.aoReceberTelemetria(this.dispositivo.telemetria())
  }

  private definirOnline(online: boolean): void {
    this.online = online
    this.eventos?.aoMudarDispositivoOnline(online)
  }
}
