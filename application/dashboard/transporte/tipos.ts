import type { Comando, Telemetria } from '../contrato'

export type StatusConexao = 'conectando' | 'conectado' | 'desconectado' | 'erro'

export interface LeituraHistorica {
  telemetria: Telemetria
  /** instante (ms) em que a leitura foi feita */
  instante: number
}

export interface EventosTransporte {
  /** instante (ms) em que a leitura foi feita; sem ele, vale o momento do recebimento */
  aoReceberTelemetria(telemetria: Telemetria, instante?: number): void
  /** leituras antigas em ordem cronológica, só para os gráficos (não geram ocorrências) */
  aoReceberHistorico(leituras: LeituraHistorica[]): void
  /** conexão do dashboard com a API (ou com o simulador) */
  aoMudarConexao(status: StatusConexao, detalhe?: string): void
  /** presença do ESP32: online enquanto envia leituras */
  aoMudarDispositivoOnline(online: boolean): void
  aoReceberPacoteInvalido(conteudo: string): void
}

/** Fonte de dados do dashboard: simulação no navegador ou ESP32 real pela API REST. */
export interface Transporte {
  /** quanto esperar a telemetria refletir um comando antes de avisar que ele não foi aplicado */
  readonly tempoConfirmacaoMs: number
  iniciar(eventos: EventosTransporte): void
  encerrar(): void
  /**
   * Resolve quando o ESP32 recebeu e avaliou o comando (aceito ou recusado pelos intertravamentos).
   * Rejeita com o motivo quando o comando não chegou: API fora do ar, recusado pela API ou expirado.
   */
  enviarComando(comando: Comando): Promise<void>
  enviarTemperaturaAlvo(valor: number): Promise<void>
}
