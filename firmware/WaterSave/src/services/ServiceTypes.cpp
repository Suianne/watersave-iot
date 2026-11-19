#include "ServiceTypes.h"

namespace service {

const char* alertCode(Alert alert) {
    switch (alert) {
        case Alert::NENHUM: return "";
        case Alert::SENSOR_TEMP_DESCONECTADO: return "SENSOR_TEMP_DESCONECTADO";
        case Alert::LEITURA_TEMP_INVALIDA: return "LEITURA_TEMP_INVALIDA";
        case Alert::SEM_FLUXO_VALVULA_ABERTA: return "SEM_FLUXO_VALVULA_ABERTA";
        case Alert::FLUXO_VALVULA_FECHADA: return "FLUXO_VALVULA_FECHADA";
        case Alert::TEMPO_MAXIMO_EXCEDIDO: return "TEMPO_MAXIMO_EXCEDIDO";
        case Alert::PARADA_EMERGENCIA: return "PARADA_EMERGENCIA";
    }
    return "";
}

const char* stateName(SystemState state) {
    switch (state) {
        case SystemState::INICIANDO: return "INICIANDO";
        case SystemState::AGUARDANDO: return "AGUARDANDO";
        case SystemState::TRANSFERINDO: return "TRANSFERINDO";
        case SystemState::MANUAL: return "MANUAL";
        case SystemState::FALHA: return "FALHA";
    }
    return "?";
}

bool isSensorAlert(Alert alert) {
    return alert == Alert::SENSOR_TEMP_DESCONECTADO ||
           alert == Alert::LEITURA_TEMP_INVALIDA;
}

}  // namespace service
