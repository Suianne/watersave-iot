// Conexão com o ESP32 real: MQTT sobre WebSocket direto do navegador, sem backend.

import mqtt, { type MqttClient } from 'mqtt'
import { parseTelemetria, topicos, type Comando } from '../contrato'
import type { ConfigMqtt } from '../configuracao'
import type { EventosTransporte, Transporte } from './tipos'

export class TransporteMqtt implements Transporte {
  private cliente: MqttClient | null = null
  private readonly topicos: ReturnType<typeof topicos>
  private readonly config: ConfigMqtt

  constructor(config: ConfigMqtt) {
    this.config = config
    this.topicos = topicos(config.prefixo)
  }

  iniciar(eventos: EventosTransporte): void {
    eventos.aoMudarConexao('conectando')
    const cliente = mqtt.connect(this.config.url, {
      username: this.config.usuario || undefined,
      password: this.config.senha || undefined,
      clientId: `watersave-dashboard-${Math.random().toString(16).slice(2, 10)}`,
      reconnectPeriod: 3000,
      connectTimeout: 10_000,
      clean: true,
    })
    this.cliente = cliente

    cliente.on('connect', () => {
      eventos.aoMudarConexao('conectado')
      cliente.subscribe([this.topicos.estado, this.topicos.online], { qos: 1 })
    })
    cliente.on('reconnect', () => eventos.aoMudarConexao('conectando'))
    cliente.on('close', () => eventos.aoMudarConexao('desconectado'))
    cliente.on('error', (erro) => eventos.aoMudarConexao('erro', erro.message))

    cliente.on('message', (topico, payload) => {
      const texto = payload.toString()
      if (topico === this.topicos.online) {
        eventos.aoMudarDispositivoOnline(texto.trim() === '1')
        return
      }
      if (topico !== this.topicos.estado) return
      let json: unknown
      try {
        json = JSON.parse(texto)
      } catch {
        eventos.aoReceberPacoteInvalido(texto)
        return
      }
      const telemetria = parseTelemetria(json)
      if (telemetria) eventos.aoReceberTelemetria(telemetria)
      else eventos.aoReceberPacoteInvalido(texto)
    })
  }

  encerrar(): void {
    this.cliente?.end(true)
    this.cliente = null
  }

  enviarComando(comando: Comando): void {
    // comando nunca é retido: um "abrir válvula" antigo não pode ser reexecutado quando o ESP32 reconectar
    this.cliente?.publish(this.topicos.comando, String(comando), { qos: 1, retain: false })
  }

  enviarTemperaturaAlvo(valor: number): void {
    // retido: o ESP32 recebe o alvo atual assim que (re)conectar
    this.cliente?.publish(this.topicos.temperaturaAlvo, valor.toFixed(1), { qos: 1, retain: true })
  }
}
