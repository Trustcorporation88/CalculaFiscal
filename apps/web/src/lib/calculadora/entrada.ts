import { D } from '@calculafiscal/motor-fiscal';
import type { BaseMargem, Regime } from '@calculafiscal/motor-fiscal';
import { CENARIOS, type Cenario } from '@calculafiscal/regras/cenarios';

/** Valores do formulário como o usuário digitou (formato brasileiro). */
export type ValoresFormulario = Readonly<Record<string, string>>;

/** Entrada da calculadora já validada; percentuais em fração ("0.18") e valores com ponto. */
export interface EntradaCalculadora {
  readonly descricao: string;
  readonly ncm: string | null;
  /** Tratamento de CBS/IBS (cClassTrib); 000001 = tributação integral. */
  readonly cClassTrib: string;
  readonly cenario: Cenario;
  readonly notaCompra: string;
  readonly aliquotaIcms: string;
  readonly aliquotaIpi: string;
  readonly aliquotaPisCofins: string;
  readonly substituicaoTributaria: {
    readonly mva: string;
    readonly aliquotaInterna: string;
  } | null;
  readonly freteEDespesas: string;
  readonly regime: Regime;
  readonly aliquotaDas: string | null;
  readonly parcelaCbsIbsNoDas: string | null;
  readonly aliquotaIcmsSaida: string;
  readonly creditaIcmsEntrada: boolean;
  readonly aliquotaPisCofinsSaida: string;
  readonly creditoPisCofinsEntrada: string;
  readonly despesasVariaveis: string;
  readonly margem: string;
  readonly baseMargem: BaseMargem;
  readonly impostoSimplificado: string;
}

export type LeituraEntrada =
  | { readonly ok: true; readonly entrada: EntradaCalculadora }
  | { readonly ok: false; readonly erros: Readonly<Record<string, string>> };

export const REGIMES: readonly Regime[] = ['SIMPLES_DAS', 'SIMPLES_REGULAR', 'PRESUMIDO', 'REAL'];
const BASES: readonly BaseMargem[] = ['PRECO_COM_TRIBUTO', 'RECEITA_LIQUIDA'];

/** "1.234,56", "1234,56" ou "1234.56" para "1234.56". Devolve null se não for número. */
export function numeroBrasileiro(texto: string): string | null {
  let t = texto.trim().replace(/\s/g, '').replace(/^R\$/, '').replace(/%$/, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? t : null;
}

/** Teto de qualquer valor digitado (R$ 1 bilhão por unidade ou 1 bilhão %). */
const LIMITE_VALOR = 1_000_000_000;

const NCM = /^\d{4}\.?\d{2}\.?\d{2}$/;

/**
 * Lê e valida o formulário. Nunca completa um campo que o usuário deixou em branco com um
 * valor "razoável": campo obrigatório vazio é erro, para não gerar número com aparência de certo.
 */
export function lerEntrada(v: ValoresFormulario): LeituraEntrada {
  const erros: Record<string, string> = {};
  const texto = (campo: string) => (v[campo] ?? '').trim();

  const valor = (campo: string, opcoes: { obrigatorio?: boolean; positivo?: boolean } = {}) => {
    const bruto = texto(campo);
    if (bruto === '') {
      if (opcoes.obrigatorio ?? true) erros[campo] = 'Informe este valor.';
      return '0';
    }
    const n = numeroBrasileiro(bruto);
    if (n === null) {
      erros[campo] = 'Use só números, com vírgula para os centavos.';
      return '0';
    }
    if (opcoes.positivo && new D(n).lte(0)) erros[campo] = 'Precisa ser maior que zero.';
    if (new D(n).gt(LIMITE_VALOR)) erros[campo] = 'Valor grande demais.';
    return new D(n).toFixed();
  };

  const percentual = (campo: string, obrigatorio = true, menorQue100 = true) => {
    const bruto = texto(campo);
    if (bruto === '' && !obrigatorio) return null;
    const n = valor(campo);
    if (erros[campo]) return '0';
    const fracao = new D(n).div(100);
    if (menorQue100 && fracao.gte(1)) erros[campo] = 'Precisa ser menor que 100%.';
    return fracao.toFixed();
  };

  const regime = texto('regime') as Regime;
  if (!REGIMES.includes(regime)) erros['regime'] = 'Escolha o regime.';
  const simples = regime === 'SIMPLES_DAS' || regime === 'SIMPLES_REGULAR';

  const baseMargem = texto('baseMargem') as BaseMargem;
  if (!BASES.includes(baseMargem)) erros['baseMargem'] = 'Escolha a base da margem.';

  const cenario = (texto('cenario') || 'base') as Cenario;
  if (!CENARIOS.includes(cenario)) erros['cenario'] = 'Cenário desconhecido.';

  const cClassTrib = texto('cClassTrib') || '000001';
  if (!/^\d{6}$/.test(cClassTrib)) erros['cClassTrib'] = 'cClassTrib com 6 dígitos, ex.: 200034.';

  const ncmBruto = texto('ncm');
  if (ncmBruto !== '' && !NCM.test(ncmBruto)) erros['ncm'] = 'NCM com 8 dígitos, ex.: 2202.10.00.';

  const temSt = texto('temSt') === 'on';
  // A MVA pode passar de 100% (ex.: 140% em alguns produtos).
  const mva = temSt ? percentual('mva', true, false) : null;
  const aliquotaInterna = temSt ? percentual('aliquotaInterna') : null;

  const entrada: EntradaCalculadora = {
    descricao: texto('descricao').slice(0, 120),
    ncm: ncmBruto === '' ? null : ncmBruto,
    cClassTrib,
    cenario,
    notaCompra: valor('notaCompra', { positivo: true }),
    aliquotaIcms: percentual('aliquotaIcms') as string,
    aliquotaIpi: percentual('aliquotaIpi') as string,
    aliquotaPisCofins: percentual('aliquotaPisCofins') as string,
    substituicaoTributaria:
      mva !== null && aliquotaInterna !== null ? { mva, aliquotaInterna } : null,
    freteEDespesas: valor('freteEDespesas', { obrigatorio: false }),
    regime,
    aliquotaDas: simples ? percentual('aliquotaDas') : null,
    parcelaCbsIbsNoDas: simples ? percentual('parcelaCbsIbsNoDas', false) : null,
    aliquotaIcmsSaida: simples ? '0' : (percentual('aliquotaIcmsSaida') as string),
    creditaIcmsEntrada: !simples && texto('creditaIcmsEntrada') === 'on',
    aliquotaPisCofinsSaida: simples ? '0' : (percentual('aliquotaPisCofinsSaida') as string),
    creditoPisCofinsEntrada: simples ? '0' : (percentual('creditoPisCofinsEntrada') as string),
    despesasVariaveis: percentual('despesasVariaveis') as string,
    margem: percentual('margem') as string,
    baseMargem,
    impostoSimplificado: percentual('impostoSimplificado') as string,
  };

  return Object.keys(erros).length > 0 ? { ok: false, erros } : { ok: true, entrada };
}
