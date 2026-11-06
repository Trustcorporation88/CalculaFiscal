import { arredondarMoeda, D, dec, type Dec } from './decimal.js';
import type { PassoMemoria } from './memoria.js';
import type { Fornecimento, ParametrosAno, PerfilVenda } from './tipos.js';

export interface Compra {
  readonly precoFornecedor: Dec;
  readonly icmsProprio: Dec;
  readonly pisCofins: Dec;
  readonly ipi: Dec;
  readonly icmsSt: Dec;
  readonly is: Dec;
  readonly cbs: Dec;
  readonly ibs: Dec;
  readonly frete: Dec;
  readonly totalNota: Dec;
}

export interface Creditos {
  readonly icms: Dec;
  readonly pisCofins: Dec;
  readonly cbs: Dec;
  readonly ibs: Dec;
  readonly total: Dec;
}

const ZERO = new D(0);
const ref = (p: ParametrosAno) => p.regras.map((r) => `${r.id}@${r.versao}`);

/**
 * Remonta a nota de compra do ano a partir do preço líquido do fornecedor.
 * Ordem: IS sobre o preço líquido; ICMS e PIS/Cofins por dentro; IPI sobre o valor da operação;
 * CBS/IBS por fora, sobre o valor sem ICMS e PIS/Cofins (LC 214, art. 12, §2º, V); ST sobre a base presumida.
 */
export function reconstruirCompra(
  f: Fornecimento,
  p: ParametrosAno,
  memoria: PassoMemoria[],
): Compra {
  const liquido = dec(f.precoLiquido);
  const fator = dec(p.fatorIcms);
  const aIcms = dec(f.aliquotaIcms).times(fator);
  const aPc = p.pisCofinsVigente ? dec(f.aliquotaPisCofins) : ZERO;
  const aIpi = p.ipiVigente ? dec(f.aliquotaIpi) : ZERO;
  const frete = arredondarMoeda(dec(f.freteEDespesas));

  const is = arredondarMoeda(liquido.times(dec(p.aliquotaIs)));
  const divisor = new D(1).minus(aIcms).minus(aPc);
  if (divisor.lte(0)) throw new RangeError('ICMS e PIS/Cofins do fornecedor somam 100% ou mais.');
  const precoFornecedor = arredondarMoeda(liquido.plus(is).div(divisor));
  const icmsProprio = arredondarMoeda(precoFornecedor.times(aIcms));
  const pisCofins = arredondarMoeda(precoFornecedor.times(aPc));
  const ipi = arredondarMoeda(precoFornecedor.times(aIpi));

  const baseCbsIbs = precoFornecedor.minus(icmsProprio).minus(pisCofins);
  const cbs = p.cbsIbsComEfeito ? arredondarMoeda(baseCbsIbs.times(dec(p.cbs))) : ZERO;
  const ibs = p.cbsIbsComEfeito ? arredondarMoeda(baseCbsIbs.times(dec(p.ibs))) : ZERO;

  let icmsSt = ZERO;
  if (f.substituicaoTributaria) {
    const st = f.substituicaoTributaria;
    const baseSt = precoFornecedor
      .plus(ipi)
      .plus(frete)
      .times(new D(1).plus(dec(st.mva)));
    const devido = baseSt.times(dec(st.aliquotaInterna).times(fator)).minus(icmsProprio);
    icmsSt = arredondarMoeda(D.max(ZERO, devido));
  }

  const totalNota = precoFornecedor.plus(ipi).plus(icmsSt).plus(cbs).plus(ibs).plus(frete);

  memoria.push(
    {
      id: 'compra.is',
      descricao: 'Imposto Seletivo embutido pelo fornecedor (monofásico, sem crédito)',
      formula: 'preço líquido do fornecedor × alíquota do IS',
      entradas: { precoLiquido: liquido.toString(), aliquotaIs: p.aliquotaIs },
      resultado: is.toFixed(2),
      regras: ref(p),
    },
    {
      id: 'compra.preco-fornecedor',
      descricao: 'Valor da operação do fornecedor (ICMS e PIS/Cofins por dentro)',
      formula: '(preço líquido + IS) ÷ (1 − ICMS × fator − PIS/Cofins)',
      entradas: {
        precoLiquido: liquido.toString(),
        is: is.toFixed(2),
        aliquotaIcmsEfetiva: aIcms.toString(),
        aliquotaPisCofins: aPc.toString(),
      },
      resultado: precoFornecedor.toFixed(2),
      regras: ref(p),
    },
    {
      id: 'compra.cbs-ibs',
      descricao: p.cbsIbsComEfeito
        ? 'CBS e IBS destacados pelo fornecedor (por fora)'
        : 'CBS e IBS de teste: destaque sem efeito econômico',
      formula: '(valor da operação − ICMS − PIS/Cofins) × alíquota',
      entradas: { base: baseCbsIbs.toFixed(2), cbs: p.cbs, ibs: p.ibs },
      resultado: `CBS ${cbs.toFixed(2)} + IBS ${ibs.toFixed(2)}`,
      regras: ref(p),
    },
    {
      id: 'compra.nota',
      descricao: 'Total da nota de compra',
      formula: 'valor da operação + IPI + ICMS-ST + CBS + IBS + frete',
      entradas: {
        precoFornecedor: precoFornecedor.toFixed(2),
        ipi: ipi.toFixed(2),
        icmsSt: icmsSt.toFixed(2),
        cbs: cbs.toFixed(2),
        ibs: ibs.toFixed(2),
        frete: frete.toFixed(2),
      },
      resultado: totalNota.toFixed(2),
      regras: ref(p),
    },
  );

  return { precoFornecedor, icmsProprio, pisCofins, ipi, icmsSt, is, cbs, ibs, frete, totalNota };
}

/**
 * Créditos que o comprador apropria. IS, IPI (comércio) e ICMS-ST nunca viram crédito.
 * CBS/IBS só geram crédito fora do Simples no DAS.
 */
export function apurarCreditos(
  c: Compra,
  perfil: PerfilVenda,
  p: ParametrosAno,
  memoria: PassoMemoria[],
): Creditos {
  const icms = perfil.creditaIcmsEntrada && c.icmsSt.isZero() ? c.icmsProprio : ZERO;
  const pisCofins = p.pisCofinsVigente
    ? arredondarMoeda(c.precoFornecedor.times(dec(perfil.creditoPisCofinsEntrada)))
    : ZERO;
  const regular = perfil.regime !== 'SIMPLES_DAS';
  const cbs = regular ? c.cbs : ZERO;
  const ibs = regular ? c.ibs : ZERO;
  const total = icms.plus(pisCofins).plus(cbs).plus(ibs);
  memoria.push({
    id: 'compra.creditos',
    descricao: regular
      ? 'Créditos apropriados na compra'
      : 'Créditos na compra (Simples no DAS não credita CBS/IBS: viram custo)',
    formula: 'ICMS próprio (sem ST) + PIS/Cofins + CBS + IBS; IS, IPI e ST nunca creditam',
    entradas: {
      icms: icms.toFixed(2),
      pisCofins: pisCofins.toFixed(2),
      cbs: cbs.toFixed(2),
      ibs: ibs.toFixed(2),
    },
    resultado: total.toFixed(2),
    regras: ref(p),
  });
  return { icms, pisCofins, cbs, ibs, total };
}
