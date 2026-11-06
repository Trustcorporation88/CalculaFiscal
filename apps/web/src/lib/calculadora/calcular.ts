import {
  linhaDoTempo,
  precoLiquidoPelaNota,
  precoSimplificado,
  VERSAO_MOTOR,
  type Fornecimento,
  type PassoMemoria,
  type PerfilVenda,
  type ResultadoAno,
  type ResultadoSimplificado,
  type Status,
} from '@calculafiscal/motor-fiscal';
import { resolverPeriodo, type Regra, type TabelaDeRegras } from '@calculafiscal/regras';
import type { EntradaCalculadora } from './entrada';

/** Uma regra usada no cálculo, com fonte, vigência e status, para a tela de fontes. */
export interface FonteUsada {
  readonly chave: string;
  readonly tributo: Regra['tributo'];
  readonly descricao: string;
  readonly aliquota: string;
  readonly vigencia: string;
  readonly norma: string;
  readonly artigo: string;
  readonly url: string | null;
  readonly status: Status;
  readonly conferencia: Regra['conferencia'];
  readonly observacao: string | null;
}

export interface ResultadoCalculadora {
  readonly descricao: string;
  readonly cenario: EntradaCalculadora['cenario'];
  readonly regime: EntradaCalculadora['regime'];
  readonly precoLiquidoFornecedor: string;
  readonly faixaPrecoLiquido: { readonly de: string; readonly ate: string };
  readonly memoriaNota: PassoMemoria;
  readonly anos: readonly ResultadoAno[];
  readonly simplificado: ResultadoSimplificado;
  readonly impostoSimplificado: string;
  readonly fontes: readonly FonteUsada[];
  readonly versaoRegras: string;
  readonly versaoMotor: string;
}

/**
 * Linha do tempo de 2026 a 2033 para um produto. A nota informada é a de 2026: dela sai o
 * preço líquido do fornecedor, que é mantido nos anos seguintes (premissa mostrada na tela).
 */
export function calcularLinhaDoTempo(
  e: EntradaCalculadora,
  tabela: TabelaDeRegras,
): ResultadoCalculadora {
  const parametros = resolverPeriodo(tabela.regras, {
    cenario: e.cenario,
    ...(e.ncm ? { ncm: e.ncm } : {}),
  });
  const [ano2026] = parametros;
  if (!ano2026 || ano2026.ano !== 2026)
    throw new Error('A linha do tempo precisa começar em 2026.');

  const semPreco: Omit<Fornecimento, 'precoLiquido'> = {
    aliquotaIcms: e.aliquotaIcms,
    aliquotaIpi: e.aliquotaIpi,
    aliquotaPisCofins: e.aliquotaPisCofins,
    substituicaoTributaria: e.substituicaoTributaria,
    freteEDespesas: e.freteEDespesas,
  };
  const nota = precoLiquidoPelaNota(semPreco, e.notaCompra, ano2026);
  const perfil: PerfilVenda = {
    regime: e.regime,
    aliquotaIcmsSaida: e.aliquotaIcmsSaida,
    creditaIcmsEntrada: e.creditaIcmsEntrada,
    aliquotaPisCofinsSaida: e.aliquotaPisCofinsSaida,
    creditoPisCofinsEntrada: e.creditoPisCofinsEntrada,
    aliquotaDas: e.aliquotaDas,
    parcelaCbsIbsNoDas: e.parcelaCbsIbsNoDas,
    despesasVariaveis: e.despesasVariaveis,
    margem: e.margem,
    baseMargem: e.baseMargem,
  };
  const anos = linhaDoTempo(
    { fornecimento: { ...semPreco, precoLiquido: nota.precoLiquido }, perfil },
    parametros,
  );
  const simplificado = precoSimplificado({
    custo: e.notaCompra,
    despesasVariaveis: e.despesasVariaveis,
    imposto: e.impostoSimplificado,
    margem: e.margem,
  });

  const porChave = new Map(tabela.regras.map((r) => [`${r.id}@${r.versao}`, r]));
  const fontes = new Map<string, FonteUsada>();
  for (const p of parametros) {
    for (const ref of p.regras) {
      const chave = `${ref.id}@${ref.versao}`;
      const r = porChave.get(chave);
      if (!r || fontes.has(chave)) continue;
      fontes.set(chave, {
        chave,
        tributo: r.tributo,
        descricao: r.descricao,
        aliquota: r.valor.aliquota,
        vigencia: `${r.vigencia.inicio} a ${r.vigencia.fim ?? 'indeterminado'}`,
        norma: r.fonte.norma,
        artigo: r.fonte.artigo,
        url: r.fonte.url ?? null,
        status: r.status,
        conferencia: r.conferencia,
        observacao: r.observacao ?? null,
      });
    }
  }

  return {
    descricao: e.descricao,
    cenario: e.cenario,
    regime: e.regime,
    precoLiquidoFornecedor: nota.precoLiquido,
    faixaPrecoLiquido: nota.faixa,
    memoriaNota: nota.memoria,
    anos,
    simplificado,
    impostoSimplificado: e.impostoSimplificado,
    fontes: [...fontes.values()],
    versaoRegras: tabela.versao,
    versaoMotor: VERSAO_MOTOR,
  };
}
