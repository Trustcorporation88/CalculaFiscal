import type { Status } from '@calculafiscal/motor-fiscal';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percentual = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const moeda3 = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 3,
});
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

/** Valores chegam do motor como texto decimal exato; aqui só se formata para exibir. */
export const reais = (v: string) => moeda.format(Number(v));
/** Para preço líquido do fornecedor, que o motor guarda em milésimos de real. */
export const reaisMilesimos = (v: string) => moeda3.format(Number(v));
export const decimal = (v: string) => numero.format(Number(v));
export const porcento = (fracao: string) => percentual.format(Number(fracao));

export const ROTULO_STATUS: Readonly<Record<Status, string>> = {
  EM_VIGOR: 'Em vigor',
  PUBLICADO_EFEITO_FUTURO: 'Publicado, efeito futuro',
  PROPOSTO: 'Proposto',
  PENDENTE: 'Pendente',
  ESTIMATIVA: 'Estimativa',
};

export const AJUDA_STATUS: Readonly<Record<Status, string>> = {
  EM_VIGOR: 'Regra publicada e produzindo efeitos.',
  PUBLICADO_EFEITO_FUTURO: 'Regra publicada, com efeitos a partir de data futura.',
  PROPOSTO: 'Proposta em tramitação: pode mudar.',
  PENDENTE: 'Depende de ato ainda não publicado (ex.: Senado, TCU, CGSN).',
  ESTIMATIVA: 'Sem norma: valor estimado para projeção.',
};

/** Ícone textual para o status não depender só da cor. */
export const ICONE_STATUS: Readonly<Record<Status, string>> = {
  EM_VIGOR: '●',
  PUBLICADO_EFEITO_FUTURO: '◐',
  PROPOSTO: '◇',
  PENDENTE: '◌',
  ESTIMATIVA: '≈',
};
