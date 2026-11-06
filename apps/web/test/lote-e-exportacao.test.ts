import { tabelaOficial } from '@calculafiscal/regras';
import { describe, expect, it } from 'vitest';
import { calcularLinhaDoTempo, calcularLote } from '../src/lib/calculadora/calcular';
import { lerEntrada, type ValoresFormulario } from '../src/lib/calculadora/entrada';
import { EXEMPLO_COCA } from '../src/lib/calculadora/exemplos';
import { CAMPO_AVISOS, LIMITE_LOTE, lerCsv, linhasDaTabela } from '../src/lib/calculadora/lote';
import {
  abasDoLote,
  abasDoModeloLote,
  abasDoResultado,
  linhasDaEntrada,
} from '../src/lib/calculadora/planilha';

function entrada(v: ValoresFormulario) {
  const r = lerEntrada(v);
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.entrada;
}

const tabela = tabelaOficial();
const resultado = calcularLinhaDoTempo(entrada(EXEMPLO_COCA), tabela);

describe('preço psicológico e cenários no resultado', () => {
  it('sugere preço com final comercial, nunca abaixo do calculado', () => {
    expect(resultado.sugestoes).toHaveLength(8);
    const s2026 = resultado.sugestoes.find((s) => s.ano === 2026);
    expect(s2026?.sugerido).toBe('8.49');
    for (const s of resultado.sugestoes) {
      const a = resultado.anos.find((x) => x.ano === s.ano);
      if (a?.situacao === 'CALCULADO' && s.resultado.situacao === 'CALCULADO') {
        expect(Number(s.sugerido)).toBeGreaterThanOrEqual(Number(a.valores.precoComTributo));
        expect(Number(s.resultado.valores.margemSobrePrecoComTributo)).toBeGreaterThanOrEqual(
          Number(a.valores.margemSobrePrecoComTributo),
        );
      }
    }
  });

  it('compara os quatro cenários e o escolhido bate com a linha do tempo', () => {
    expect(resultado.cenarios.map((c) => c.cenario)).toEqual([
      'base',
      'ibs-baixo',
      'ibs-alto',
      'mp-caducada',
    ]);
    const base = resultado.cenarios.find((c) => c.cenario === 'base');
    resultado.anos.forEach((a, i) => {
      if (a.situacao === 'CALCULADO') {
        expect(base?.anos[i]?.precoComTributo).toBe(a.valores.precoComTributo);
      }
    });
    // Sem IS (MP caducada), 2027 fica mais barato que no cenário base.
    const semIs = resultado.cenarios.find((c) => c.cenario === 'mp-caducada');
    expect(Number(semIs?.anos[1]?.precoComTributo)).toBeLessThan(
      Number(base?.anos[1]?.precoComTributo),
    );
    // Até 2028 o IBS ainda é o de teste: os cenários de IBS só divergem de 2029 em diante.
    const alto = resultado.cenarios.find((c) => c.cenario === 'ibs-alto');
    expect(alto?.anos[1]?.precoComTributo).toBe(base?.anos[1]?.precoComTributo);
  });
});

describe('exportação para Excel', () => {
  it('monta as abas com os mesmos números do resultado', () => {
    const abas = abasDoResultado(resultado, new Date('2026-11-06T12:00:00Z'));
    expect(abas.map((a) => a.sheet)).toEqual([
      'Resumo',
      'Linha do tempo',
      'Preço psicológico',
      'Cenários',
      'Memória de cálculo',
      'Fontes',
    ]);
    const linhaDoTempo = abas[1]?.data ?? [];
    expect(linhaDoTempo).toHaveLength(9);
    expect(linhaDoTempo[1]?.[5]).toMatchObject({ value: 8.02, format: '#,##0.00' });
    const memoria = abas[4]?.data ?? [];
    expect(memoria.length).toBeGreaterThan(8);
    expect(abas[5]?.data.length).toBe(resultado.fontes.length + 1);
  });

  it('lista os dados informados do Simples e do regime regular', () => {
    const simples = linhasDaEntrada(resultado.entrada);
    expect(simples).toContainEqual(['Alíquota efetiva do DAS (%)', '8%']);
    expect(simples).toContainEqual(['Parte do DAS que é CBS e IBS (%)', 'pendente (CGSN)']);
    const real = linhasDaEntrada(
      entrada({
        ...EXEMPLO_COCA,
        regime: 'REAL',
        aliquotaIcmsSaida: '0',
        aliquotaPisCofinsSaida: '0',
        creditoPisCofinsEntrada: '0',
        temSt: '',
      }),
    );
    expect(real).toContainEqual(['Aproveita o crédito do ICMS da compra', 'Não']);
    expect(real.some(([r]) => r.startsWith('MVA'))).toBe(false);
  });

  it('modelo do lote tem cabeçalho e linha de exemplo em texto', () => {
    const [produtos] = abasDoModeloLote();
    expect(produtos?.data[0]).toHaveLength(9);
    expect(produtos?.data[1]?.[2]).toMatchObject({ value: '4,89', format: '@' });
  });
});

describe('leitura da planilha do lote', () => {
  const cabecalho = [
    'Descrição',
    'NCM',
    'Total da nota (R$)',
    'ICMS do fornecedor (%)',
    'IPI (%)',
    'PIS e Cofins do fornecedor (%)',
    'MVA (%), vazio se não houver ST',
    'Alíquota interna ICMS-ST (%)',
    'Frete e despesas (R$)',
  ];

  it('reconhece o cabeçalho do modelo e apelidos, e ignora linhas vazias', () => {
    const r = linhasDaTabela([
      ['Produto', 'Nota', 'ICMS', 'IPI', 'PIS/Cofins', 'Outra coluna'],
      ['Água', 2.5, 18, 0, '9,25', 'x'],
      [null, null, null, null, null, null],
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.linhas).toHaveLength(1);
      expect(r.linhas[0]).toMatchObject({
        descricao: 'Água',
        notaCompra: '2.5',
        aliquotaIcms: '18',
        aliquotaPisCofins: '9,25',
      });
    }
  });

  it('avisa quando o percentual veio formatado como % no Excel', () => {
    const r = linhasDaTabela([cabecalho, ['Coca', '2202.10.00', 4.89, 0.18, 2.6, 13, '', '', 0]]);
    expect(r.ok && r.linhas[0]?.[CAMPO_AVISOS]).toMatch(/ICMS do fornecedor.*18%/);
  });

  it('recusa planilha sem colunas obrigatórias, vazia ou acima do limite', () => {
    expect(linhasDaTabela([['Descrição', 'NCM']])).toMatchObject({ ok: false });
    expect(linhasDaTabela([])).toMatchObject({ ok: false, erro: 'A planilha está vazia.' });
    expect(linhasDaTabela([cabecalho])).toMatchObject({ ok: false });
    const muitas = Array.from({ length: LIMITE_LOTE + 1 }, () => ['x', '', '1', '0', '0', '0']);
    expect(linhasDaTabela([cabecalho, ...muitas])).toMatchObject({ ok: false });
  });

  it('lê CSV com ponto e vírgula, aspas e quebra de linha do Windows', () => {
    const csv = '﻿Descrição;Total da nota (R$)\r\n"Refri ""zero"";lata";4,89\r\nÁgua;2,50';
    expect(lerCsv(csv)).toEqual([
      ['Descrição', 'Total da nota (R$)'],
      ['Refri "zero";lata', '4,89'],
      ['Água', '2,50'],
    ]);
    expect(lerCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('cálculo do lote', () => {
  const venda: ValoresFormulario = {
    cenario: 'base',
    regime: 'SIMPLES_DAS',
    aliquotaDas: '8',
    despesasVariaveis: '6',
    margem: '25',
    baseMargem: 'PRECO_COM_TRIBUTO',
    // Sem impostoSimplificado, como no formulário do lote.
  };

  it('calcula cada produto e devolve os erros por linha sem parar o lote', () => {
    const linhas = calcularLote(
      [
        {
          descricao: 'Coca-Cola 600 ml',
          ncm: '2202.10.00',
          notaCompra: '4,89',
          aliquotaIcms: '18',
          aliquotaIpi: '2,6',
          aliquotaPisCofins: '13',
          mva: '42',
          aliquotaInterna: '18',
          freteEDespesas: '0',
        },
        {
          descricao: '',
          notaCompra: 'abc',
          aliquotaIcms: '18',
          aliquotaIpi: '0',
          aliquotaPisCofins: '0',
        },
        {
          descricao: 'Formatado',
          notaCompra: '4,89',
          aliquotaIcms: '0.18',
          aliquotaIpi: '0',
          aliquotaPisCofins: '0',
          [CAMPO_AVISOS]: 'ICMS do fornecedor (%) veio como 0,18',
        },
        {
          descricao: 'Impossível',
          notaCompra: '1',
          aliquotaIcms: '90',
          aliquotaIpi: '0',
          aliquotaPisCofins: '20',
        },
      ],
      venda,
      tabela,
    );
    const [coca, invalida, formatada, impossivel] = linhas;
    expect(coca?.ok && coca.anos[0]?.precoComTributo).toBe('8.02');
    expect(coca?.ok && coca.anos[0]?.sugerido).toBe('8.49');
    expect(invalida).toMatchObject({ ok: false, linha: 3, descricao: 'Linha 3' });
    expect(!invalida?.ok && invalida?.erros[0]).toMatch(/^Total da nota/);
    expect(!formatada?.ok && formatada?.erros[0]).toMatch(/0,18/);
    expect(!impossivel?.ok && impossivel?.erros[0]).toMatch(/100%/);

    const [aba] = abasDoLote(linhas, 'base', tabela.versao);
    expect(aba?.data).toHaveLength(5);
    expect(aba?.data[0]).toHaveLength(3 + 8 * 3 + 1);
  });

  it('recusa lote acima do limite', () => {
    expect(() =>
      calcularLote(
        Array.from({ length: LIMITE_LOTE + 1 }, () => ({})),
        venda,
        tabela,
      ),
    ).toThrow(RangeError);
  });

  it('planilha do lote sem nenhum produto válido ainda é gerada', () => {
    const [aba] = abasDoLote(
      [{ linha: 2, descricao: 'x', ok: false, erros: ['erro'] }],
      'base',
      tabela.versao,
    );
    expect(aba?.data[1]).toEqual([2, 'x', null, 'erro']);
  });
});
