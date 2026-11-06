import { tabelaOficial } from '@calculafiscal/regras';
import { describe, expect, it } from 'vitest';
import { calcularLinhaDoTempo } from '../src/lib/calculadora/calcular';
import {
  lerEntrada,
  numeroBrasileiro,
  type ValoresFormulario,
} from '../src/lib/calculadora/entrada';
import { EXEMPLO_COCA, FORMULARIO_VAZIO } from '../src/lib/calculadora/exemplos';

function entrada(v: ValoresFormulario) {
  const r = lerEntrada(v);
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.entrada;
}

describe('leitura do formulário', () => {
  it('aceita número no formato brasileiro', () => {
    expect(numeroBrasileiro('1.234,56')).toBe('1234.56');
    expect(numeroBrasileiro('R$ 4,89')).toBe('4.89');
    expect(numeroBrasileiro('18%')).toBe('18');
    expect(numeroBrasileiro('4.89')).toBe('4.89');
    expect(numeroBrasileiro('abc')).toBeNull();
    expect(numeroBrasileiro('-1')).toBeNull();
  });

  it('converte percentuais em fração e ignora campos do outro regime', () => {
    const e = entrada(EXEMPLO_COCA);
    expect(e.aliquotaIcms).toBe('0.18');
    expect(e.aliquotaIpi).toBe('0.026');
    expect(e.substituicaoTributaria).toEqual({ mva: '0.42', aliquotaInterna: '0.18' });
    expect(e.aliquotaDas).toBe('0.08');
    expect(e.parcelaCbsIbsNoDas).toBeNull();
    expect(e.aliquotaIcmsSaida).toBe('0');
  });

  it('não completa campo obrigatório vazio com valor razoável', () => {
    const r = lerEntrada(FORMULARIO_VAZIO);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros['notaCompra']).toBeDefined();
      expect(r.erros['aliquotaDas']).toBeDefined();
      expect(r.erros['margem']).toBeDefined();
    }
  });

  it('rejeita valores inválidos com mensagem por campo', () => {
    const r = lerEntrada({
      ...EXEMPLO_COCA,
      notaCompra: '0',
      margem: '120',
      ncm: '22',
      aliquotaIcms: 'dezoito',
      regime: 'MEI',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.erros)).toEqual(
        expect.arrayContaining(['aliquotaIcms', 'margem', 'ncm', 'notaCompra', 'regime']),
      );
      expect(r.erros['margem']).toMatch(/100%/);
    }
  });

  it('MVA pode passar de 100%', () => {
    expect(entrada({ ...EXEMPLO_COCA, mva: '140' }).substituicaoTributaria?.mva).toBe('1.4');
  });

  it('regime regular lê ICMS, PIS/Cofins e créditos da saída', () => {
    const e = entrada({
      ...EXEMPLO_COCA,
      regime: 'PRESUMIDO',
      aliquotaIcmsSaida: '18',
      creditaIcmsEntrada: 'on',
      aliquotaPisCofinsSaida: '3,65',
      creditoPisCofinsEntrada: '0',
    });
    expect(e.aliquotaDas).toBeNull();
    expect(e.creditaIcmsEntrada).toBe(true);
    expect(e.aliquotaPisCofinsSaida).toBe('0.0365');
  });
});

describe('linha do tempo com as tabelas oficiais', () => {
  const r = calcularLinhaDoTempo(entrada(EXEMPLO_COCA), tabelaOficial());

  it('caso Coca-Cola no Simples: R$ 8,02 em 2026, abaixo do cálculo simplificado de R$ 11,51', () => {
    expect(r.anos).toHaveLength(8);
    const [a2026] = r.anos;
    expect(a2026?.situacao).toBe('CALCULADO');
    if (a2026?.situacao === 'CALCULADO') expect(a2026.valores.precoComTributo).toBe('8.02');
    expect(r.simplificado.ok && r.simplificado.resultado.preco).toBe('11.51');
    expect(r.ajusteNota).toBeNull();
    for (const ano of r.anos) {
      if (ano.situacao === 'CALCULADO')
        expect(Number(ano.valores.precoComTributo)).toBeLessThan(11.51);
    }
  });

  it('mostra as fontes usadas, com status e versão das tabelas', () => {
    expect(r.fontes.some((f) => f.tributo === 'IS')).toBe(true);
    expect(r.fontes.every((f) => f.norma.length > 0)).toBe(true);
    expect(r.versaoRegras).toMatch(/^[0-9a-f]{12}$/);
    expect(r.memoriaNota.entradas['totalRemontado']).toBe('4.89');
  });

  it('comparativo impossível não derruba a linha do tempo', () => {
    const c = calcularLinhaDoTempo(entrada({ ...EXEMPLO_COCA, margem: '70' }), tabelaOficial());
    expect(c.simplificado).toMatchObject({ ok: false });
    expect(c.anos[0]?.situacao).toBe('CALCULADO');
  });

  it('nota abaixo do mínimo possível é recusada, não projetada com outro custo', () => {
    expect(() =>
      calcularLinhaDoTempo(
        entrada({ ...EXEMPLO_COCA, notaCompra: '0,50', freteEDespesas: '1' }),
        tabelaOficial(),
      ),
    ).toThrow(/menor nota possível/);
  });

  it('valor gigante é recusado na leitura', () => {
    const r = lerEntrada({ ...EXEMPLO_COCA, notaCompra: '1' + '0'.repeat(40) });
    expect(!r.ok && r.erros['notaCompra']).toBe('Valor grande demais.');
  });

  it('Simples regular sem a partilha do DAS devolve dado pendente, não um número', () => {
    const s = calcularLinhaDoTempo(
      entrada({ ...EXEMPLO_COCA, regime: 'SIMPLES_REGULAR' }),
      tabelaOficial(),
    );
    expect(s.anos.find((a) => a.ano === 2027)?.situacao).toBe('DADO_PENDENTE');
  });
});
