import { PACOTE_ASSINADO } from '@calculafiscal/regras/assinado';
import { describe, expect, it } from 'vitest';
import {
  dataCurta,
  diasSemConferir,
  estadoInicial,
  procurarAtualizacao,
  SITE,
  tabelaEmbutida,
} from '../src/tabelas';

/** Site falso: responde por URL; `null` simula falta de conexão. */
function site(respostas: Record<string, unknown>) {
  const pedidos: string[] = [];
  const buscar = (url: string) => {
    pedidos.push(url);
    const corpo = respostas[url];
    if (corpo === null || corpo === undefined) return Promise.reject(new Error('offline'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(corpo) });
  };
  return { buscar, pedidos };
}

const VERSAO = `${SITE}/v1/regras/versao`;
const PACOTE = `${SITE}/v1/regras/pacote`;
const AGORA = () => new Date('2026-11-07T12:00:00Z');
/** Uma tabela mais antiga que a do site, como num celular que não atualiza há tempos. */
const antiga = { ...tabelaEmbutida(), versao: '000000000000', publicadoEm: '2026-01-01T00:00:00Z' };

describe('tabelas do app', () => {
  it('sem nada guardado usa a tabela embutida', () => {
    const e = estadoInicial(null);
    expect(e.origem).toBe('embutida');
    expect(e.tabela.versao).toBe(PACOTE_ASSINADO.versao);
    expect(e.verificadoEm).toBeNull();
  });

  it('ignora o pacote guardado quando não é mais novo que o embutido ou não confere', () => {
    expect(estadoInicial({ pacote: PACOTE_ASSINADO, verificadoEm: null }).origem).toBe('embutida');
    const adulterado = {
      ...PACOTE_ASSINADO,
      conteudo: PACOTE_ASSINADO.conteudo.replace('0.009', '0.001'),
    };
    expect(estadoInicial({ pacote: adulterado, verificadoEm: null }).origem).toBe('embutida');
  });

  it('não baixa o pacote quando a versão do site é a mesma', async () => {
    const s = site({ [VERSAO]: { versao: PACOTE_ASSINADO.versao } });
    const r = await procurarAtualizacao(tabelaEmbutida(), s.buscar, AGORA);
    expect(r).toEqual({ tipo: 'em-dia', verificadoEm: '2026-11-07T12:00:00.000Z' });
    expect(s.pedidos).toEqual([VERSAO]);
  });

  it('baixa, confere a assinatura e adota a tabela nova', async () => {
    const s = site({ [VERSAO]: { versao: PACOTE_ASSINADO.versao }, [PACOTE]: PACOTE_ASSINADO });
    const r = await procurarAtualizacao(antiga, s.buscar, AGORA);
    expect(r.tipo).toBe('atualizada');
    if (r.tipo === 'atualizada') {
      expect(r.tabela.versao).toBe(PACOTE_ASSINADO.versao);
      expect(r.tabela.regras.length).toBeGreaterThan(10);
    }
  });

  it('recusa pacote adulterado e pacote mais antigo que o do celular', async () => {
    const adulterado = {
      ...PACOTE_ASSINADO,
      conteudo: PACOTE_ASSINADO.conteudo.replace('0.009', '0.001'),
    };
    const s1 = site({ [VERSAO]: { versao: 'x' }, [PACOTE]: adulterado });
    expect(await procurarAtualizacao(antiga, s1.buscar, AGORA)).toEqual({
      tipo: 'recusada',
      motivo: 'Assinatura não confere.',
    });
    const futura = { ...antiga, publicadoEm: '2099-01-01T00:00:00Z' };
    const s2 = site({ [VERSAO]: { versao: 'x' }, [PACOTE]: PACOTE_ASSINADO });
    expect(await procurarAtualizacao(futura, s2.buscar, AGORA)).toMatchObject({ tipo: 'recusada' });
  });

  it('sem internet continua com a tabela que tem', async () => {
    const s = site({});
    expect(await procurarAtualizacao(antiga, s.buscar, AGORA)).toEqual({ tipo: 'sem-conexao' });
  });

  it('conta os dias sem conferir para o aviso de 30 dias', () => {
    const base = { tabela: antiga, origem: 'embutida' as const };
    expect(diasSemConferir({ ...base, verificadoEm: '2026-11-01T12:00:00Z' }, AGORA())).toBe(6);
    expect(diasSemConferir({ ...base, verificadoEm: null }, AGORA())).toBe(310);
    expect(dataCurta('2026-11-07T02:00:00Z')).toBe('06/11/2026');
  });
});
