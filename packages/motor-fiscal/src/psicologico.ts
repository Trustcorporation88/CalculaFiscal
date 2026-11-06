import { D, dec } from './decimal.js';

/**
 * Preço psicológico: o primeiro valor igual ou acima do preço com final comercial.
 * Até R$ 10: finais ,49, ,90 e ,99. De R$ 10 a R$ 100: ,90 e ,99. A partir de R$ 100: dezena
 * terminada em 9,90 (123,45 vira 129,90). Sempre arredonda para cima: nunca reduz a margem.
 */
export function precoPsicologico(valor: string): string {
  const v = dec(valor);
  if (v.lte(0)) throw new RangeError('O preço precisa ser maior que zero.');
  const centavos = v.times(100).ceil().toNumber();
  let sugerido: number;
  if (centavos >= 10_000) {
    // Próximo valor da forma X9,90 (em centavos, terminado em 990).
    sugerido = Math.ceil((centavos - 990) / 1000) * 1000 + 990;
  } else {
    const finais = centavos < 1000 ? [49, 90, 99] : [90, 99];
    const reais = Math.floor(centavos / 100);
    // O próximo real com o menor final (,49 ou ,90) sempre fica acima do preço.
    const candidatos = [...finais.map((f) => reais * 100 + f), (reais + 1) * 100 + finais[0]!];
    sugerido = candidatos.find((c) => c >= centavos) as number;
  }
  return new D(sugerido).div(100).toFixed(2);
}
