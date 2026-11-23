import { Component, type ReactNode } from 'react'

interface Estado {
  erro: Error | null
}

/** Isola falhas de renderização (ex.: um gráfico) para não derrubar o dashboard inteiro. */
export class LimiteDeErro extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null }

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro }
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="grafico__vazio">
          <p>
            Não foi possível exibir este componente.{' '}
            <button type="button" className="botao botao--discreto" onClick={() => this.setState({ erro: null })}>
              Tentar de novo
            </button>
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
