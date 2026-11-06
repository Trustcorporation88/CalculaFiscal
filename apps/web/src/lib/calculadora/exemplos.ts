import type { ValoresFormulario } from './entrada';

/** Valores iniciais do formulário vazio. Nenhum tributo é pré-preenchido. */
export const FORMULARIO_VAZIO: ValoresFormulario = {
  cenario: 'base',
  regime: 'SIMPLES_DAS',
  baseMargem: 'PRECO_COM_TRIBUTO',
  freteEDespesas: '0',
  impostoSimplificado: '26,5',
};

/**
 * Caso Coca-Cola 600 ml do vídeo: distribuidora no Simples (DAS 8%), compra do fabricante em SP.
 * As premissas da nota (ICMS, IPI, PIS/Cofins monofásico e MVA) são ESTIMATIVA, calibradas para
 * a nota de 2026 fechar em R$ 4,89. Ver docs/motor/caso-coca-cola.md.
 */
export const EXEMPLO_COCA: ValoresFormulario = {
  descricao: 'Coca-Cola 600 ml (exemplo com premissas estimadas)',
  ncm: '2202.10.00',
  cenario: 'base',
  notaCompra: '4,89',
  aliquotaIcms: '18',
  aliquotaIpi: '2,6',
  aliquotaPisCofins: '13',
  temSt: 'on',
  mva: '42',
  aliquotaInterna: '18',
  freteEDespesas: '0',
  regime: 'SIMPLES_DAS',
  aliquotaDas: '8',
  despesasVariaveis: '6',
  margem: '25',
  baseMargem: 'PRECO_COM_TRIBUTO',
  impostoSimplificado: '26,5',
};
