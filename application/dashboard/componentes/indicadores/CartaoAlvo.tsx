import { useState, type FormEvent } from 'react'
import { FAIXA_TEMPERATURA_ALVO, type Telemetria } from '../../contrato'
import { formatarNumero, formatarTemperatura } from '../../formatar'
import { validarTemperaturaAlvo, type Disponibilidade } from '../../intertravamentos'
import { Cartao } from '../Cartao'

interface Props {
  telemetria: Telemetria | null
  disponibilidade: Disponibilidade
  /** valor enviado que o ESP32 ainda não confirmou */
  valorPendente: number | null
  aoEnviar: (valor: number) => void
}

export function CartaoAlvo({ telemetria, disponibilidade, valorPendente, aoEnviar }: Props) {
  const [entrada, setEntrada] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarTemperaturaAlvo(entrada)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    setEntrada('')
    aoEnviar(resultado.valor)
  }

  const { min, max } = FAIXA_TEMPERATURA_ALVO

  return (
    <Cartao titulo="Temperatura-alvo" destaque="neutro">
      <p className="valor" data-testid="temperatura-alvo">
        {telemetria ? formatarTemperatura(telemetria.temperaturaAlvo) : '--'}
      </p>
      <p className="nota nota--suave">
        Histerese: {telemetria ? `${formatarNumero(telemetria.histerese)} °C` : '--'}
      </p>
      <form className="form-alvo" onSubmit={enviar} noValidate>
        <label className="visualmente-oculto" htmlFor="novo-alvo">
          Nova temperatura-alvo em °C
        </label>
        <input
          id="novo-alvo"
          className="campo__entrada"
          inputMode="decimal"
          autoComplete="off"
          placeholder={`${min} a ${max} °C`}
          value={entrada}
          disabled={!disponibilidade.permitido}
          onChange={(evento) => setEntrada(evento.target.value)}
        />
        <button type="submit" className="botao botao--primario" disabled={!disponibilidade.permitido || !entrada}>
          Aplicar
        </button>
      </form>
      {erro && (
        <p className="nota nota--falha" role="alert">
          {erro}
        </p>
      )}
      {valorPendente !== null && (
        <p className="nota" role="status">
          Enviando {formatarTemperatura(valorPendente)}, aguardando o ESP32…
        </p>
      )}
      {!disponibilidade.permitido && <p className="nota nota--suave">{disponibilidade.motivo}</p>}
    </Cartao>
  )
}
