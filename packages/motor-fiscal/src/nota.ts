import { reconstruirCompra } from './compra.js';
import { D, dec, type Dec } from './decimal.js';
import type { PassoMemoria } from './memoria.js';
import type { Fornecimento, ParametrosAno } from './tipos.js';

export interface PrecoLiquidoDaNota {
  /** Preço líquido do fornecedor, em milésimos de real. */
  readonly precoLiquido: string;
  /** Total da nota remontado com esse preço líquido (pode diferir 1 centavo pelo arredondamento). */
  readonly totalRemontado: string;
  /**
   * Preços líquidos que fecham a mesma nota (a nota tem só centavos). Projeções feitas com
   * valores diferentes dessa faixa podem diferir alguns centavos nos anos seguintes.
   */
  readonly faixa: { readonly de: string; readonly ate: string };
  readonly memoria: PassoMemoria;
}

const MILESIMO = new D('0.001');

/**
 * Na faixa [inicio, fim] (em milésimos), o centavo inteiro mais perto do meio; se ele cair fora
 * da faixa, nenhum outro centavo cabe nela (estaria ainda mais longe do meio) e fica o meio.
 */
function centavoMaisAoMeio(inicio: Dec, fim: Dec): Dec {
  const meio = inicio.plus(fim).div(2);
  const centavo = meio.div(10).round().times(10);
  return centavo.gte(inicio) && centavo.lte(fim) ? centavo : meio.floor();
}

/**
 * Quem compra conhece o total da nota, não o preço líquido do fornecedor. Esta função acha o
 * preço líquido que remonta aquela nota no ano de referência, para projetar os anos seguintes.
 * O total da nota cresce com o preço líquido, então a busca é binária, em milésimos de real.
 * Entre os preços que fecham a nota exatamente, prefere um valor em centavos inteiros, o mais
 * perto do meio da faixa; sem centavo inteiro na faixa, usa o milésimo do meio.
 */
export function precoLiquidoPelaNota(
  f: Omit<Fornecimento, 'precoLiquido'>,
  totalNota: string,
  p: ParametrosAno,
): PrecoLiquidoDaNota {
  const alvo = dec(totalNota);
  if (alvo.lte(0)) throw new RangeError('O total da nota precisa ser maior que zero.');

  const total = (milesimos: Dec) =>
    reconstruirCompra({ ...f, precoLiquido: milesimos.times(MILESIMO).toFixed(3) }, p, [])
      .totalNota;

  // Menor preço líquido (em milésimos) cujo total é >= limite.
  const primeiro = (limite: Dec, aceitaIgual: boolean) => {
    let baixo = new D(0);
    // O total nunca é menor que o preço líquido: com nota + 1 centavo o total já passa do alvo.
    let alto = alvo.div(MILESIMO).ceil().plus(10);
    while (baixo.lt(alto)) {
      const meio = baixo.plus(alto).div(2).floor();
      const t = total(meio);
      if (aceitaIgual ? t.gte(limite) : t.gt(limite)) alto = meio;
      else baixo = meio.plus(1);
    }
    return baixo;
  };

  const inicio = primeiro(alvo, true);
  const fim = primeiro(alvo, false).minus(1);
  const exato = fim.gte(inicio);
  const escolhido = exato
    ? centavoMaisAoMeio(inicio, fim)
    : // Nenhum preço fecha a nota no centavo: fica o mais próximo.
      [inicio.minus(1), inicio]
        .filter((m) => m.gte(0))
        .sort((a, b) => total(a).minus(alvo).abs().comparedTo(total(b).minus(alvo).abs()))[0]!;

  const reaisDe = (m: Dec) => m.times(MILESIMO).toFixed(3);
  const precoLiquido = reaisDe(escolhido);
  const totalRemontado = total(escolhido).toFixed(2);
  const faixa = exato
    ? { de: reaisDe(inicio), ate: reaisDe(fim) }
    : { de: precoLiquido, ate: precoLiquido };
  return {
    precoLiquido,
    totalRemontado,
    faixa,
    memoria: {
      id: 'compra.preco-liquido-pela-nota',
      descricao: `Preço líquido do fornecedor que remonta a nota de ${p.ano}`,
      formula: 'busca do preço líquido cujo total da nota é igual ao informado',
      entradas: {
        totalNotaInformado: alvo.toFixed(2),
        totalRemontado,
        faixaDe: faixa.de,
        faixaAte: faixa.ate,
      },
      resultado: precoLiquido,
      regras: p.regras.map((r) => `${r.id}@${r.versao}`),
    },
  };
}
