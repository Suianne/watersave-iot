import { useEffect, useId, type ReactNode } from 'react'

interface Props {
  titulo: string
  children: ReactNode
  rodape: ReactNode
  aoFechar: () => void
}

export function Dialogo({ titulo, children, rodape, aoFechar }: Props) {
  const idTitulo = useId()

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  return (
    <div className="sobreposicao" onClick={aoFechar}>
      <div
        className="dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id={idTitulo} className="dialogo__titulo">
          {titulo}
        </h2>
        <div className="dialogo__corpo">{children}</div>
        <div className="dialogo__rodape">{rodape}</div>
      </div>
    </div>
  )
}

interface PropsConfirmacao {
  titulo: string
  mensagem: string
  rotuloConfirmar: string
  /** motivo para bloquear a confirmação se o estado mudou com o diálogo aberto */
  bloqueio?: string
  aoConfirmar: () => void
  aoCancelar: () => void
}

export function DialogoConfirmacao({ titulo, mensagem, rotuloConfirmar, bloqueio, aoConfirmar, aoCancelar }: PropsConfirmacao) {
  return (
    <Dialogo
      titulo={titulo}
      aoFechar={aoCancelar}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoCancelar} autoFocus>
            Cancelar
          </button>
          <button type="button" className="botao botao--primario" onClick={aoConfirmar} disabled={Boolean(bloqueio)}>
            {rotuloConfirmar}
          </button>
        </>
      }
    >
      <p>{mensagem}</p>
      {bloqueio && <p className="nota nota--falha">O estado do sistema mudou: {bloqueio}</p>}
    </Dialogo>
  )
}
