// Intertravamentos de segurança dos comandos do usuário.
// O dashboard só libera o que faz sentido no estado atual, mas o firmware precisa
// repetir essas verificações: o dashboard nunca é a única barreira de segurança.

import {
  ALERTAS_DE_SENSOR,
  Comando,
  EstadoSistema,
  FAIXA_TEMPERATURA_ALVO,
  descreverAlerta,
  type Telemetria,
} from './contrato'
import { formatarNumero } from './formatar'

export interface Disponibilidade {
  permitido: boolean
  motivo?: string
}

export interface ContextoComando {
  telemetria: Telemetria | null
  dispositivoOnline: boolean
  dadosAtualizados: boolean
}

const PERMITIDO: Disponibilidade = { permitido: true }
const negado = (motivo: string): Disponibilidade => ({ permitido: false, motivo })

export function sensorComFalha(telemetria: Telemetria): boolean {
  return telemetria.temperaturaAtual === null || ALERTAS_DE_SENSOR.includes(telemetria.alerta)
}

/** Bloqueio comum a todos os comandos: sem ESP32 online e dados recentes não se envia nada. */
export function verificarConexao(contexto: ContextoComando): Disponibilidade {
  if (!contexto.dispositivoOnline) return negado('ESP32 offline: os comandos ficam bloqueados até ele reconectar.')
  if (!contexto.telemetria || !contexto.dadosAtualizados) return negado('Sem dados recentes do ESP32.')
  return PERMITIDO
}

export function avaliarComando(comando: Comando, contexto: ContextoComando): Disponibilidade {
  const conexao = verificarConexao(contexto)
  if (!conexao.permitido || !contexto.telemetria) return conexao
  const telemetria = contexto.telemetria
  const estado = telemetria.estadoSistema

  switch (comando) {
    case Comando.PARADA_EMERGENCIA:
      return PERMITIDO

    case Comando.RESETAR_FALHA:
      if (estado !== EstadoSistema.FALHA) return negado('Não há falha ativa para resetar.')
      if (telemetria.temperaturaAtual === null)
        return negado('O sensor de temperatura ainda não tem leitura válida. Use o modo manual se precisar operar.')
      return PERMITIDO

    case Comando.MODO_MANUAL:
      if (estado === EstadoSistema.MANUAL) return negado('O sistema já está no modo manual.')
      if (estado === EstadoSistema.INICIANDO) return negado('Aguarde o ESP32 terminar de iniciar.')
      return PERMITIDO

    case Comando.MODO_AUTOMATICO:
      if (estado !== EstadoSistema.MANUAL) return negado('Disponível apenas no modo manual.')
      if (sensorComFalha(telemetria))
        return negado('O modo automático depende do sensor de temperatura, que está com falha.')
      return PERMITIDO

    case Comando.ABRIR_VALVULA:
      if (estado !== EstadoSistema.MANUAL) return negado('Ative o modo manual para abrir a válvula.')
      if (telemetria.valvulaAberta) return negado('A válvula já está aberta.')
      return PERMITIDO

    case Comando.FECHAR_VALVULA:
      if (estado !== EstadoSistema.MANUAL)
        return negado('Disponível no modo manual. No automático, use a parada de emergência.')
      if (!telemetria.valvulaAberta) return negado('A válvula já está fechada.')
      return PERMITIDO
  }
}

export function podeAlterarTemperaturaAlvo(contexto: ContextoComando): Disponibilidade {
  return verificarConexao(contexto)
}

export interface PedidoConfirmacao {
  titulo: string
  mensagem: string
  rotuloConfirmar: string
}

/** Comandos que mexem na água ou no modo de operação pedem confirmação. */
export function pedidoDeConfirmacao(comando: Comando, telemetria: Telemetria | null): PedidoConfirmacao | null {
  const falhaAtiva = telemetria?.alerta ? descreverAlerta(telemetria.alerta).titulo : null

  switch (comando) {
    case Comando.ABRIR_VALVULA:
      return {
        titulo: 'Abrir a válvula manualmente?',
        mensagem:
          'A água vai passar para o reservatório 2 até você fechar a válvula ou o tempo máximo de abertura ser atingido.' +
          (falhaAtiva ? ` Atenção: há um alerta ativo (${falhaAtiva}). Confirme que é seguro abrir.` : ''),
        rotuloConfirmar: 'Abrir válvula',
      }
    case Comando.MODO_MANUAL:
      return {
        titulo: 'Entrar no modo manual?',
        mensagem:
          'O controle automático por temperatura fica desligado e a válvula é fechada. ' +
          'Depois disso ela só abre ou fecha pelos seus comandos.' +
          (falhaAtiva ? ` O alerta "${falhaAtiva}" continua registrado no histórico.` : ''),
        rotuloConfirmar: 'Entrar no modo manual',
      }
    case Comando.RESETAR_FALHA:
      return {
        titulo: 'Resetar a falha?',
        mensagem:
          `Confirme que a causa${falhaAtiva ? ` (${falhaAtiva})` : ''} foi resolvida. ` +
          'O sistema volta ao modo automático e pode abrir a válvula na hora se a temperatura já estiver no alvo.',
        rotuloConfirmar: 'Resetar falha',
      }
    default:
      return null
  }
}

/** Indica se a telemetria já reflete o efeito esperado do comando. */
export function comandoConfirmado(comando: Comando, telemetria: Telemetria): boolean {
  const estado = telemetria.estadoSistema
  switch (comando) {
    case Comando.PARADA_EMERGENCIA:
      return estado === EstadoSistema.FALHA && !telemetria.valvulaAberta
    case Comando.RESETAR_FALHA:
      return estado !== EstadoSistema.FALHA
    case Comando.MODO_MANUAL:
      return estado === EstadoSistema.MANUAL
    case Comando.MODO_AUTOMATICO:
      return estado === EstadoSistema.AGUARDANDO || estado === EstadoSistema.TRANSFERINDO
    case Comando.ABRIR_VALVULA:
      return telemetria.valvulaAberta
    case Comando.FECHAR_VALVULA:
      return !telemetria.valvulaAberta
  }
}

export type ResultadoValidacao = { ok: true; valor: number } | { ok: false; erro: string }

export function validarTemperaturaAlvo(entrada: string): ResultadoValidacao {
  const texto = entrada.trim().replace(',', '.')
  if (texto === '') return { ok: false, erro: 'Informe a temperatura-alvo.' }
  const valor = Number(texto)
  if (!Number.isFinite(valor)) return { ok: false, erro: 'Valor inválido: use apenas números, ex.: 38,5.' }
  const { min, max } = FAIXA_TEMPERATURA_ALVO
  if (valor < min || valor > max)
    return { ok: false, erro: `Use um valor entre ${formatarNumero(min, 0)} e ${formatarNumero(max, 0)} °C.` }
  return { ok: true, valor: Math.round(valor * 10) / 10 }
}
