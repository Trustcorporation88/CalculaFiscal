import { DESCRICAO_CENARIOS, type Cenario } from '@calculafiscal/regras/cenarios';
import type { Status } from '@calculafiscal/motor-fiscal';
import type { Cell, Row, SheetData } from 'write-excel-file/browser';
import type { LinhaLote, ResultadoCalculadora } from './calcular';
import { CABECALHO_LOTE, COLUNAS_LOTE } from './lote';
import { AVISO_LOTE, avisoTratamento } from './avisos';
import type { EntradaCalculadora } from './entrada';
import { ROTULO_BASE_MARGEM, ROTULO_CAMPO, ROTULO_REGIME } from './rotulos';

/**
 * Monta as planilhas de exportação a partir do resultado do servidor, sem recalcular nada:
 * os números são os mesmos da tela e da memória de cálculo.
 */

export interface Aba {
  readonly sheet: string;
  readonly data: SheetData;
  readonly columns?: { width: number }[];
  readonly stickyRowsCount?: number;
}

const ROTULO_STATUS: Readonly<Record<Status, string>> = {
  EM_VIGOR: 'Em vigor',
  PUBLICADO_EFEITO_FUTURO: 'Publicado, efeito futuro',
  PROPOSTO: 'Proposto',
  PENDENTE: 'Pendente',
  ESTIMATIVA: 'Estimativa',
};

const MOEDA = '#,##0.00';
const PORCENTO = '0.00%';

const titulo = (value: string): Cell => ({ value, fontWeight: 'bold' });
const moeda = (v: string | null): Cell =>
  v === null ? 'pendente' : { value: Number(v), type: Number, format: MOEDA };
const porcento = (v: string | null): Cell =>
  v === null ? 'pendente' : { value: Number(v), type: Number, format: PORCENTO };

const pctTexto = (fracao: string) =>
  `${(Number(fracao) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`;
const reaisTexto = (v: string) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Os dados informados como pares (rótulo, valor), na ordem do formulário. */
export function linhasDaEntrada(e: EntradaCalculadora): [string, string][] {
  const r = (campo: string) => ROTULO_CAMPO[campo] ?? campo;
  const linhas: [string, string][] = [
    [r('descricao'), e.descricao || '(sem descrição)'],
    [r('ncm'), e.ncm ?? '(não informado)'],
    [r('cClassTrib'), e.cClassTrib === '000001' ? '000001 (tributação integral)' : e.cClassTrib],
    [r('cenario'), DESCRICAO_CENARIOS[e.cenario]],
    [r('notaCompra'), reaisTexto(e.notaCompra)],
    [r('aliquotaIcms'), pctTexto(e.aliquotaIcms)],
    [r('aliquotaIpi'), pctTexto(e.aliquotaIpi)],
    [r('aliquotaPisCofins'), pctTexto(e.aliquotaPisCofins)],
    [r('freteEDespesas'), reaisTexto(e.freteEDespesas)],
    [r('temSt'), e.substituicaoTributaria ? 'Sim' : 'Não'],
  ];
  if (e.substituicaoTributaria) {
    linhas.push(
      [r('mva'), pctTexto(e.substituicaoTributaria.mva)],
      [r('aliquotaInterna'), pctTexto(e.substituicaoTributaria.aliquotaInterna)],
    );
  }
  linhas.push([r('regime'), ROTULO_REGIME[e.regime]]);
  if (e.aliquotaDas !== null) {
    linhas.push(
      [r('aliquotaDas'), pctTexto(e.aliquotaDas)],
      [
        r('parcelaCbsIbsNoDas'),
        e.parcelaCbsIbsNoDas === null ? 'pendente (CGSN)' : pctTexto(e.parcelaCbsIbsNoDas),
      ],
    );
  } else {
    linhas.push(
      [r('aliquotaIcmsSaida'), pctTexto(e.aliquotaIcmsSaida)],
      [r('creditaIcmsEntrada'), e.creditaIcmsEntrada ? 'Sim' : 'Não'],
      [r('aliquotaPisCofinsSaida'), pctTexto(e.aliquotaPisCofinsSaida)],
      [r('creditoPisCofinsEntrada'), pctTexto(e.creditoPisCofinsEntrada)],
    );
  }
  linhas.push(
    [r('despesasVariaveis'), pctTexto(e.despesasVariaveis)],
    [r('margem'), pctTexto(e.margem)],
    [r('baseMargem'), ROTULO_BASE_MARGEM[e.baseMargem]],
    [r('impostoSimplificado'), pctTexto(e.impostoSimplificado)],
  );
  return linhas;
}

/** Todas as abas do resultado de um produto. */
export function abasDoResultado(r: ResultadoCalculadora, geradoEm: Date): Aba[] {
  const resumo: SheetData = [
    [titulo(r.entrada.descricao || 'Simulação de preço')],
    ['Gerado em', geradoEm.toLocaleString('pt-BR')],
    ['Tabela de regras', r.versaoRegras],
    ['Motor', r.versaoMotor],
    [],
    [titulo('Dados informados')],
    ...linhasDaEntrada(r.entrada),
    [],
    [titulo('Premissa')],
    [
      `O fornecedor mantém o preço líquido de R$ ${r.precoLiquidoFornecedor} (faixa que fecha a mesma nota: ${r.faixaPrecoLiquido.de} a ${r.faixaPrecoLiquido.ate}).`,
    ],
    ...(r.ajusteNota ? [[r.ajusteNota]] : []),
    [avisoTratamento(r.tratamento)],
    ['Simulação para apoio à decisão; não substitui a análise do contador responsável.'],
  ];

  const cabecalhoAnos: Row = [
    'Ano',
    'Status',
    'Nota de compra',
    'Custo líquido',
    'Preço de venda',
    'Cliente paga',
    'ICMS',
    'PIS/Cofins',
    'DAS',
    'CBS',
    'IBS',
    'Crédito ao cliente',
    'Despesas',
    'Lucro',
    'Margem sobre preço com tributo',
    'Margem sobre receita líquida',
    'Motivo (dado pendente)',
  ].map((c) => titulo(c as string));
  const linhaDoTempo: SheetData = [
    cabecalhoAnos,
    ...r.anos.map((a): Row => {
      if (a.situacao !== 'CALCULADO') {
        return [a.ano, ROTULO_STATUS[a.status], ...Array<Cell>(14).fill(null), a.motivo];
      }
      const v = a.valores;
      return [
        a.ano,
        ROTULO_STATUS[a.status],
        moeda(v.totalNotaCompra),
        moeda(v.custoLiquido),
        moeda(v.preco),
        moeda(v.precoComTributo),
        moeda(v.icms),
        moeda(v.pisCofins),
        moeda(v.das),
        moeda(v.cbs),
        moeda(v.ibs),
        moeda(v.creditoTransferido),
        moeda(v.despesas),
        moeda(v.lucro),
        porcento(v.margemSobrePrecoComTributo),
        porcento(v.margemSobreReceitaLiquida),
        null,
      ];
    }),
  ];

  const psicologico: SheetData = [
    [
      'Ano',
      'Cliente paga (calculado)',
      'Preço sugerido',
      'Lucro no sugerido',
      'Margem sobre preço com tributo',
      'Margem sobre receita líquida',
    ].map(titulo),
    ...r.anos.map((a): Row => {
      const s = r.sugestoes.find((x) => x.ano === a.ano);
      if (a.situacao !== 'CALCULADO' || !s || s.resultado.situacao !== 'CALCULADO') {
        return [a.ano, 'pendente'];
      }
      const v = s.resultado.valores;
      return [
        a.ano,
        moeda(a.valores.precoComTributo),
        moeda(v.precoComTributo),
        moeda(v.lucro),
        porcento(v.margemSobrePrecoComTributo),
        porcento(v.margemSobreReceitaLiquida),
      ];
    }),
  ];

  const anosCenarios = r.cenarios[0]?.anos.map((a) => a.ano) ?? [];
  const cenarios: SheetData = [
    [titulo('Ano'), ...r.cenarios.map((c) => titulo(DESCRICAO_CENARIOS[c.cenario]))],
    ...anosCenarios.map((ano): Row => [
      ano,
      ...r.cenarios.map((c) => moeda(c.anos.find((a) => a.ano === ano)?.precoComTributo ?? null)),
    ]),
    [],
    ['Valores: o que o cliente paga, mantendo a mesma margem.'],
  ];

  const memoria: SheetData = [
    ['Ano', 'Passo', 'Descrição', 'Fórmula', 'Entradas', 'Resultado', 'Regras'].map(titulo),
    [
      2026,
      r.memoriaNota.id,
      r.memoriaNota.descricao,
      r.memoriaNota.formula,
      entradasTexto(r.memoriaNota.entradas),
      r.memoriaNota.resultado,
      r.memoriaNota.regras.join(', '),
    ],
    ...r.anos.flatMap((a) =>
      a.memoria.map((m): Row => [
        a.ano,
        m.id,
        m.descricao,
        m.formula,
        entradasTexto(m.entradas),
        m.resultado,
        m.regras.join(', '),
      ]),
    ),
  ];

  const fontes: SheetData = [
    [
      'Regra',
      'Descrição',
      'Tributo',
      'Valor',
      'Vigência',
      'Norma',
      'Artigo',
      'Status',
      'Conferência',
      'Observação',
    ].map(titulo),
    ...r.fontes.map((f): Row => [
      f.chave,
      f.descricao,
      f.tributo,
      f.aliquota,
      f.vigencia,
      f.norma,
      f.artigo,
      ROTULO_STATUS[f.status],
      f.conferencia === 'CONFERIR' ? 'a conferir' : 'conferida',
      f.observacao ?? '',
    ]),
  ];

  const largas = (n: number, w = 16) => Array.from({ length: n }, () => ({ width: w }));
  return [
    { sheet: 'Resumo', data: resumo, columns: [{ width: 40 }, { width: 60 }] },
    { sheet: 'Linha do tempo', data: linhaDoTempo, columns: largas(17), stickyRowsCount: 1 },
    { sheet: 'Preço psicológico', data: psicologico, columns: largas(6, 20), stickyRowsCount: 1 },
    { sheet: 'Cenários', data: cenarios, columns: largas(5, 30), stickyRowsCount: 1 },
    {
      sheet: 'Memória de cálculo',
      data: memoria,
      columns: [8, 26, 40, 60, 60, 14, 40].map((width) => ({ width })),
      stickyRowsCount: 1,
    },
    {
      sheet: 'Fontes',
      data: fontes,
      columns: [28, 40, 10, 10, 26, 30, 30, 22, 12, 60].map((width) => ({ width })),
      stickyRowsCount: 1,
    },
  ];
}

const entradasTexto = (e: Readonly<Record<string, string>>) =>
  Object.entries(e)
    .map(([k, v]) => `${k} = ${v}`)
    .join('; ');

/** Modelo para preencher: percentuais como números inteiros (18 = 18%), células em texto. */
export function abasDoModeloLote(): Aba[] {
  const texto = (value: string): Cell => ({ value, type: String, format: '@' });
  const exemplos = [
    ['Coca-Cola 600 ml', '2202.10.00', '000001', '4,89', '18', '2,6', '13', '42', '18', '0'],
    ['Arroz 5 kg (cesta básica)', '1006.30.21', '200003', '22,50', '7', '0', '0', '', '', '0'],
  ];
  return [
    {
      sheet: 'Produtos',
      data: [
        COLUNAS_LOTE.map((c) => titulo(CABECALHO_LOTE[c])),
        ...exemplos.map((linha) => linha.map(texto)),
      ],
      columns: COLUNAS_LOTE.map(() => ({ width: 24 })),
      stickyRowsCount: 1,
    },
    {
      sheet: 'Como preencher',
      data: [
        [titulo('Uma linha por produto. Valores da nota de compra de hoje (2026), por unidade.')],
        ['Percentuais em número: 18 para 18%, 2,6 para 2,6%. Não formate a célula como %.'],
        ['MVA vazia = compra sem ICMS-ST. NCM é opcional, mas necessário para o Imposto Seletivo.'],
        [
          'cClassTrib: tratamento de CBS e IBS (ex.: 200003 cesta básica, 200034 alimentos do Anexo VII). Vazio = tributação integral.',
        ],
        ['Regime, despesas, margem e cenário são escolhidos na tela, iguais para todo o lote.'],
        [`Até 500 produtos por arquivo. As linhas de exemplo podem ser apagadas.`],
      ],
      columns: [{ width: 100 }],
    },
  ];
}

/** Resultado do lote: uma linha por produto, com o que o cliente paga em cada ano. */
export function abasDoLote(
  linhas: readonly LinhaLote[],
  cenario: Cenario,
  versaoRegras: string,
): Aba[] {
  const anos = linhas.find((l) => l.ok)?.ok
    ? (linhas.find((l) => l.ok) as Extract<LinhaLote, { ok: true }>).anos.map((a) => a.ano)
    : [];
  const dados: SheetData = [
    [
      'Linha',
      'Produto',
      'Nota de compra',
      ...anos.flatMap((a) => [`${a}: cliente paga`, `${a}: preço sugerido`, `${a}: status`]),
      'Erros',
    ].map(titulo),
    ...linhas.map((l): Row => {
      if (!l.ok) {
        return [
          l.linha,
          l.descricao,
          null,
          ...anos.flatMap(() => [null, null, null]),
          l.erros.join(' | '),
        ];
      }
      return [
        l.linha,
        l.descricao,
        moeda(l.notaCompra),
        ...l.anos.flatMap((a) => [
          moeda(a.precoComTributo),
          moeda(a.sugerido),
          ROTULO_STATUS[a.status],
        ]),
        null,
      ];
    }),
  ];
  return [
    {
      sheet: 'Lote',
      data: dados,
      columns: [
        { width: 8 },
        { width: 36 },
        { width: 14 },
        ...anos.flatMap(() => [{ width: 16 }, { width: 16 }, { width: 22 }]),
        { width: 60 },
      ],
      stickyRowsCount: 1,
    },
    {
      sheet: 'Premissas',
      data: [
        ['Cenário', DESCRICAO_CENARIOS[cenario]],
        ['Tabela de regras', versaoRegras],
        ['Premissa', 'O fornecedor mantém o preço líquido calculado a partir da nota de 2026.'],
        ['Tratamento', AVISO_LOTE],
        [
          'Aviso',
          'Simulação para apoio à decisão; não substitui a análise do contador responsável.',
        ],
      ],
      columns: [{ width: 20 }, { width: 90 }],
    },
  ];
}
