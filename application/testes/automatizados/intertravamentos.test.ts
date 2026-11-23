import { describe, expect, it } from 'vitest'
import { Comando, EstadoSistema, type Telemetria } from '../../dashboard/contrato'
import {
  avaliarComando,
  comandoConfirmado,
  pedidoDeConfirmacao,
  podeAlterarTemperaturaAlvo,
  validarTemperaturaAlvo,
  type ContextoComando,
} from '../../dashboard/intertravamentos'

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

function contexto(parcial: Partial<Telemetria> = {}, extra: Partial<ContextoComando> = {}): ContextoComando {
  return { telemetria: telemetria(parcial), dispositivoOnline: true, dadosAtualizados: true, ...extra }
}

const permitido = (comando: Comando, ctx: ContextoComando) => avaliarComando(comando, ctx).permitido
const TODOS = Object.values(Comando)

describe('bloqueio por conexão', () => {
  it('bloqueia todos os comandos e o ajuste do alvo com o ESP32 offline', () => {
    const ctx = contexto({}, { dispositivoOnline: false })
    for (const comando of TODOS) expect(permitido(comando, ctx)).toBe(false)
    expect(podeAlterarTemperaturaAlvo(ctx).permitido).toBe(false)
  })

  it('bloqueia com dados desatualizados ou sem telemetria', () => {
    for (const comando of TODOS) {
      expect(permitido(comando, contexto({}, { dadosAtualizados: false }))).toBe(false)
      expect(permitido(comando, contexto({}, { telemetria: null }))).toBe(false)
    }
  })
})

describe('intertravamentos por estado', () => {
  it('parada de emergência fica sempre disponível com o ESP32 online', () => {
    for (const estadoSistema of Object.values(EstadoSistema)) {
      expect(permitido(Comando.PARADA_EMERGENCIA, contexto({ estadoSistema }))).toBe(true)
    }
  })

  it('no automático não deixa abrir nem fechar a válvula diretamente', () => {
    const aguardando = contexto({ estadoSistema: EstadoSistema.AGUARDANDO })
    const transferindo = contexto({ estadoSistema: EstadoSistema.TRANSFERINDO, valvulaAberta: true })
    expect(permitido(Comando.ABRIR_VALVULA, aguardando)).toBe(false)
    expect(permitido(Comando.FECHAR_VALVULA, transferindo)).toBe(false)
    expect(permitido(Comando.MODO_MANUAL, aguardando)).toBe(true)
    expect(permitido(Comando.MODO_AUTOMATICO, aguardando)).toBe(false)
    expect(permitido(Comando.RESETAR_FALHA, aguardando)).toBe(false)
  })

  it('no manual libera abrir com a válvula fechada e fechar com ela aberta', () => {
    const fechada = contexto({ estadoSistema: EstadoSistema.MANUAL, valvulaAberta: false })
    const aberta = contexto({ estadoSistema: EstadoSistema.MANUAL, valvulaAberta: true })
    expect(permitido(Comando.ABRIR_VALVULA, fechada)).toBe(true)
    expect(permitido(Comando.FECHAR_VALVULA, fechada)).toBe(false)
    expect(permitido(Comando.ABRIR_VALVULA, aberta)).toBe(false)
    expect(permitido(Comando.FECHAR_VALVULA, aberta)).toBe(true)
    expect(permitido(Comando.MODO_AUTOMATICO, fechada)).toBe(true)
  })

  it('em falha permite resetar e entrar no manual, mas não abrir direto', () => {
    const falha = contexto({ estadoSistema: EstadoSistema.FALHA, alerta: 'SEM_FLUXO_VALVULA_ABERTA' })
    expect(permitido(Comando.RESETAR_FALHA, falha)).toBe(true)
    expect(permitido(Comando.MODO_MANUAL, falha)).toBe(true)
    expect(permitido(Comando.ABRIR_VALVULA, falha)).toBe(false)
  })

  it('com o sensor de temperatura em falha, o manual continua permitindo abrir a válvula', () => {
    const manualSemSensor = contexto({
      estadoSistema: EstadoSistema.MANUAL,
      temperaturaAtual: null,
      alerta: 'SENSOR_TEMP_DESCONECTADO',
    })
    expect(permitido(Comando.ABRIR_VALVULA, manualSemSensor)).toBe(true)
    expect(permitido(Comando.MODO_AUTOMATICO, manualSemSensor)).toBe(false)
  })

  it('não deixa resetar a falha enquanto o sensor de temperatura não tiver leitura válida', () => {
    const ctx = contexto({ estadoSistema: EstadoSistema.FALHA, temperaturaAtual: null, alerta: 'SENSOR_TEMP_DESCONECTADO' })
    expect(permitido(Comando.RESETAR_FALHA, ctx)).toBe(false)
    expect(permitido(Comando.MODO_MANUAL, ctx)).toBe(true)
  })

  it('não aceita modo manual durante a inicialização', () => {
    expect(permitido(Comando.MODO_MANUAL, contexto({ estadoSistema: EstadoSistema.INICIANDO }))).toBe(false)
  })

  it('sempre explica o motivo quando nega um comando', () => {
    for (const estadoSistema of Object.values(EstadoSistema)) {
      for (const comando of TODOS) {
        const resultado = avaliarComando(comando, contexto({ estadoSistema }))
        if (!resultado.permitido) expect(resultado.motivo).toBeTruthy()
      }
    }
  })
})

describe('confirmação antes de comandos sensíveis', () => {
  it('pede confirmação para abrir a válvula, entrar no manual e resetar falha', () => {
    expect(pedidoDeConfirmacao(Comando.ABRIR_VALVULA, telemetria())).not.toBeNull()
    expect(pedidoDeConfirmacao(Comando.MODO_MANUAL, telemetria())).not.toBeNull()
    expect(pedidoDeConfirmacao(Comando.RESETAR_FALHA, telemetria())).not.toBeNull()
  })

  it('não atrasa a parada de emergência com confirmação', () => {
    expect(pedidoDeConfirmacao(Comando.PARADA_EMERGENCIA, telemetria())).toBeNull()
  })

  it('avisa sobre a falha ativa ao pedir para abrir a válvula manualmente', () => {
    const pedido = pedidoDeConfirmacao(Comando.ABRIR_VALVULA, telemetria({ alerta: 'SENSOR_TEMP_DESCONECTADO' }))
    expect(pedido?.mensagem).toContain('Sensor de temperatura desconectado')
  })
})

describe('comandoConfirmado (o dashboard confere o efeito pela telemetria)', () => {
  it('reconhece o efeito esperado de cada comando', () => {
    expect(comandoConfirmado(Comando.PARADA_EMERGENCIA, telemetria({ estadoSistema: EstadoSistema.FALHA }))).toBe(true)
    expect(comandoConfirmado(Comando.MODO_MANUAL, telemetria({ estadoSistema: EstadoSistema.MANUAL }))).toBe(true)
    expect(comandoConfirmado(Comando.MODO_AUTOMATICO, telemetria({ estadoSistema: EstadoSistema.TRANSFERINDO }))).toBe(true)
    expect(comandoConfirmado(Comando.ABRIR_VALVULA, telemetria({ valvulaAberta: true }))).toBe(true)
    expect(comandoConfirmado(Comando.FECHAR_VALVULA, telemetria({ valvulaAberta: false }))).toBe(true)
    expect(comandoConfirmado(Comando.RESETAR_FALHA, telemetria({ estadoSistema: EstadoSistema.FALHA }))).toBe(false)
  })
})

describe('validarTemperaturaAlvo', () => {
  it('aceita vírgula ou ponto e arredonda para 0,1 °C', () => {
    expect(validarTemperaturaAlvo('38,5')).toEqual({ ok: true, valor: 38.5 })
    expect(validarTemperaturaAlvo(' 40.04 ')).toEqual({ ok: true, valor: 40 })
  })

  it('recusa vazio, texto e valores fora da faixa segura', () => {
    expect(validarTemperaturaAlvo('').ok).toBe(false)
    expect(validarTemperaturaAlvo('quente').ok).toBe(false)
    expect(validarTemperaturaAlvo('19.9').ok).toBe(false)
    expect(validarTemperaturaAlvo('70.1').ok).toBe(false)
    expect(validarTemperaturaAlvo('70').ok).toBe(true)
  })
})
