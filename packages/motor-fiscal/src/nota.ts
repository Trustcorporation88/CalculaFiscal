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
/** Teto por unidade: mantém a busca em inteiros exatos na precisão do Decimal (34 dígitos). */
const NOTA_MAXIMA = new D('1000000000');

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
  if (alvo.gt(NOTA_MAXIMA)) {
    throw new RangeError('O total da nota por unidade passa do limite de R$ 1 bilhão.');
  }

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
  const remontado = total(escolhido);
  // Até 1 centavo de diferença é arredondamento (a nota pula aquele centavo); mais que isso, a
  // nota é menor que o mínimo possível com esses tributos e frete, e projetar seria enganoso.
  if (remontado.minus(alvo).abs().gt('0.01')) {
    throw new RangeError(
      `Com esses tributos e frete, a menor nota possível é R$ ${total(new D(0)).toFixed(2)}; a informada (R$ ${alvo.toFixed(2)}) é menor. Confira os valores.`,
    );
  }
  const totalRemontado = remontado.toFixed(2);
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
