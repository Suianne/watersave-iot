// Testes da interface com dados simulados: indicadores, estados da válvula e comandos.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CartaoAlvo } from '../../dashboard/componentes/indicadores/CartaoAlvo'
import { CartaoSistema } from '../../dashboard/componentes/indicadores/CartaoSistema'
import { CartaoTemperatura } from '../../dashboard/componentes/indicadores/CartaoTemperatura'
import { CartaoValvula } from '../../dashboard/componentes/indicadores/CartaoValvula'
import { CartaoVazao } from '../../dashboard/componentes/indicadores/CartaoVazao'
import { PainelComandos } from '../../dashboard/componentes/PainelComandos'
import { Comando, EstadoSistema, type Telemetria } from '../../dashboard/contrato'
import type { ContextoComando } from '../../dashboard/intertravamentos'

afterEach(cleanup)

function telemetria(parcial: Partial<Telemetria> = {}): Telemetria {
  return {
    temperaturaAtual: 36.4,
    temperaturaAlvo: 35,
    histerese: 2,
    vazao: 4.83,
    volumeTransferido: 1.256,
    valvulaAberta: true,
    estadoSistema: EstadoSistema.TRANSFERINDO,
    alerta: '',
    ...parcial,
  }
}

const botao = (nome: string) => screen.getByRole<HTMLButtonElement>('button', { name: nome })

describe('indicadores', () => {
  it('mostram temperatura, vazão e volume no formato brasileiro', () => {
    render(
      <>
        <CartaoTemperatura telemetria={telemetria()} atualizado />
        <CartaoVazao telemetria={telemetria()} atualizado />
      </>,
    )
    expect(screen.getByTestId('temperatura-atual').textContent).toBe('36,4 °C')
    expect(screen.getByTestId('vazao').textContent).toBe('4,8 L/min')
    expect(screen.getByTestId('volume').textContent).toBe('1,26 L')
    expect(screen.getByText(/condição de abertura/)).toBeTruthy()
  })

  it('mostram "--" e avisam quando a leitura de temperatura é inválida', () => {
    render(<CartaoTemperatura telemetria={telemetria({ temperaturaAtual: null })} atualizado />)
    expect(screen.getByTestId('temperatura-atual').textContent).toBe('--')
    expect(screen.getByText('Leitura inválida do DS18B20')).toBeTruthy()
  })

  it('mostram "--" no volume quando o ESP32 não envia esse dado, sem esconder a vazão', () => {
    render(<CartaoVazao telemetria={telemetria({ volumeTransferido: null })} atualizado />)
    expect(screen.getByTestId('vazao').textContent).toBe('4,8 L/min')
    expect(screen.getByTestId('volume').textContent).toBe('--')
    expect(screen.getByText('O ESP32 não está enviando o volume transferido')).toBeTruthy()
  })

  it('mostram "--" antes de chegar a primeira telemetria', () => {
    render(<CartaoValvula telemetria={null} />)
    expect(screen.getByTestId('estado-valvula').textContent).toBe('--')
  })

  it('mostram a válvula aberta, fechada e bloqueada por falha', () => {
    const { rerender } = render(<CartaoValvula telemetria={telemetria({ valvulaAberta: true })} />)
    expect(screen.getByTestId('estado-valvula').textContent).toBe('Aberta')

    rerender(<CartaoValvula telemetria={telemetria({ valvulaAberta: false, estadoSistema: EstadoSistema.AGUARDANDO })} />)
    expect(screen.getByTestId('estado-valvula').textContent).toBe('Fechada')

    rerender(<CartaoValvula telemetria={telemetria({ valvulaAberta: false, estadoSistema: EstadoSistema.FALHA })} />)
    expect(screen.getByText('Bloqueada fechada por falha')).toBeTruthy()
  })

  it('avisa no estado do sistema quando os dados estão desatualizados', () => {
    render(<CartaoSistema telemetria={telemetria()} atualizado={false} dispositivoOnline={false} />)
    expect(screen.getByTestId('estado-sistema').textContent).toBe('Transferindo água')
    expect(screen.getByText(/Último estado conhecido/)).toBeTruthy()
  })
})

describe('configuração da temperatura-alvo', () => {
  it('envia o valor validado e mostra erro para valor fora da faixa', () => {
    const aoEnviar = vi.fn()
    render(
      <CartaoAlvo telemetria={telemetria()} disponibilidade={{ permitido: true }} valorPendente={null} aoEnviar={aoEnviar} />,
    )
    const campo = screen.getByLabelText('Nova temperatura-alvo em °C')

    fireEvent.change(campo, { target: { value: '90' } })
    fireEvent.click(botao('Aplicar'))
    expect(aoEnviar).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('entre 20 e 70')

    fireEvent.change(campo, { target: { value: '38,5' } })
    fireEvent.click(botao('Aplicar'))
    expect(aoEnviar).toHaveBeenCalledWith(38.5)
  })

  it('fica bloqueada com o ESP32 offline', () => {
    render(
      <CartaoAlvo
        telemetria={telemetria()}
        disponibilidade={{ permitido: false, motivo: 'ESP32 offline' }}
        valorPendente={null}
        aoEnviar={() => {}}
      />,
    )
    expect(screen.getByLabelText<HTMLInputElement>('Nova temperatura-alvo em °C').disabled).toBe(true)
  })
})

describe('painel de comandos', () => {
  const contexto = (parcial: Partial<Telemetria>, online = true): ContextoComando => ({
    telemetria: telemetria(parcial),
    dispositivoOnline: online,
    dadosAtualizados: online,
  })

  it('no automático só libera emergência e modo manual', () => {
    render(<PainelComandos contexto={contexto({})} pendente={null} aoSolicitar={() => {}} />)
    expect(botao('Parada de emergência').disabled).toBe(false)
    expect(botao('Modo manual').disabled).toBe(false)
    expect(botao('Abrir válvula').disabled).toBe(true)
    expect(botao('Fechar válvula').disabled).toBe(true)
    expect(botao('Resetar falha').disabled).toBe(true)
    expect(screen.getByText('Ative o modo manual para abrir a válvula.')).toBeTruthy()
  })

  it('no manual libera abrir a válvula e envia o comando', () => {
    const aoSolicitar = vi.fn()
    render(
      <PainelComandos
        contexto={contexto({ estadoSistema: EstadoSistema.MANUAL, valvulaAberta: false })}
        pendente={null}
        aoSolicitar={aoSolicitar}
      />,
    )
    fireEvent.click(botao('Abrir válvula'))
    expect(aoSolicitar).toHaveBeenCalledWith(Comando.ABRIR_VALVULA)
  })

  it('com o ESP32 offline bloqueia tudo e explica uma vez só', () => {
    render(<PainelComandos contexto={contexto({}, false)} pendente={null} aoSolicitar={() => {}} />)
    for (const nome of ['Parada de emergência', 'Modo manual', 'Abrir válvula', 'Resetar falha']) {
      expect(botao(nome).disabled).toBe(true)
    }
    expect(screen.getAllByText(/ESP32 offline/)).toHaveLength(1)
  })

  it('mostra o comando aguardando confirmação do ESP32', () => {
    render(<PainelComandos contexto={contexto({})} pendente={Comando.MODO_MANUAL} aoSolicitar={() => {}} />)
    expect(botao('Aguardando ESP32…')).toBeTruthy()
  })
})
