import { gravarJson, lerJson } from './armazenamento'

export interface ConfigMqtt {
  /** endereço WebSocket do broker, ex.: wss://xxxx.s1.eu.hivemq.cloud:8884/mqtt */
  url: string
  usuario: string
  senha: string
  /** prefixo dos tópicos, ex.: "watersave" gera "watersave/estado" */
  prefixo: string
}

export type TipoFonte = 'simulacao' | 'mqtt'

export interface Configuracao {
  fonte: TipoFonte
  mqtt: ConfigMqtt
}

// broker público da HiveMQ: serve para testes, mas qualquer pessoa pode ler e publicar nele
export const MQTT_PADRAO: ConfigMqtt = {
  url: 'wss://broker.hivemq.com:8884/mqtt',
  usuario: '',
  senha: '',
  prefixo: 'watersave',
}

const CHAVE = 'watersave:configuracao'

export function carregarConfiguracao(): Configuracao {
  const salva = lerJson<Partial<Configuracao>>(CHAVE, {})
  return {
    fonte: salva.fonte === 'mqtt' ? 'mqtt' : 'simulacao',
    mqtt: { ...MQTT_PADRAO, ...salva.mqtt },
  }
}

export function salvarConfiguracao(configuracao: Configuracao): void {
  gravarJson(CHAVE, configuracao)
}
