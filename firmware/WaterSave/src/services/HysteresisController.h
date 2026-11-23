#ifndef WATERSAVE_HYSTERESIS_CONTROLLER_H
#define WATERSAVE_HYSTERESIS_CONTROLLER_H

namespace service {

// Decide se a valvula deve estar aberta, a partir da temperatura e do alvo.
//   abre quando  temperatura >= alvo
//   fecha quando temperatura <= alvo - histerese
//   entre os dois, mantem o estado atual
class HysteresisController {
public:
    HysteresisController(float targetC, float hysteresisC);

    static bool isValidTarget(float valueC);

    // Aceita 20 a 70 C e arredonda para 0,1 C. Fora da faixa, NAN ou
    // infinito: recusa e mantem o alvo anterior.
    bool setTarget(float valueC);

    float target() const { return targetC_; }
    float hysteresis() const { return hysteresisC_; }
    float closeThreshold() const { return targetC_ - hysteresisC_; }

    bool decide(float temperatureC, bool valveCurrentlyOpen) const;

private:
    float targetC_;
    float hysteresisC_;
};

}  // namespace service

#endif  // WATERSAVE_HYSTERESIS_CONTROLLER_H
