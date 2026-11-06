import type { Regra } from './schema.js';

/** Regras vigentes numa data (AAAA-MM-DD), sem aplicar cenário. */
export function vigentesEm(regras: readonly Regra[], data: string): Regra[] {
  return regras.filter(
    (r) => r.vigencia.inicio <= data && (r.vigencia.fim === null || data <= r.vigencia.fim),
  );
}
