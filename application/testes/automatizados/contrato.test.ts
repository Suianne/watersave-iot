import { describe, expect, it } from 'vitest'
import { EstadoSistema, descreverAlerta, parseTelemetria, zonaTemperatura } from '../../dashboard/contrato'

const pacoteValido = {
  temperaturaAtual: 36.25,
  temperaturaAlvo: 35,
  histerese: 2,
  vazao: 4.8,
  volumeTransferido: 1.234,
  valvulaAberta: true,
  estadoSistema: 2,
  alerta: '',
}

describe('parseTelemetria (estrutura dos dados recebidos do ESP32)', () => {
  it('aceita um pacote que segue o contrato', () => {
    expect(parseTelemetria(pacoteValido)).toEqual({ ...pacoteValido, estadoSistema: EstadoSistema.TRANSFERINDO })
  })

  it('trata -127 do DS18B20 desconectado como leitura inválida (null), sem descartar o pacote', () => {
    expect(parseTelemetria({ ...pacoteValido, temperaturaAtual: -127 })?.temperaturaAtual).toBeNull()
  })

  it('trata temperatura fora da faixa física ou ausente como leitura inválida', () => {
    expect(parseTelemetria({ ...pacoteValido, temperaturaAtual: 150 })?.temperaturaAtual).toBeNull()
    expect(parseTelemetria({ ...pacoteValido, temperaturaAtual: null })?.temperaturaAtual).toBeNull()
    expect(parseTelemetria({ ...pacoteValido, temperaturaAtual: undefined })?.temperaturaAtual).toBeNull()
  })

  it('aceita a válvula como 0/1 além de true/false', () => {
    expect(parseTelemetria({ ...pacoteValido, valvulaAberta: 1 })?.valvulaAberta).toBe(true)
    expect(parseTelemetria({ ...pacoteValido, valvulaAberta: 0 })?.valvulaAberta).toBe(false)
  })

  it('aceita pacote sem volumeTransferido (o firmware ainda não calcula o volume)', () => {
    const { volumeTransferido: _volume, ...semVolume } = pacoteValido
    expect(parseTelemetria(semVolume)?.volumeTransferido).toBeNull()
    expect(parseTelemetria({ ...pacoteValido, volumeTransferido: null })?.volumeTransferido).toBeNull()
  })

  it('usa "" quando o campo alerta não vem', () => {
    const { alerta: _alerta, ...semAlerta } = pacoteValido
    expect(parseTelemetria(semAlerta)?.alerta).toBe('')
  })

  it.each([
    ['não é objeto', 'texto'],
    ['nulo', null],
    ['sem temperaturaAlvo', { ...pacoteValido, temperaturaAlvo: undefined }],
    ['vazão como texto', { ...pacoteValido, vazao: '4.8' }],
    ['vazão negativa', { ...pacoteValido, vazao: -1 }],
    ['volume como texto', { ...pacoteValido, volumeTransferido: '1.2' }],
    ['volume negativo', { ...pacoteValido, volumeTransferido: -1 }],
    ['estado desconhecido', { ...pacoteValido, estadoSistema: 9 }],
    ['válvula com valor estranho', { ...pacoteValido, valvulaAberta: 'sim' }],
    ['alerta numérico', { ...pacoteValido, alerta: 3 }],
  ])('rejeita pacote fora do contrato: %s', (_caso, pacote) => {
    expect(parseTelemetria(pacote)).toBeNull()
  })
})

describe('zonaTemperatura (regra de histerese)', () => {
  it('abre a partir do alvo, mantém dentro da faixa e fecha abaixo de alvo - histerese', () => {
    expect(zonaTemperatura(35, 35, 2)).toBe('acima')
    expect(zonaTemperatura(34.9, 35, 2)).toBe('faixa')
    expect(zonaTemperatura(33.1, 35, 2)).toBe('faixa')
    expect(zonaTemperatura(33, 35, 2)).toBe('abaixo')
  })
})

describe('descreverAlerta', () => {
  it('descreve códigos conhecidos e não quebra com códigos novos', () => {
    expect(descreverAlerta('TEMPO_MAXIMO_EXCEDIDO').nivel).toBe('falha')
    expect(descreverAlerta('CODIGO_NOVO').titulo).toContain('CODIGO_NOVO')
  })
})
