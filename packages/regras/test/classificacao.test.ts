import { describe, expect, it } from 'vitest';
import {
  atividadesSimplesNacional,
  avaliarVinculosContraAnexo,
  classificarPorNbs,
  classificarPorNcm,
  criticarNbsNoAnexo,
  criticarNcmNoAnexo,
  derivarAnexosAtividadeSimples,
  enquadrarImpostoSeletivo,
  fatorTransicaoCompraGovSimples,
  formatarNbs,
  formatarNcm,
  tiposReceitaBrutaSimples,
} from '../src/classificacao.js';

describe('formatação e validação de NCM e NBS', () => {
  it('formata códigos válidos e rejeita tamanhos inválidos', () => {
    expect(formatarNcm('10063021')).toBe('1006.30.21');
    expect(formatarNcm('1006.30.21')).toBe('1006.30.21');
    expect(() => formatarNcm('1006')).toThrow(/8 dígitos/);

    expect(formatarNbs('122011200')).toBe('1.2201.12.00');
    expect(formatarNbs('1.2201.12.00')).toBe('1.2201.12.00');
    expect(() => formatarNbs('12201')).toThrow(/9 dígitos/);
  });
});

describe('tabela-verdade oficial da Receita Federal (NcmAplicavelService)', () => {
  it('rejeita quando não consta, rejeita exceção sem vínculo livre e aceita quando outro vínculo livre cobre', () => {
    // 0 0 0: não consta
    expect(avaliarVinculosContraAnexo('99999999', [{ codigo: '03061' }])).toEqual({
      aceito: false,
      excecaoAplicada: null,
    });
    // 1 1 0: coberto pelo prefixo, mas cai na exceção (ex.: lagostas 0306.11 no Anexo VII)
    expect(
      avaliarVinculosContraAnexo('03061110', [{ codigo: '03061', excecoes: ['030611'] }]),
    ).toEqual({
      aceito: false,
      excecaoAplicada: '030611',
    });
    // 1 0 0: coberto pelo prefixo e fora da exceção (ex.: camarões 0306.17 no Anexo VII)
    expect(
      avaliarVinculosContraAnexo('03061710', [
        { codigo: '03061', excecoes: ['030611'], item: '2', descricaoItem: 'Crustáceos' },
      ]),
    ).toMatchObject({ aceito: true });
    // 1 1 1: vínculo com exceção + outro vínculo livre cobrindo o NCM -> aceita
    expect(
      avaliarVinculosContraAnexo('03061110', [
        { codigo: '03061', excecoes: ['030611'] },
        { codigo: '03061110', item: '99', descricaoItem: 'Específico' },
      ]),
    ).toEqual({
      aceito: true,
      itens: [{ prefixo: '03061110', numero: '99', descricao: 'Específico' }],
    });
  });

  it('aplica as exceções reais do Anexo VII (200034) como na calculadora oficial', () => {
    expect(criticarNcmNoAnexo('0306.11.10', '200034')).toMatchObject({
      situacao: 'NAO_VINCULADO',
      anexo: 'VII',
      excecaoAplicada: '030611',
    });
    expect(criticarNcmNoAnexo('0306.17.10', '200034')).toMatchObject({
      situacao: 'VINCULADO',
      anexo: 'VII',
    });
  });
});

describe('classificação e crítica por NCM e NBS', () => {
  it('dentifrício (3306.10.00) e arroz (1006.30.21): sugerem o anexo principal com confiança alta', () => {
    const dentifricio = classificarPorNcm('3306.10.00', { cClassTrib: '200035' });
    expect(dentifricio.sugestoes).toHaveLength(1);
    expect(dentifricio.sugestoes[0]).toMatchObject({
      cst: '200',
      cClassTrib: '200035',
      reducao: '0.6',
      anexo: 'VIII',
      artigo: 'Art. 136',
      confianca: 'ALTA',
      suportadoNaCalculadora: true,
      regraId: 'reducao.cclasstrib-200035',
    });

    const r = classificarPorNcm('1006.30.21', { cClassTrib: '200003' });
    expect(r.sugestoes[0]).toMatchObject({
      cst: '200',
      cClassTrib: '200003',
      reducao: '1',
      anexo: 'I',
      artigo: 'Art. 125',
      confianca: 'ALTA',
      suportadoNaCalculadora: true,
      regraId: 'reducao.cclasstrib-200003',
    });
    expect(r.sugestoes[0]?.itensAnexo[0]?.numero).toBe('1');
    // O segundo vínculo (200038, insumos agropecuários) vem como confiança média por exigir destinação.
    expect(r.sugestoes[1]).toMatchObject({ cClassTrib: '200038', confianca: 'MEDIA' });
    expect(r.impostoSeletivo?.incidencia).toBe('NAO_INCIDE');
    expect(r.validacao?.situacao).toBe('VINCULADO');
  });

  it('Coca-Cola (2202.10.00): tributação integral 000001 + Imposto Seletivo MP 1.399, e acusa erro se informarem 200003', () => {
    const r = classificarPorNcm('2202.10.00', { cClassTrib: '200003' });
    expect(r.sugestoes[0]).toMatchObject({
      cst: '000',
      cClassTrib: '000001',
      reducao: '0',
      confianca: 'PADRAO',
    });
    expect(r.impostoSeletivo).toMatchObject({
      incidencia: 'INCIDE_MP_1399',
      regraId: 'is.bebidas-acucaradas@1',
      aliquota2027: '0.026',
    });
    expect(r.validacao).toMatchObject({
      situacao: 'NAO_VINCULADO',
      cClassTrib: '200003',
      anexo: 'I',
    });
  });

  it('veículo (8703.21.00): sinaliza previsão de Imposto Seletivo na LC 214 ainda sem alíquota na Onda 1', () => {
    expect(enquadrarImpostoSeletivo('87032100')).toMatchObject({
      incidencia: 'PREVISTO_LC_214',
      prefixo: '8703',
    });
  });

  it('saúde menstrual (9619.00.00): sugere 200013 com confiança média e rejeita NCM diverso na crítica do art. 147', () => {
    const r = classificarPorNcm('9619.00.00');
    expect(r.sugestoes[0]).toMatchObject({
      cClassTrib: '200013',
      reducao: '1',
      confianca: 'MEDIA',
    });
    expect(criticarNcmNoAnexo('9619.00.00', '200013')).toMatchObject({
      situacao: 'SEM_ANEXO',
      criterio: 'SAUDE_MENSTRUAL_NCM_9619',
      compativelComCodigo: true,
    });
    expect(criticarNcmNoAnexo('2202.10.00', '200013')).toMatchObject({
      situacao: 'SEM_ANEXO',
      criterio: 'SAUDE_MENSTRUAL_NCM_9619',
      compativelComCodigo: false,
    });
  });

  it('NCM presente em mais de um anexo geral de produto devolve todas as opções com confiança média', () => {
    // 9021.10.10: consta no Anexo XII (200004, alíquota zero) e no Anexo IV (200030, redução de 60%).
    const r = classificarPorNcm('9021.10.10');
    expect(r.sugestoes.map((s) => s.cClassTrib)).toEqual(['200004', '200030']);
    expect(r.sugestoes.every((s) => s.confianca === 'MEDIA')).toBe(true);
    expect(r.sugestoes[0]?.reducao).toBe('1');
  });

  it('tratamentos sem anexo (Anvisa, in natura, integral) explicam o critério legal', () => {
    expect(criticarNcmNoAnexo('3004.90.99', '200009')).toMatchObject({
      situacao: 'SEM_ANEXO',
      criterio: 'REGISTRO_ANVISA',
    });
    expect(criticarNcmNoAnexo('0102.29.90', '200036')).toMatchObject({
      situacao: 'SEM_ANEXO',
      criterio: 'PRODUTO_IN_NATURA',
    });
    expect(criticarNcmNoAnexo('2202.10.00', '000001')).toMatchObject({
      situacao: 'SEM_ANEXO',
      criterio: 'TRIBUTACAO_INTEGRAL',
    });
    expect(() => criticarNcmNoAnexo('2202.10.00', '200')).toThrow(/6 dígitos/);
  });

  it('classifica serviço por NBS (educação 1.2201.12.00 -> 200028 no Anexo II)', () => {
    const r = classificarPorNbs('122011200', { cClassTrib: '200028' });
    expect(r.sugestoes[0]).toMatchObject({
      cst: '200',
      cClassTrib: '200028',
      reducao: '0.6',
      anexo: 'II',
      suportadoNaCalculadora: false,
      regraId: null,
    });
    expect(r.validacao?.situacao).toBe('VINCULADO');
    expect(criticarNbsNoAnexo('122011200', '200029').situacao).toBe('NAO_VINCULADO');

    const semReducao = classificarPorNbs('1.0101.11.00');
    expect(semReducao.sugestoes[0]?.cClassTrib).toBe('000001');
  });
});

describe('catálogo oficial do Simples Nacional (NT 2026.005 v1.00)', () => {
  it('traz as 15 atividades oficiais (01 a 14 e 90), os tipos de receita bruta e a transição de compras governamentais', () => {
    const atividades = atividadesSimplesNacional();
    expect(atividades).toHaveLength(15);
    expect(atividades.map((a) => a.codigo)).toContain('01');
    expect(atividades.map((a) => a.codigo)).toContain('90');

    const ativ09 = atividades.find((a) => a.codigo === '09')!;
    expect(ativ09).toMatchObject({ anexoSemFatorR: 'III', anexoComFatorR: 'V' });
    expect(derivarAnexosAtividadeSimples(ativ09, new Set(['III', 'V']))).toEqual({
      disponivel: true,
      anexosFaltantes: [],
      modoFatorR: 'OPCIONAL',
    });
    expect(derivarAnexosAtividadeSimples(ativ09, new Set(['V']))).toEqual({
      disponivel: true,
      anexosFaltantes: ['III'],
      modoFatorR: 'OBRIGATORIO',
    });
    expect(derivarAnexosAtividadeSimples(ativ09, new Set(['I']))).toEqual({
      disponivel: false,
      anexosFaltantes: ['III', 'V'],
      modoFatorR: 'INDISPONIVEL',
    });

    const ativ90 = atividades.find((a) => a.codigo === '90')!;
    expect(derivarAnexosAtividadeSimples(ativ90, new Set())).toEqual({
      disponivel: true,
      anexosFaltantes: [],
      modoFatorR: 'NAO_APLICAVEL',
    });

    expect(tiposReceitaBrutaSimples().map((t) => t.codigo)).toEqual([0, 1, 2, 3, 4, 5, 9]);
    expect(fatorTransicaoCompraGovSimples(2027)).toBe('0');
    expect(fatorTransicaoCompraGovSimples(2029)).toBe('0.1');
    expect(fatorTransicaoCompraGovSimples(2032)).toBe('0.4');
    expect(fatorTransicaoCompraGovSimples(2033)).toBe('1');
    expect(() => fatorTransicaoCompraGovSimples('2026-06-01')).toThrow(/fora da tabela/);
  });
});
