/**
 * Cenários de premissas. Arquivo sem dependência de Node, para poder ir ao navegador
 * (importe por "@calculafiscal/regras/cenarios").
 */
export const CENARIOS = ['base', 'ibs-baixo', 'ibs-alto', 'mp-caducada'] as const;
export type Cenario = (typeof CENARIOS)[number];

export const DESCRICAO_CENARIOS: Readonly<Record<Cenario, string>> = {
  base: 'Base: CBS de 2027 pelo TCU, IBS de 2029 em diante no nível central',
  'ibs-baixo': 'IBS de 2029 em diante no nível baixo',
  'ibs-alto': 'IBS de 2029 em diante no nível alto',
  'mp-caducada': 'MP 1.399 caducada: sem Imposto Seletivo',
};
