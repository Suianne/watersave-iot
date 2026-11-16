import type { Comando, Telemetria } from '../contrato'

export type StatusConexao = 'conectando' | 'conectado' | 'desconectado' | 'erro'

export interface EventosTransporte {
  aoReceberTelemetria(telemetria: Telemetria): void
  /** conexão do dashboard com o broker (ou com o simulador) */
  aoMudarConexao(status: StatusConexao, detalhe?: string): void
  /** presença do ESP32 (tópico online / Last Will) */
  aoMudarDispositivoOnline(online: boolean): void
  aoReceberPacoteInvalido(conteudo: string): void
}

/** Fonte de dados do dashboard: simulação no navegador ou ESP32 real via MQTT. */
export interface Transporte {
  iniciar(eventos: EventosTransporte): void
  encerrar(): void
  enviarComando(comando: Comando): void
  enviarTemperaturaAlvo(valor: number): void
}
