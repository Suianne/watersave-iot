import { useEffect, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatadorEixoTempo, formatarHora, formatarNumero } from '../formatar'
import { ehLacuna, type PontoHistorico } from '../historico'

const CORES_CLARO = {
  grade: '#e3e8ee',
  eixo: '#6b7684',
  temperatura: '#d4572a',
  alvo: '#c62828',
  fecha: '#1565c0',
  vazao: '#1565c0',
  valvula: '#1565c0',
  fundoDica: '#ffffff',
  bordaDica: '#dbe1e8',
}

const CORES_ESCURO = {
  grade: '#253040',
  eixo: '#98a4b3',
  temperatura: '#f08a5d',
  alvo: '#f06262',
  fecha: '#4c9be8',
  vazao: '#4c9be8',
  valvula: '#4c9be8',
  fundoDica: '#161d26',
  bordaDica: '#283342',
}

function useCoresGrafico() {
  const consulta = '(prefers-color-scheme: dark)'
  const [escuro, setEscuro] = useState(() => window.matchMedia?.(consulta).matches ?? false)
  useEffect(() => {
    const midia = window.matchMedia?.(consulta)
    if (!midia) return
    const aoMudar = (evento: MediaQueryListEvent) => setEscuro(evento.matches)
    midia.addEventListener('change', aoMudar)
    return () => midia.removeEventListener('change', aoMudar)
  }, [])
  return escuro ? CORES_ESCURO : CORES_CLARO
}

function duracao(dados: PontoHistorico[]) {
  return dados.length > 1 ? dados[dados.length - 1].t - dados[0].t : 0
}

function semDados(dados: PontoHistorico[]) {
  return dados.every(ehLacuna)
}

function Vazio() {
  return <p className="grafico__vazio">Sem dados nesse período. Os pontos aparecem conforme o ESP32 envia a telemetria.</p>
}

const ALTURA = 260

export function GraficoTemperatura({ dados }: { dados: PontoHistorico[] }) {
  const cores = useCoresGrafico()
  if (semDados(dados)) return <Vazio />
  return (
    <div className="grafico" role="img" aria-label="Gráfico histórico de temperatura com os limites de abertura e fechamento">
      <ResponsiveContainer width="100%" height={ALTURA}>
        <ComposedChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={cores.grade} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatadorEixoTempo(duracao(dados))}
            stroke={cores.eixo}
            fontSize={12}
            minTickGap={48}
          />
          <YAxis
            stroke={cores.eixo}
            fontSize={12}
            width={48}
            unit="°"
            domain={[(minimo: number) => Math.floor(minimo - 1), (maximo: number) => Math.ceil(maximo + 1)]}
          />
          <Tooltip
            labelFormatter={(rotulo) => formatarHora(Number(rotulo))}
            formatter={(valor) => `${formatarNumero(Number(valor), 1)} °C`}
            contentStyle={{ background: cores.fundoDica, borderColor: cores.bordaDica, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="stepAfter"
            dataKey="alvo"
            name="Abre (alvo)"
            stroke={cores.alvo}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="stepAfter"
            dataKey="fecha"
            name="Fecha (alvo − histerese)"
            stroke={cores.fecha}
            strokeDasharray="2 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="temperatura"
            name="Temperatura"
            stroke={cores.temperatura}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GraficoVazao({ dados }: { dados: PontoHistorico[] }) {
  const cores = useCoresGrafico()
  if (semDados(dados)) return <Vazio />
  return (
    <div className="grafico" role="img" aria-label="Gráfico histórico de vazão com os períodos de válvula aberta">
      <ResponsiveContainer width="100%" height={ALTURA}>
        <ComposedChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={cores.grade} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatadorEixoTempo(duracao(dados))}
            stroke={cores.eixo}
            fontSize={12}
            minTickGap={48}
          />
          <YAxis
            yAxisId="vazao"
            stroke={cores.eixo}
            fontSize={12}
            width={48}
            domain={[0, (maximo: number) => Math.max(1, Math.ceil(maximo + 0.5))]}
          />
          <YAxis yAxisId="valvula" hide domain={[0, 1]} />
          <Tooltip
            labelFormatter={(rotulo) => formatarHora(Number(rotulo))}
            formatter={(valor, _nome, item) =>
              item.dataKey === 'valvula' ? (Number(valor) ? 'sim' : 'não') : `${formatarNumero(Number(valor), 2)} L/min`
            }
            contentStyle={{ background: cores.fundoDica, borderColor: cores.bordaDica, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            yAxisId="valvula"
            type="stepAfter"
            dataKey="valvula"
            name="Válvula aberta"
            fill={cores.valvula}
            fillOpacity={0.15}
            stroke="none"
            isAnimationActive={false}
          />
          <Line
            yAxisId="vazao"
            type="monotone"
            dataKey="vazao"
            name="Vazão (L/min)"
            stroke={cores.vazao}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export const JANELAS: { rotulo: string; ms: number | null }[] = [
  { rotulo: '5 min', ms: 5 * 60_000 },
  { rotulo: '15 min', ms: 15 * 60_000 },
  { rotulo: '1 h', ms: 60 * 60_000 },
  { rotulo: 'Tudo', ms: null },
]

export function SeletorJanela({ valor, aoMudar }: { valor: number | null; aoMudar: (ms: number | null) => void }) {
  return (
    <div className="segmentado" role="group" aria-label="Período do histórico">
      {JANELAS.map((janela) => (
        <button
          key={janela.rotulo}
          type="button"
          className="segmentado__opcao"
          aria-pressed={valor === janela.ms}
          onClick={() => aoMudar(janela.ms)}
        >
          {janela.rotulo}
        </button>
      ))}
    </div>
  )
}
