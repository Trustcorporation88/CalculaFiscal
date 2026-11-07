import { describe, expect, it } from 'vitest';
import { dasEfetivoComercio } from '../src/referencias';

describe('DAS efetivo do comércio (LC 123, Anexo I)', () => {
  it('calcula a alíquota efetiva em cada faixa', () => {
    expect(dasEfetivoComercio('150.000')).toMatchObject({ ok: true, percentual: '4,00', faixa: 1 });
    // (360.000 × 7,3% − 5.940) ÷ 360.000 = 5,65%
    expect(dasEfetivoComercio('360000')).toMatchObject({ percentual: '5,65', faixa: 2 });
    // (720.000 × 9,5% − 13.860) ÷ 720.000 = 7,575% → 7,58%
    expect(dasEfetivoComercio('720.000,00')).toMatchObject({ percentual: '7,58', faixa: 3 });
    // (1.800.000 × 10,7% − 22.500) ÷ 1.800.000 = 9,45%
    expect(dasEfetivoComercio('1800000')).toMatchObject({ percentual: '9,45', faixa: 4 });
  });

  it('avisa que o ICMS sai do DAS acima de R$ 3,6 milhões', () => {
    const r = dasEfetivoComercio('4000000');
    // (4.000.000 × 19% − 378.000) ÷ 4.000.000 = 9,55%
    expect(r).toMatchObject({ ok: true, percentual: '9,55', faixa: 6 });
    expect(r.ok && r.aviso).toMatch(/ICMS sai do DAS/);
  });

  it('recusa faturamento vazio e acima do limite do Simples', () => {
    expect(dasEfetivoComercio('')).toMatchObject({ ok: false });
    expect(dasEfetivoComercio('5.000.000')).toMatchObject({ ok: false });
  });
});
