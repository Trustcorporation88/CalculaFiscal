import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { carregarRegras, Regra, vigentesEm } from '../src/index.js';

const DADOS = fileURLToPath(new URL('../dados', import.meta.url));

describe('tabelas versionadas', () => {
  const regras = carregarRegras(DADOS);

  it('todas as regras passam no schema e têm fonte e status', () => {
    expect(regras.length).toBeGreaterThan(0);
    for (const r of regras) {
      expect(r.fonte.norma.length).toBeGreaterThan(0);
      expect(r.status).toBeDefined();
    }
  });

  it('IS de 2027 não vale em janeiro (efeitos a partir de 02/02/2027)', () => {
    const jan = vigentesEm(regras, '2027-01-15').filter((r) => r.tributo === 'IS');
    const fev = vigentesEm(regras, '2027-02-02').filter((r) => r.tributo === 'IS');
    expect(jan).toHaveLength(0);
    expect(fev.length).toBeGreaterThan(0);
  });

  it('CBS de 2027 aparece como PENDENTE', () => {
    const cbs = vigentesEm(regras, '2027-06-01').find((r) => r.tributo === 'CBS');
    expect(cbs?.status).toBe('PENDENTE');
  });

  it('rejeita regra com vigência invertida', () => {
    const r = Regra.safeParse({
      id: 'x',
      versao: 1,
      tributo: 'IS',
      descricao: 'teste',
      vigencia: { inicio: '2027-12-31', fim: '2027-01-01' },
      abrangencia: {},
      valor: { aliquota: '0.1' },
      fonte: { norma: 'n', artigo: 'a' },
      status: 'PENDENTE',
      conferencia: 'CONFERIR',
    });
    expect(r.success).toBe(false);
  });
});
