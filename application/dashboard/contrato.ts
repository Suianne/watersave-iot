// Contrato de dados entre o firmware do ESP32 e o dashboard.
// A versão para o grupo está em docs/contrato-de-dados.md: se mudar algo aqui, atualize lá também.

export const EstadoSistema = {
  INICIANDO: 0,
  AGUARDANDO: 1,
  TRANSFERINDO: 2,
  MANUAL: 3,
  FALHA: 4,
} as const
export type EstadoSistema = (typeof EstadoSistema)[keyof typeof EstadoSistema]

export const Comando = {
  PARADA_EMERGENCIA: 1,
  RESETAR_FALHA: 2,
  MODO_MANUAL: 3,
  MODO_AUTOMATICO: 4,
  ABRIR_VALVULA: 5,
  FECHAR_VALVULA: 6,
} as const
export type Comando = (typeof Comando)[keyof typeof Comando]

export interface Telemetria {
  /** °C; null quando a leitura é inválida (ex.: -127 do DS18B20 desconectado) */
  temperaturaAtual: number | null
  /** °C; a válvula abre quando temperaturaAtual >= temperaturaAlvo */
  temperaturaAlvo: number
  /** °C; a válvula fecha quando temperaturaAtual <= temperaturaAlvo - histerese */
  histerese: number
  /** L/min */
  vazao: number
  /** litros transferidos desde a inicialização do ESP32; null quando o firmware não envia */
  volumeTransferido: number | null
  valvulaAberta: boolean
  estadoSistema: EstadoSistema
  /** código do alerta ativo (ver ALERTAS); "" quando não há alerta */
  alerta: string
}

/** Código 7 da API: só atualiza a temperatura-alvo. Não é um botão: vem do cartão da temperatura-alvo. */
export const COMANDO_ATUALIZAR_ALVO = 7

/** o ESP32 envia a telemetria para a API a cada 2 s */
export const INTERVALO_PUBLICACAO_S = 2
/** sem telemetria por mais que isso, os dados são considerados desatualizados */
export const LIMITE_DADOS_ATUALIZADOS_S = 10
/** o YF-S201 suporta no máximo 80 °C: a faixa deixa margem */
export const FAIXA_TEMPERATURA_ALVO = { min: 20, max: 70 }
export const FAIXA_LEITURA_VALIDA = { min: -10, max: 100 }
export const DS18B20_DESCONECTADO = -127

export const NOME_ESTADO: Record<EstadoSistema, string> = {
  [EstadoSistema.INICIANDO]: 'Iniciando',
  [EstadoSistema.AGUARDANDO]: 'Aguardando temperatura',
  [EstadoSistema.TRANSFERINDO]: 'Transferindo água',
  [EstadoSistema.MANUAL]: 'Modo manual',
  [EstadoSistema.FALHA]: 'Falha',
}

export const DESCRICAO_ESTADO: Record<EstadoSistema, string> = {
  [EstadoSistema.INICIANDO]:
    'O ESP32 acabou de ligar. A válvula fica fechada até a primeira leitura válida de temperatura.',
  [EstadoSistema.AGUARDANDO]:
    'Válvula fechada. Ela abre sozinha quando a água atingir a temperatura-alvo.',
  [EstadoSistema.TRANSFERINDO]:
    'Válvula aberta. Ela fecha sozinha quando a temperatura cair abaixo da faixa de histerese.',
  [EstadoSistema.MANUAL]:
    'Controle automático desligado. A válvula só abre ou fecha por comando do usuário.',
  [EstadoSistema.FALHA]:
    'Uma proteção atuou e fechou a válvula. Resolva a causa e resete a falha, ou use o modo manual.',
}

export const NOME_COMANDO: Record<Comando, string> = {
  [Comando.PARADA_EMERGENCIA]: 'Parada de emergência',
  [Comando.RESETAR_FALHA]: 'Resetar falha',
  [Comando.MODO_MANUAL]: 'Modo manual',
  [Comando.MODO_AUTOMATICO]: 'Modo automático',
  [Comando.ABRIR_VALVULA]: 'Abrir válvula',
  [Comando.FECHAR_VALVULA]: 'Fechar válvula',
}

export type NivelAlerta = 'info' | 'aviso' | 'falha'

export interface DescricaoAlerta {
  nivel: NivelAlerta
  titulo: string
  mensagem: string
}

export const ALERTAS: Record<string, DescricaoAlerta> = {
  SENSOR_TEMP_DESCONECTADO: {
    nivel: 'falha',
    titulo: 'Sensor de temperatura desconectado',
    mensagem: 'O DS18B20 não responde (leitura -127 °C). Verifique os fios e o resistor de pull-up de 5 kΩ.',
  },
  LEITURA_TEMP_INVALIDA: {
    nivel: 'falha',
    titulo: 'Leitura de temperatura inválida',
    mensagem: 'O DS18B20 devolveu um valor fora da faixa esperada.',
  },
  SEM_FLUXO_VALVULA_ABERTA: {
    nivel: 'falha',
    titulo: 'Válvula aberta sem fluxo',
    mensagem:
      'O YF-S201 não mede vazão com a válvula aberta: reservatório vazio, mangueira obstruída ou válvula que não abriu.',
  },
  FLUXO_VALVULA_FECHADA: {
    nivel: 'falha',
    titulo: 'Fluxo com a válvula fechada',
    mensagem: 'Há vazão com a válvula fechada: vazamento ou válvula travada aberta.',
  },
  TEMPO_MAXIMO_EXCEDIDO: {
    nivel: 'falha',
    titulo: 'Tempo máximo de abertura excedido',
    mensagem: 'A válvula ficou aberta além do limite e foi fechada por segurança.',
  },
  PARADA_EMERGENCIA: {
    nivel: 'falha',
    titulo: 'Parada de emergência',
    mensagem: 'A parada de emergência foi acionada pelo dashboard. A válvula está fechada.',
  },
}

export const ALERTAS_DE_SENSOR: readonly string[] = ['SENSOR_TEMP_DESCONECTADO', 'LEITURA_TEMP_INVALIDA']

export function descreverAlerta(codigo: string): DescricaoAlerta {
  return (
    ALERTAS[codigo] ?? {
      nivel: 'aviso',
      titulo: `Alerta ${codigo}`,
      mensagem: 'Código de alerta não catalogado no contrato de dados.',
    }
  )
}

export function leituraTemperaturaValida(valor: unknown): valor is number {
  return (
    typeof valor === 'number' &&
    Number.isFinite(valor) &&
    valor !== DS18B20_DESCONECTADO &&
    valor >= FAIXA_LEITURA_VALIDA.min &&
    valor <= FAIXA_LEITURA_VALIDA.max
  )
}

export type ZonaTemperatura = 'acima' | 'faixa' | 'abaixo'

/** Regra de histerese: abre em T >= alvo, fecha em T <= alvo - histerese, mantém no meio. */
export function zonaTemperatura(temperatura: number, alvo: number, histerese: number): ZonaTemperatura {
  if (temperatura >= alvo) return 'acima'
  if (temperatura > alvo - histerese) return 'faixa'
  return 'abaixo'
}

const ESTADOS_VALIDOS = new Set<number>(Object.values(EstadoSistema))

function ehNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

/** Valida o JSON recebido do ESP32. Retorna null se o pacote não segue o contrato. */
export function parseTelemetria(dados: unknown): Telemetria | null {
  if (typeof dados !== 'object' || dados === null) return null
  const { temperaturaAtual, temperaturaAlvo, histerese, vazao, volumeTransferido, valvulaAberta, estadoSistema, alerta } =
    dados as Record<string, unknown>

  if (!ehNumero(temperaturaAlvo) || !ehNumero(histerese) || !ehNumero(vazao)) return null
  if (histerese < 0 || vazao < 0) return null

  // o volume é opcional: o firmware da camada de percepção ainda não calcula
  const volume = volumeTransferido ?? null
  if (volume !== null && (!ehNumero(volume) || volume < 0)) return null
  if (!ehNumero(estadoSistema) || !ESTADOS_VALIDOS.has(estadoSistema)) return null

  // aceita 0/1 além de true/false para facilitar o lado do firmware
  let valvula: boolean
  if (typeof valvulaAberta === 'boolean') valvula = valvulaAberta
  else if (valvulaAberta === 0 || valvulaAberta === 1) valvula = valvulaAberta === 1
  else return null

  const codigoAlerta = alerta ?? ''
  if (typeof codigoAlerta !== 'string') return null

  return {
    temperaturaAtual: leituraTemperaturaValida(temperaturaAtual) ? temperaturaAtual : null,
    temperaturaAlvo,
    histerese,
    vazao,
    volumeTransferido: volume,
    valvulaAberta: valvula,
    estadoSistema: estadoSistema as EstadoSistema,
    alerta: codigoAlerta,
  }
}
