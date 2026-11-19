import {
  avaliarPreco,
  avaliarPrecoServico,
  D,
  linhaDoTempo,
  linhaDoTempoServico,
  precoLiquidoPelaNota,
  precoPsicologico,
  precoSimplificado,
  VERSAO_MOTOR,
  type EntradaPrecificacao,
  type EntradaServico,
  type Fornecimento,
  type ModoFornecedor,
  type ParametrosAno,
  type PassoMemoria,
  type PrecoLiquidoDaNota,
  type ResultadoAno,
  type ResultadoSimplificado,
  type Status,
} from '@calculafiscal/motor-fiscal';
import {
  CENARIOS,
  regrasServicoOficiais,
  resolverPeriodo,
  tratamentosDisponiveis,
  tratamentosServicoDisponiveis,
  type Cenario,
  type Regra,
  type TabelaDeRegras,
} from '@calculafiscal/regras';
import type { TratamentoInformado } from './avisos';
import { lerEntrada, type EntradaCalculadora, type ValoresFormulario } from './entrada';
import { CAMPO_AVISOS, COLUNAS_LOTE, LIMITE_LOTE } from './lote';
import { ROTULO_CAMPO } from './rotulos';

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

/** Preço psicológico de um ano e o resultado (margens, lucro) nesse preço. */
export interface SugestaoAno {
  readonly ano: number;
  readonly sugerido: string;
  readonly resultado: ResultadoAno;
}

/** Resumo de um ano para comparar cenários, premissa do fornecedor e lote. */
export interface ResumoAno {
  readonly ano: number;
  readonly status: Status;
  /** O que o cliente paga; nulo quando o ano depende de dado pendente. */
  readonly precoComTributo: string | null;
  readonly sugerido: string | null;
  readonly margemSobrePrecoComTributo: string | null;
}

export interface ResultadoCalculadora {
  readonly entrada: EntradaCalculadora;
  /** Tratamento com redução informado; nulo na tributação integral. */
  readonly tratamento: TratamentoInformado | null;
  readonly precoLiquidoFornecedor: string;
  readonly faixaPrecoLiquido: { readonly de: string; readonly ate: string };
  readonly memoriaNota: PassoMemoria;
  readonly anos: readonly ResultadoAno[];
  readonly sugestoes: readonly SugestaoAno[];
  readonly cenarios: readonly { readonly cenario: Cenario; readonly anos: readonly ResumoAno[] }[];
  /** Comparativo imediato entre o modo escolhido (líquido ou bruto) e o modo alternativo. */
  readonly comparativoFornecedor: {
    readonly modoAlternativo: ModoFornecedor;
    readonly anos: readonly ResumoAno[];
  };
  /** Indisponível quando o próprio cálculo simplificado é impossível (soma >= 100%). */
  readonly simplificado:
    | { readonly ok: true; readonly resultado: ResultadoSimplificado }
    | { readonly ok: false; readonly motivo: string };
  /** Aviso quando a nota remontada difere 1 centavo da informada (arredondamento). */
  readonly ajusteNota: string | null;
  readonly fontes: readonly FonteUsada[];
  readonly versaoRegras: string;
  readonly versaoMotor: string;
}

function fornecimentoSemPreco(e: EntradaCalculadora): Omit<Fornecimento, 'precoLiquido'> {
  return {
    aliquotaIcms: e.aliquotaIcms,
    aliquotaIpi: e.aliquotaIpi,
    aliquotaPisCofins: e.aliquotaPisCofins,
    substituicaoTributaria: e.substituicaoTributaria,
    freteEDespesas: e.freteEDespesas,
  };
}

interface Cenario2026a2033 {
  readonly parametros: readonly ParametrosAno[];
  readonly nota: PrecoLiquidoDaNota;
  readonly anos: readonly ResultadoAno[];
  readonly sugestoes: readonly SugestaoAno[];
}

function calcularCenarioMercadoria(
  e: EntradaCalculadora,
  tabela: TabelaDeRegras,
  cenario: Cenario,
  modoFornecedor: ModoFornecedor = e.modoFornecedor,
): Cenario2026a2033 {
  const parametros = resolverPeriodo(tabela.regras, {
    cenario,
    ...(e.ncm ? { ncm: e.ncm } : {}),
    cClassTrib: e.cClassTrib,
  });
  const [ano2026] = parametros;
  if (!ano2026 || ano2026.ano !== 2026) {
    throw new Error('A linha do tempo precisa começar em 2026.');
  }
  const semPreco = fornecimentoSemPreco(e);
  const nota = precoLiquidoPelaNota(semPreco, e.notaCompra, ano2026);
  const entrada: EntradaPrecificacao = {
    fornecimento: { ...semPreco, precoLiquido: nota.precoLiquido, modoFornecedor },
    perfil: {
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
    },
  };
  const anos = linhaDoTempo(entrada, parametros);
  const sugestoes: SugestaoAno[] = [];
  anos.forEach((a, i) => {
    if (a.situacao !== 'CALCULADO') return;
    const sugerido = precoPsicologico(a.valores.precoComTributo);
    sugestoes.push({
      ano: a.ano,
      sugerido,
      resultado: avaliarPreco(entrada, parametros[i] as ParametrosAno, sugerido),
    });
  });
  return { parametros, nota, anos, sugestoes };
}

function calcularCenarioServico(
  e: EntradaCalculadora,
  tabela: TabelaDeRegras,
  cenario: Cenario,
  modoFornecedor: ModoFornecedor = e.modoFornecedor,
): Cenario2026a2033 {
  const parametros = resolverPeriodo(tabela.regras, {
    cenario,
    natureza: 'SERVICO',
    cClassTrib: e.cClassTrib,
  });
  const entrada: EntradaServico = {
    custos: {
      custoDireto: e.notaCompra,
      parcelaInsumosTributados: e.parcelaInsumosTributados,
      aliquotaPisCofinsInsumos: e.aliquotaPisCofinsInsumos,
      modoFornecedor,
    },
    perfil: {
      regime: e.regime,
      aliquotaIssSaida: e.aliquotaIssSaida,
      aliquotaPisCofinsSaida: e.aliquotaPisCofinsSaida,
      creditoPisCofinsEntrada: e.creditoPisCofinsEntrada,
      aliquotaDas: e.aliquotaDas,
      parcelaCbsIbsNoDas: e.parcelaCbsIbsNoDas,
      despesasVariaveis: e.despesasVariaveis,
      margem: e.margem,
      baseMargem: e.baseMargem,
    },
  };
  const anos = linhaDoTempoServico(entrada, parametros);
  const sugestoes: SugestaoAno[] = [];
  anos.forEach((a, i) => {
    if (a.situacao !== 'CALCULADO') return;
    const sugerido = precoPsicologico(a.valores.precoComTributo);
    sugestoes.push({
      ano: a.ano,
      sugerido,
      resultado: avaliarPrecoServico(entrada, parametros[i] as ParametrosAno, sugerido),
    });
  });
  const fixo = new D(e.notaCompra).toFixed(3);
  const nota: PrecoLiquidoDaNota = {
    precoLiquido: fixo,
    totalRemontado: new D(e.notaCompra).toFixed(2),
    faixa: { de: fixo, ate: fixo },
    memoria: {
      id: 'servico.custo-base',
      descricao: 'Custo direto informado para o serviço em 2026',
      formula: 'custo direto informado × (1 − parcela de insumos tributados) + parcela de insumos',
      entradas: {
        custoDireto: new D(e.notaCompra).toFixed(2),
        parcelaInsumosTributados: e.parcelaInsumosTributados,
        aliquotaPisCofinsInsumos: e.aliquotaPisCofinsInsumos,
      },
      resultado: new D(e.notaCompra).toFixed(2),
      regras: [],
    },
  };
  return { parametros, nota, anos, sugestoes };
}

function calcularCenario(
  e: EntradaCalculadora,
  tabela: TabelaDeRegras,
  cenario: Cenario,
  modoFornecedor: ModoFornecedor = e.modoFornecedor,
): Cenario2026a2033 {
  return e.natureza === 'SERVICO'
    ? calcularCenarioServico(e, tabela, cenario, modoFornecedor)
    : calcularCenarioMercadoria(e, tabela, cenario, modoFornecedor);
}

function resumir(c: Cenario2026a2033): ResumoAno[] {
  return c.anos.map((a) => {
    const s = c.sugestoes.find((x) => x.ano === a.ano);
    return {
      ano: a.ano,
      status: a.status,
      precoComTributo: a.situacao === 'CALCULADO' ? a.valores.precoComTributo : null,
      sugerido: s?.sugerido ?? null,
      margemSobrePrecoComTributo:
        a.situacao === 'CALCULADO' ? a.valores.margemSobrePrecoComTributo : null,
    };
  });
}

function fontesUsadas(tabela: TabelaDeRegras, parametros: readonly ParametrosAno[]): FonteUsada[] {
  const todasRegras = [...tabela.regras, ...regrasServicoOficiais()];
  const porChave = new Map(todasRegras.map((r) => [`${r.id}@${r.versao}`, r]));
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
        status: ref.status,
        conferencia: r.conferencia,
        observacao: r.observacao ?? null,
      });
    }
  }
  return [...fontes.values()];
}

function simplificadoOuMotivo(e: EntradaCalculadora): ResultadoCalculadora['simplificado'] {
  try {
    return {
      ok: true,
      resultado: precoSimplificado({
        custo: e.notaCompra,
        despesasVariaveis: e.despesasVariaveis,
        imposto: e.impostoSimplificado,
        margem: e.margem,
      }),
    };
  } catch (erro) {
    if (erro instanceof RangeError) return { ok: false, motivo: erro.message };
    throw erro;
  }
}

/** Resultado completo da calculadora: cenário escolhido em detalhe, cenários e premissa alternativa resumidos. */
export function calcularLinhaDoTempo(
  e: EntradaCalculadora,
  tabela: TabelaDeRegras,
): ResultadoCalculadora {
  const principal = calcularCenario(e, tabela, e.cenario, e.modoFornecedor);
  const cenarios = CENARIOS.map((cenario) => ({
    cenario,
    anos: resumir(cenario === e.cenario ? principal : calcularCenario(e, tabela, cenario)),
  }));
  const modoAlternativo: ModoFornecedor =
    e.modoFornecedor === 'PRECO_LIQUIDO' ? 'PRECO_BRUTO' : 'PRECO_LIQUIDO';
  const alternativo = calcularCenario(e, tabela, e.cenario, modoAlternativo);
  const catalogoTratamentos =
    e.natureza === 'SERVICO'
      ? tratamentosServicoDisponiveis()
      : tratamentosDisponiveis(tabela.regras);

  return {
    entrada: e,
    tratamento: catalogoTratamentos.find((t) => t.codigo === e.cClassTrib) ?? null,
    precoLiquidoFornecedor: principal.nota.precoLiquido,
    faixaPrecoLiquido: principal.nota.faixa,
    memoriaNota: principal.nota.memoria,
    anos: principal.anos,
    sugestoes: principal.sugestoes,
    cenarios,
    comparativoFornecedor: {
      modoAlternativo,
      anos: resumir(alternativo),
    },
    simplificado: simplificadoOuMotivo(e),
    ajusteNota:
      e.natureza === 'SERVICO' || principal.nota.totalRemontado === new D(e.notaCompra).toFixed(2)
        ? null
        : `Nenhum preço do fornecedor fecha a nota em exatamente R$ ${new D(e.notaCompra).toFixed(2)} com essas alíquotas (o arredondamento pula esse centavo). A projeção usa a nota de R$ ${principal.nota.totalRemontado}.`,
    fontes: fontesUsadas(tabela, principal.parametros),
    versaoRegras: tabela.versao,
    versaoMotor: VERSAO_MOTOR,
  };
}

/** Uma linha da simulação em lote: o resumo por ano ou os erros daquela linha. */
export type LinhaLote =
  | {
      readonly linha: number;
      readonly descricao: string;
      readonly ok: true;
      readonly notaCompra: string;
      readonly anos: readonly ResumoAno[];
    }
  | {
      readonly linha: number;
      readonly descricao: string;
      readonly ok: false;
      readonly erros: readonly string[];
    };

/**
 * Simulação em lote: cada linha da planilha ou cada item de XML de NF-e é um produto; o perfil de
 * venda, o cenário e a premissa do fornecedor vêm do formulário.
 */
export function calcularLote(
  linhas: readonly ValoresFormulario[],
  venda: ValoresFormulario,
  tabela: TabelaDeRegras,
): LinhaLote[] {
  if (linhas.length > LIMITE_LOTE) {
    throw new RangeError(`O lote aceita até ${LIMITE_LOTE} linhas por vez.`);
  }
  return linhas.map((bruta, i) => {
    const linha = i + 2;
    const produto = Object.fromEntries(COLUNAS_LOTE.map((c) => [c, bruta[c] ?? '']));
    const descricao = (produto['descricao'] ?? '').trim() || `Linha ${linha}`;
    const leitura = lerEntrada({
      natureza: 'MERCADORIA',
      impostoSimplificado: '0',
      ...venda,
      ...produto,
      temSt: (produto['mva'] ?? '').trim() === '' ? '' : 'on',
    });
    const avisos = (bruta[CAMPO_AVISOS] ?? '').trim();
    if (!leitura.ok || avisos !== '') {
      const erros = leitura.ok
        ? []
        : Object.entries(leitura.erros).map(([c, msg]) => `${ROTULO_CAMPO[c] ?? c}: ${msg}`);
      return {
        linha,
        descricao,
        ok: false,
        erros: avisos === '' ? erros : [...avisos.split(' | '), ...erros],
      };
    }
    try {
      const c = calcularCenario(leitura.entrada, tabela, leitura.entrada.cenario);
      return {
        linha,
        descricao,
        ok: true,
        notaCompra: leitura.entrada.notaCompra,
        anos: resumir(c),
      };
    } catch (e) {
      if (e instanceof RangeError) return { linha, descricao, ok: false, erros: [e.message] };
      throw e;
    }
  });
}
