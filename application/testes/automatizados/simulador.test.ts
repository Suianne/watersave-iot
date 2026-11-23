// O simulador é a referência do comportamento esperado do firmware (docs/contrato-de-dados.md).
// Estes testes servem também de roteiro para validar o ESP32 real na camada de serviço.

import { describe, expect, it } from 'vitest'
import { Comando, EstadoSistema } from '../../dashboard/contrato'
import { DispositivoSimulado } from '../../dashboard/transporte/simulado'

function novoDispositivo() {
  const dispositivo = new DispositivoSimulado({ ruido: () => 0, temperaturaAmbiente: 27, temperaturaAlvo: 35, histerese: 2 })
  avancar(dispositivo, 3) // passa da inicialização
  return dispositivo
}

function avancar(dispositivo: DispositivoSimulado, segundos: number, passo = 0.25) {
  for (let t = 0; t < segundos; t += passo) dispositivo.avancar(passo)
}

const estado = (d: DispositivoSimulado) => d.telemetria().estadoSistema
const valvula = (d: DispositivoSimulado) => d.telemetria().valvulaAberta

describe('inicialização', () => {
  it('liga com a válvula fechada e passa para aguardando após a primeira leitura válida', () => {
    const dispositivo = new DispositivoSimulado({ ruido: () => 0 })
    expect(estado(dispositivo)).toBe(EstadoSistema.INICIANDO)
    expect(valvula(dispositivo)).toBe(false)
    avancar(dispositivo, 3)
    expect(estado(dispositivo)).toBe(EstadoSistema.AGUARDANDO)
  })

  it('após reiniciar volta fechada, zera o volume e mantém a temperatura-alvo', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirTemperaturaAlvo(40)
    dispositivo.comando(Comando.MODO_MANUAL)
    dispositivo.comando(Comando.ABRIR_VALVULA)
    avancar(dispositivo, 10)
    dispositivo.reiniciar()
    const t = dispositivo.telemetria()
    expect(t.estadoSistema).toBe(EstadoSistema.INICIANDO)
    expect(t.valvulaAberta).toBe(false)
    expect(t.volumeTransferido).toBe(0)
    expect(t.temperaturaAlvo).toBe(40)
  })
})

describe('controle automático com histerese', () => {
  it('abre quando a água atinge a temperatura-alvo', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirTemperaturaReal(35.2)
    avancar(dispositivo, 0.5)
    expect(valvula(dispositivo)).toBe(true)
    expect(estado(dispositivo)).toBe(EstadoSistema.TRANSFERINDO)
  })

  it('não abre logo abaixo do alvo', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirTemperaturaReal(34.8)
    avancar(dispositivo, 1)
    expect(valvula(dispositivo)).toBe(false)
  })

  it('não fecha enquanto a temperatura está dentro da faixa de histerese', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirTemperaturaReal(36)
    avancar(dispositivo, 0.5)
    dispositivo.definirTemperaturaReal(33.5)
    avancar(dispositivo, 1)
    expect(valvula(dispositivo)).toBe(true)
  })

  it('fecha quando a temperatura cai até alvo - histerese (água fria)', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirTemperaturaReal(36)
    avancar(dispositivo, 0.5)
    dispositivo.definirTemperaturaReal(32.5)
    avancar(dispositivo, 0.5)
    expect(valvula(dispositivo)).toBe(false)
    expect(estado(dispositivo)).toBe(EstadoSistema.AGUARDANDO)
  })

  it('cenário da apresentação: água quente abre, água fria fecha', () => {
    const dispositivo = novoDispositivo()
    dispositivo.adicionarAgua(12)
    avancar(dispositivo, 6)
    expect(valvula(dispositivo)).toBe(true)
    dispositivo.adicionarAgua(-12)
    avancar(dispositivo, 6)
    expect(valvula(dispositivo)).toBe(false)
  })

  it('calcula o volume transferido a partir da vazão (5 L/min por 60 s ≈ 5 L)', () => {
    const dispositivo = novoDispositivo()
    dispositivo.comando(Comando.MODO_MANUAL)
    dispositivo.comando(Comando.ABRIR_VALVULA)
    avancar(dispositivo, 60)
    expect(dispositivo.telemetria().volumeTransferido).toBeCloseTo(5, 1)
  })
})

describe('proteções', () => {
  it('sensor desconectado fecha a válvula e entra em falha', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirTemperaturaReal(36)
    avancar(dispositivo, 0.5)
    dispositivo.definirFalha('sensorDesconectado', true)
    avancar(dispositivo, 2)
    const t = dispositivo.telemetria()
    expect(t.estadoSistema).toBe(EstadoSistema.FALHA)
    expect(t.alerta).toBe('SENSOR_TEMP_DESCONECTADO')
    expect(t.valvulaAberta).toBe(false)
    expect(t.temperaturaAtual).toBeNull()
  })

  it('válvula aberta sem fluxo vira falha depois da tolerância', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirFalha('mangueiraEntupida', true)
    dispositivo.definirTemperaturaReal(36)
    avancar(dispositivo, 4)
    expect(estado(dispositivo)).toBe(EstadoSistema.TRANSFERINDO)
    avancar(dispositivo, 3)
    expect(dispositivo.telemetria().alerta).toBe('SEM_FLUXO_VALVULA_ABERTA')
    expect(valvula(dispositivo)).toBe(false)
  })

  it('fluxo com a válvula fechada (vazamento) vira falha', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirFalha('vazamento', true)
    avancar(dispositivo, 7)
    expect(dispositivo.telemetria().alerta).toBe('FLUXO_VALVULA_FECHADA')
  })

  it('fecha a válvula ao exceder o tempo máximo de abertura', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirTemperaturaReal(40)
    avancar(dispositivo, 119)
    expect(valvula(dispositivo)).toBe(true)
    avancar(dispositivo, 2)
    expect(dispositivo.telemetria().alerta).toBe('TEMPO_MAXIMO_EXCEDIDO')
    expect(valvula(dispositivo)).toBe(false)
  })

  it('parada de emergência fecha a válvula em qualquer estado', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirTemperaturaReal(36)
    avancar(dispositivo, 0.5)
    expect(dispositivo.comando(Comando.PARADA_EMERGENCIA)).toBe(true)
    expect(valvula(dispositivo)).toBe(false)
    expect(dispositivo.telemetria().alerta).toBe('PARADA_EMERGENCIA')
  })
})

describe('comandos e reinício após falha', () => {
  it('em falha a válvula não reabre sozinha mesmo com a temperatura no alvo', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirTemperaturaReal(36)
    avancar(dispositivo, 0.5)
    dispositivo.comando(Comando.PARADA_EMERGENCIA)
    avancar(dispositivo, 5)
    expect(valvula(dispositivo)).toBe(false)
  })

  it('resetar a falha volta ao automático, que reabre se a temperatura estiver no alvo', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirTemperaturaReal(36)
    avancar(dispositivo, 0.5)
    dispositivo.comando(Comando.PARADA_EMERGENCIA)
    expect(dispositivo.comando(Comando.RESETAR_FALHA)).toBe(true)
    avancar(dispositivo, 0.5)
    expect(estado(dispositivo)).toBe(EstadoSistema.TRANSFERINDO)
  })

  it('recusa resetar a falha com o sensor ainda desconectado', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirFalha('sensorDesconectado', true)
    avancar(dispositivo, 2)
    expect(dispositivo.comando(Comando.RESETAR_FALHA)).toBe(false)
    expect(estado(dispositivo)).toBe(EstadoSistema.FALHA)
  })

  it('com o sensor em falha, o modo manual ainda permite abrir a válvula', () => {
    const dispositivo = novoDispositivo()
    dispositivo.definirFalha('sensorDesconectado', true)
    avancar(dispositivo, 2)
    expect(dispositivo.comando(Comando.MODO_MANUAL)).toBe(true)
    expect(dispositivo.comando(Comando.ABRIR_VALVULA)).toBe(true)
    avancar(dispositivo, 2)
    expect(valvula(dispositivo)).toBe(true)
    expect(dispositivo.telemetria().alerta).toBe('SENSOR_TEMP_DESCONECTADO')
  })

  it('recusa abrir a válvula fora do modo manual', () => {
    const dispositivo = novoDispositivo()
    expect(dispositivo.comando(Comando.ABRIR_VALVULA)).toBe(false)
    expect(valvula(dispositivo)).toBe(false)
  })

  it('no modo manual a temperatura não abre a válvula sozinha', () => {
    const dispositivo = novoDispositivo()
    dispositivo.comando(Comando.MODO_MANUAL)
    dispositivo.definirTemperaturaReal(40)
    avancar(dispositivo, 2)
    expect(valvula(dispositivo)).toBe(false)
  })

  it('recusa temperatura-alvo fora da faixa permitida', () => {
    const dispositivo = novoDispositivo()
    expect(dispositivo.definirTemperaturaAlvo(90)).toBe(false)
    expect(dispositivo.telemetria().temperaturaAlvo).toBe(35)
  })
})
