export {
  D,
  dec,
  arredondarMoeda,
  arredondarInternoRtc,
  arredondarMoedaRtc,
  type Dec,
} from './decimal.js';
export type { PassoMemoria } from './memoria.js';
export {
  precoSimplificado,
  type EntradaSimplificada,
  type ResultadoSimplificado,
} from './simplificado.js';
export {
  ORDEM_STATUS,
  type BaseMargem,
  type Fornecimento,
  type ModoFornecedor,
  type ParametrosAno,
  type PerfilVenda,
  type ReferenciaRegra,
  type Regime,
  type Status,
} from './tipos.js';
export { reconstruirCompra, apurarCreditos, type Compra, type Creditos } from './compra.js';
export {
  precificarAno,
  avaliarPreco,
  linhaDoTempo,
  statusDoAno,
  type EntradaPrecificacao,
  type ResultadoAno,
  type Valores,
} from './preco.js';

/** Versão do motor, devolvida em toda resposta da API para tornar o resultado reproduzível. */
export const VERSAO_MOTOR = '0.7.0';
export { precoPsicologico } from './psicologico.js';
export { aliquotasCbsIbs } from './efetivas.js';
export { precoLiquidoPelaNota, type PrecoLiquidoDaNota } from './nota.js';
export {
  avaliarPrecoServico,
  linhaDoTempoServico,
  precificarServicoAno,
  type CustosServico,
  type EntradaServico,
  type PerfilVendaServico,
} from './servico.js';
export {
  calcularBaseUnificadaNfe,
  calcularItemSimplesNt2026005,
  calcularTributosRtcItem,
  formatarAliquotaRtc,
  type CodigoTpRbsn,
  type EntradaBaseUnificadaNfe,
  type EntradaItemRegimeGeralRtc,
  type EntradaSimplesNt2026005,
  type ModeloDfeUnificado,
  type NaturezaOperacaoRtc,
  type RegimeSimplesNt,
  type ResultadoBaseUnificadaNfe,
  type ResultadoItemRegimeGeralRtc,
  type ResultadoSimplesNt2026005,
  type TipoEnteGovRtc,
} from './rtc-oficial.js';
