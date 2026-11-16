import { useState } from 'react'
import type { FalhasSimuladas, TransporteSimulado } from '../transporte/simulado'
import { Cartao } from './Cartao'

const FALHAS: { chave: keyof FalhasSimuladas; rotulo: string; efeito: string }[] = [
  { chave: 'sensorDesconectado', rotulo: 'Desconectar o DS18B20', efeito: 'leitura -127 °C' },
  { chave: 'mangueiraEntupida', rotulo: 'Entupir a mangueira', efeito: 'sem fluxo com a válvula aberta' },
  { chave: 'vazamento', rotulo: 'Vazamento na válvula', efeito: 'fluxo com a válvula fechada' },
]

export function PainelSimulacao({ simulador }: { simulador: TransporteSimulado }) {
  const { dispositivo } = simulador
  const [falhas, setFalhas] = useState(() => dispositivo.falhasAtivas())

  function alternar(chave: keyof FalhasSimuladas) {
    dispositivo.definirFalha(chave, !falhas[chave])
    setFalhas(dispositivo.falhasAtivas())
  }

  return (
    <Cartao titulo="Simulação do hardware" destaque="aviso" className="painel-simulacao">
      <p className="nota nota--suave">
        Faz o papel do ESP32 e dos reservatórios enquanto o hardware não está pronto. No modo MQTT este painel some.
      </p>

      <h3 className="subtitulo">Reservatório 1</h3>
      <div className="grupo-comandos">
        <button type="button" className="botao" onClick={() => dispositivo.adicionarAgua(12)}>
          Adicionar água quente
        </button>
        <button type="button" className="botao" onClick={() => dispositivo.adicionarAgua(-12)}>
          Adicionar água fria
        </button>
      </div>

      <h3 className="subtitulo">Falhas</h3>
      <div className="alternadores">
        {FALHAS.map(({ chave, rotulo, efeito }) => (
          <label key={chave} className="alternador">
            <input type="checkbox" checked={falhas[chave]} onChange={() => alternar(chave)} />
            <span>
              {rotulo} <span className="nota--suave">({efeito})</span>
            </span>
          </label>
        ))}
      </div>

      <h3 className="subtitulo">Rede e energia</h3>
      <div className="grupo-comandos">
        <button type="button" className="botao" onClick={() => simulador.simularPerdaWifi(15)}>
          Derrubar o Wi-Fi por 15 s
        </button>
        <button type="button" className="botao" onClick={() => simulador.reiniciarEsp32()}>
          Reiniciar o ESP32
        </button>
      </div>
    </Cartao>
  )
}
