export { D, dec, arredondarMoeda, type Dec } from './decimal.js';
export type { PassoMemoria } from './memoria.js';
export {
  precoSimplificado,
  type EntradaSimplificada,
  type ResultadoSimplificado,
} from './simplificado.js';

/** Versão do motor, devolvida em toda resposta da API para tornar o resultado reproduzível. */
export const VERSAO_MOTOR = '0.1.0';
