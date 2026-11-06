import { tabelaOficial } from '@calculafiscal/regras';
import { describe, expect, it } from 'vitest';
import { avisoTratamento, rotuloReducao } from '../src/lib/calculadora/avisos';
import { calcularLinhaDoTempo, calcularLote } from '../src/lib/calculadora/calcular';
import { lerEntrada, type ValoresFormulario } from '../src/lib/calculadora/entrada';
import { linhasDaTabela } from '../src/lib/calculadora/lote';
import { abasDoModeloLote, linhasDaEntrada } from '../src/lib/calculadora/planilha';

const tabela = tabelaOficial();

/** Arroz comprado de um beneficiador, revendido por distribuidora no Lucro Real. */
const ARROZ: ValoresFormulario = {
  descricao: 'Arroz 5 kg',
  ncm: '1006.30.21',
  cenario: 'base',
  notaCompra: '22,50',
  aliquotaIcms: '7',
  aliquotaIpi: '0',
  aliquotaPisCofins: '0',
  freteEDespesas: '0',
  regime: 'REAL',
  aliquotaIcmsSaida: '7',
  creditaIcmsEntrada: 'on',
  aliquotaPisCofinsSaida: '0',
  creditoPisCofinsEntrada: '0',
  despesasVariaveis: '6',
  margem: '25',
  baseMargem: 'PRECO_COM_TRIBUTO',
  impostoSimplificado: '26,5',
};

function entrada(v: ValoresFormulario) {
  const r = lerEntrada(v);
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.entrada;
}

describe('tratamento de CBS e IBS (cClassTrib) na calculadora', () => {
  it('sem tratamento: tributação integral e aviso pedindo o cClassTrib', () => {
    const r = calcularLinhaDoTempo(entrada(ARROZ), tabela);
    expect(r.entrada.cClassTrib).toBe('000001');
    expect(r.tratamento).toBeNull();
    expect(avisoTratamento(r.tratamento)).toMatch(/Tributação integral/);
    const a2033 = r.anos.find((a) => a.ano === 2033);
    expect(a2033?.situacao === 'CALCULADO' && Number(a2033.valores.cbs)).toBeGreaterThan(0);
  });

  it('cesta básica (200003): sem CBS e IBS de 2027 em diante, e o preço cai', () => {
    const integral = calcularLinhaDoTempo(entrada(ARROZ), tabela);
    const cesta = calcularLinhaDoTempo(entrada({ ...ARROZ, cClassTrib: '200003' }), tabela);
    expect(cesta.tratamento).toMatchObject({ codigo: '200003', reducao: '1' });
    expect(avisoTratamento(cesta.tratamento)).toMatch(/alíquota zero/);
    for (const ano of [2027, 2030, 2033]) {
      const c = cesta.anos.find((a) => a.ano === ano);
      const i = integral.anos.find((a) => a.ano === ano);
      if (c?.situacao !== 'CALCULADO' || i?.situacao !== 'CALCULADO') throw new Error('ano');
      expect(c.valores.cbs).toBe('0.00');
      expect(c.valores.ibs).toBe('0.00');
      expect(Number(c.valores.precoComTributo)).toBeLessThan(Number(i.valores.precoComTributo));
      expect(c.memoria.some((m) => m.regras.includes('reducao.cclasstrib-200003@1'))).toBe(true);
    }
    expect(cesta.fontes.some((f) => f.tributo === 'REDUCAO_CBS_IBS')).toBe(true);
    // Em 2026 (ano de teste) nada muda.
    expect(cesta.anos[0]).toEqual(integral.anos[0]);
    expect(linhasDaEntrada(cesta.entrada)).toContainEqual([
      'Tratamento de CBS e IBS (cClassTrib)',
      '200003',
    ]);
  });

  it('alimentos do Anexo VII (200034): 40% da CBS e do IBS', () => {
    const r = calcularLinhaDoTempo(entrada({ ...ARROZ, cClassTrib: '200034' }), tabela);
    expect(rotuloReducao(r.tratamento?.reducao ?? '0')).toBe('redução de 60%');
    const a = r.anos.find((x) => x.ano === 2033);
    expect(a?.situacao === 'CALCULADO' && Number(a.valores.cbs)).toBeGreaterThan(0);
  });

  it('cClassTrib inválido ou fora da tabela é recusado', () => {
    const r = lerEntrada({ ...ARROZ, cClassTrib: '2000' });
    expect(!r.ok && r.erros['cClassTrib']).toMatch(/6 dígitos/);
    expect(() => calcularLinhaDoTempo(entrada({ ...ARROZ, cClassTrib: '200005' }), tabela)).toThrow(
      /tabela de reduções/,
    );
  });
});

describe('tratamento no lote', () => {
  it('o modelo traz a coluna cClassTrib e o exemplo do arroz na cesta básica', () => {
    const [produtos] = abasDoModeloLote();
    const lida = linhasDaTabela(
      (produtos?.data ?? []).map((linha) =>
        linha.map((c) => (c && typeof c === 'object' && 'value' in c ? String(c.value) : null)),
      ),
    );
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    expect(lida.linhas.map((l) => l['cClassTrib'])).toEqual(['000001', '200003']);

    const venda: ValoresFormulario = {
      cenario: 'base',
      regime: 'REAL',
      aliquotaIcmsSaida: '0',
      aliquotaPisCofinsSaida: '0',
      creditoPisCofinsEntrada: '0',
      despesasVariaveis: '6',
      margem: '25',
      baseMargem: 'PRECO_COM_TRIBUTO',
    };
    const [, arroz] = calcularLote(lida.linhas, venda, tabela);
    expect(arroz?.ok).toBe(true);
    const errado = calcularLote([{ ...lida.linhas[1], cClassTrib: '999999' }], venda, tabela);
    expect(!errado[0]?.ok && errado[0]?.erros[0]).toMatch(/tabela de reduções/);
  });
});
