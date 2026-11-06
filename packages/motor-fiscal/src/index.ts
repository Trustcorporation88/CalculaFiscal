export { D, dec, arredondarMoeda, type Dec } from './decimal.js';
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
  type ParametrosAno,
  type PerfilVenda,
  type ReferenciaRegra,
  type Regime,
  type Status,
} from './tipos.js';
export { reconstruirCompra, apurarCreditos, type Compra, type Creditos } from './compra.js';
export {
  precificarAno,
  linhaDoTempo,
  statusDoAno,
  type EntradaPrecificacao,
  type ResultadoAno,
  type Valores,
} from './preco.js';

/** Versão do motor, devolvida em toda resposta da API para tornar o resultado reproduzível. */
export const VERSAO_MOTOR = '0.3.0';
export { precoLiquidoPelaNota, type PrecoLiquidoDaNota } from './nota.js';
