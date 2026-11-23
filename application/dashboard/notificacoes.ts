// Notificações do navegador para falhas, só quando a aba não está visível.
// Precisa de HTTPS ou localhost: no celular via IP da rede local o navegador não oferece.

import { gravarJson, lerJson } from './armazenamento'

const CHAVE = 'watersave:notificacoes'

export function notificacoesSuportadas(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificacoesAtivas(): boolean {
  return notificacoesSuportadas() && Notification.permission === 'granted' && lerJson(CHAVE, false)
}

export async function ativarNotificacoes(): Promise<boolean> {
  if (!notificacoesSuportadas()) return false
  try {
    const permitido = (await Notification.requestPermission()) === 'granted'
    gravarJson(CHAVE, permitido)
    return permitido
  } catch {
    return false
  }
}

export function desativarNotificacoes(): void {
  gravarJson(CHAVE, false)
}

export function notificar(titulo: string, corpo?: string): void {
  if (!notificacoesAtivas() || !document.hidden) return
  try {
    new Notification(`WaterSave IoT: ${titulo}`, { body: corpo, tag: titulo })
  } catch {
    // alguns navegadores móveis só notificam via service worker
  }
}
