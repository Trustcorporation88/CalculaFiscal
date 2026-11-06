import type { Fornecimento, ParametrosAno, PerfilVenda } from '../src/index.js';

/** Parâmetros de teste montados à mão (o motor não depende do pacote de regras). */
export const ANO_2026: ParametrosAno = {
  ano: 2026,
  cbs: '0.009',
  ibs: '0.001',
  cbsIbsComEfeito: false,
  fatorIcms: '1',
  pisCofinsVigente: true,
  ipiVigente: true,
  aliquotaIs: '0',
  regras: [{ id: 'teste.2026', versao: 1, status: 'EM_VIGOR' }],
};

export const ANO_2027: ParametrosAno = {
  ano: 2027,
  cbs: '0.112',
  ibs: '0.001',
  cbsIbsComEfeito: true,
  fatorIcms: '1',
  pisCofinsVigente: false,
  ipiVigente: false,
  aliquotaIs: '0.026',
  regras: [
    { id: 'teste.2027', versao: 1, status: 'PUBLICADO_EFEITO_FUTURO' },
    { id: 'cbs.2027', versao: 1, status: 'PENDENTE' },
  ],
};

export const ANO_2033: ParametrosAno = {
  ano: 2033,
  cbs: '0.113',
  ibs: '0.167',
  cbsIbsComEfeito: true,
  fatorIcms: '0',
  pisCofinsVigente: false,
  ipiVigente: false,
  aliquotaIs: '0.026',
  regras: [{ id: 'ibs.2033', versao: 1, status: 'ESTIMATIVA' }],
};

/**
 * Coca-Cola 600 ml comprada do fabricante em SP. Premissas ESTIMATIVA, calibradas para a nota
 * de 2026 fechar em R$ 4,89: ICMS 18%, IPI 2,6% (TIPI = alíquota inicial do IS na MP 1.399),
 * PIS/Cofins monofásico 13% (2,32% + 10,68%, Lei 13.097/2015, a conferir), MVA-ST 42%.
 */
export const COCA_FABRICANTE: Fornecimento = {
  precoLiquido: '3.040',
  aliquotaIcms: '0.18',
  aliquotaIpi: '0.026',
  aliquotaPisCofins: '0.13',
  substituicaoTributaria: { mva: '0.42', aliquotaInterna: '0.18' },
  freteEDespesas: '0',
};

/** Distribuidora no regime regular: ST encerrada, revenda monofásica, despesas 6%, margem 25%. */
export const DISTRIBUIDORA_REAL: PerfilVenda = {
  regime: 'REAL',
  aliquotaIcmsSaida: '0',
  creditaIcmsEntrada: false,
  aliquotaPisCofinsSaida: '0',
  creditoPisCofinsEntrada: '0',
  aliquotaDas: null,
  parcelaCbsIbsNoDas: null,
  despesasVariaveis: '0.06',
  margem: '0.25',
  baseMargem: 'PRECO_COM_TRIBUTO',
};

export const DISTRIBUIDORA_SIMPLES: PerfilVenda = {
  ...DISTRIBUIDORA_REAL,
  regime: 'SIMPLES_DAS',
  aliquotaDas: '0.08',
};
