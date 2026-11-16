import type { ReactNode } from 'react'

export type Destaque = 'ok' | 'info' | 'aviso' | 'falha' | 'neutro'

interface Props {
  titulo: string
  children: ReactNode
  destaque?: Destaque
  className?: string
  acoes?: ReactNode
}

export function Cartao({ titulo, children, destaque = 'neutro', className = '', acoes }: Props) {
  return (
    <section className={`cartao cartao--${destaque} ${className}`} aria-label={titulo}>
      <header className="cartao__topo">
        <h2 className="cartao__titulo">{titulo}</h2>
        {acoes}
      </header>
      {children}
    </section>
  )
}
