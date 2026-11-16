import { useCallback, useMemo, useState } from 'react'
import { BannerStatus } from './componentes/BannerStatus'
import { Cabecalho } from './componentes/Cabecalho'
import { Cartao } from './componentes/Cartao'
import { Configuracoes } from './componentes/Configuracoes'
import { DialogoConfirmacao } from './componentes/Dialogo'
import { GraficoTemperatura, GraficoVazao, SeletorJanela } from './componentes/Graficos'
import { CartaoAlvo } from './componentes/indicadores/CartaoAlvo'
import { CartaoSistema } from './componentes/indicadores/CartaoSistema'
import { CartaoTemperatura } from './componentes/indicadores/CartaoTemperatura'
import { CartaoValvula } from './componentes/indicadores/CartaoValvula'
import { CartaoVazao } from './componentes/indicadores/CartaoVazao'
import { LimiteDeErro } from './componentes/LimiteDeErro'
import { PainelAlertas } from './componentes/PainelAlertas'
import { PainelComandos } from './componentes/PainelComandos'
import { PainelSimulacao } from './componentes/PainelSimulacao'
import { carregarConfiguracao, salvarConfiguracao, type Configuracao } from './configuracao'
import type { Comando } from './contrato'
import { filtrarJanela, reduzir } from './historico'
import {
  avaliarComando,
  pedidoDeConfirmacao,
  podeAlterarTemperaturaAlvo,
  type ContextoComando,
  type PedidoConfirmacao,
} from './intertravamentos'
import {
  ativarNotificacoes,
  desativarNotificacoes,
  notificacoesAtivas,
  notificacoesSuportadas,
} from './notificacoes'
import { useSistema } from './useSistema'

export default function App() {
  const [configuracao, setConfiguracao] = useState(carregarConfiguracao)

  const mudarConfiguracao = useCallback((nova: Configuracao) => {
    salvarConfiguracao(nova)
    setConfiguracao(nova)
  }, [])

  // trocar de fonte remonta o painel: histórico e ocorrências da simulação e do ESP32 real ficam separados
  return <Painel key={configuracao.fonte} configuracao={configuracao} aoMudarConfiguracao={mudarConfiguracao} />
}

interface PropsPainel {
  configuracao: Configuracao
  aoMudarConfiguracao: (configuracao: Configuracao) => void
}

function Painel({ configuracao, aoMudarConfiguracao }: PropsPainel) {
  const sistema = useSistema(configuracao)
  const [janela, setJanela] = useState<number | null>(15 * 60_000)
  const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false)
  const [confirmacao, setConfirmacao] = useState<(PedidoConfirmacao & { comando: Comando }) | null>(null)
  const [notificando, setNotificando] = useState(notificacoesAtivas)

  const contexto: ContextoComando = {
    telemetria: sistema.telemetria,
    dispositivoOnline: sistema.dispositivoOnline,
    dadosAtualizados: sistema.dadosAtualizados,
  }

  const dadosGrafico = useMemo(
    () => reduzir(filtrarJanela(sistema.historico, janela, sistema.agora)),
    [sistema.historico, janela, sistema.agora],
  )

  function solicitarComando(comando: Comando) {
    const pedido = pedidoDeConfirmacao(comando, sistema.telemetria)
    if (pedido) setConfirmacao({ ...pedido, comando })
    else sistema.enviarComando(comando)
  }

  function confirmarComando() {
    // reavalia na hora do clique: o estado pode ter mudado com o diálogo aberto
    if (confirmacao && avaliarComando(confirmacao.comando, contexto).permitido) sistema.enviarComando(confirmacao.comando)
    setConfirmacao(null)
  }

  async function alternarNotificacoes() {
    if (notificando) {
      desativarNotificacoes()
      setNotificando(false)
    } else {
      setNotificando(await ativarNotificacoes())
    }
  }

  const pendente = sistema.pendente
  const fecharConfirmacao = useCallback(() => setConfirmacao(null), [])
  const fecharConfiguracoes = useCallback(() => setMostrarConfiguracoes(false), [])

  return (
    <div className="app">
      <Cabecalho
        fonte={configuracao.fonte}
        conexao={sistema.conexao}
        dispositivoOnline={sistema.dispositivoOnline}
        ultimaAtualizacao={sistema.ultimaAtualizacao}
        agora={sistema.agora}
        notificacoes={{ suportadas: notificacoesSuportadas(), ativas: notificando, alternar: alternarNotificacoes }}
        aoAbrirConfiguracoes={() => setMostrarConfiguracoes(true)}
      />

      <main className="conteudo">
        <BannerStatus
          telemetria={sistema.telemetria}
          dispositivoOnline={sistema.dispositivoOnline}
          dadosAtualizados={sistema.dadosAtualizados}
          jaRecebeuDados={sistema.ultimaAtualizacao !== null}
        />

        <section className="indicadores" aria-label="Indicadores em tempo real">
          <CartaoTemperatura telemetria={sistema.telemetria} atualizado={sistema.dadosAtualizados} />
          <CartaoAlvo
            telemetria={sistema.telemetria}
            disponibilidade={podeAlterarTemperaturaAlvo(contexto)}
            valorPendente={pendente?.tipo === 'alvo' ? pendente.valor : null}
            aoEnviar={sistema.enviarTemperaturaAlvo}
          />
          <CartaoVazao telemetria={sistema.telemetria} atualizado={sistema.dadosAtualizados} />
          <CartaoValvula telemetria={sistema.telemetria} />
          <CartaoSistema
            telemetria={sistema.telemetria}
            atualizado={sistema.dadosAtualizados}
            dispositivoOnline={sistema.dispositivoOnline}
          />
        </section>

        <section className="secao" aria-labelledby="titulo-historico">
          <div className="secao__topo">
            <h2 id="titulo-historico" className="secao__titulo">
              Histórico
            </h2>
            <SeletorJanela valor={janela} aoMudar={setJanela} />
          </div>
          <div className="graficos">
            <Cartao titulo="Temperatura (°C)">
              <LimiteDeErro>
                <GraficoTemperatura dados={dadosGrafico} />
              </LimiteDeErro>
            </Cartao>
            <Cartao titulo="Vazão (L/min)">
              <LimiteDeErro>
                <GraficoVazao dados={dadosGrafico} />
              </LimiteDeErro>
            </Cartao>
          </div>
        </section>

        <section className="operacao" aria-label="Operação">
          <PainelComandos
            contexto={contexto}
            pendente={pendente?.tipo === 'comando' ? pendente.comando : null}
            aoSolicitar={solicitarComando}
          />
          {sistema.simulador && <PainelSimulacao simulador={sistema.simulador} />}
          <PainelAlertas eventos={sistema.eventos} agora={sistema.agora} />
        </section>
      </main>

      <footer className="rodape">
        WaterSave IoT · camada de aplicação · contrato de dados em <code>docs/contrato-de-dados.md</code>
      </footer>

      {confirmacao && (
        <DialogoConfirmacao
          titulo={confirmacao.titulo}
          mensagem={confirmacao.mensagem}
          rotuloConfirmar={confirmacao.rotuloConfirmar}
          bloqueio={avaliarComando(confirmacao.comando, contexto).motivo}
          aoConfirmar={confirmarComando}
          aoCancelar={fecharConfirmacao}
        />
      )}

      {mostrarConfiguracoes && (
        <Configuracoes
          configuracao={configuracao}
          aoSalvar={(nova) => {
            aoMudarConfiguracao(nova)
            setMostrarConfiguracoes(false)
          }}
          aoLimparHistorico={sistema.limparHistorico}
          aoFechar={fecharConfiguracoes}
        />
      )}
    </div>
  )
}
