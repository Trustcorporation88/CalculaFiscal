import type { Status } from '@calculafiscal/motor-fiscal';

/** R$ 1.234,56 sem depender do Intl do motor JavaScript do celular. */
export function reais(valor: string): string {
  const [inteiro = '0', centavos = '00'] = Number(valor).toFixed(2).split('.');
  const comPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${comPontos},${centavos}`;
}

/** Fração para "25,0%" (uma casa). */
export function porcento(fracao: string): string {
  return `${(Number(fracao) * 100).toFixed(1).replace('.', ',')}%`;
}

export const ROTULO_STATUS: Readonly<Record<Status, string>> = {
  EM_VIGOR: 'Em vigor',
  PUBLICADO_EFEITO_FUTURO: 'Publicado',
  PROPOSTO: 'Proposto',
  PENDENTE: 'Pendente',
  ESTIMATIVA: 'Estimativa',
};

export const COR_STATUS: Readonly<Record<Status, string>> = {
  EM_VIGOR: '#1e7a4c',
  PUBLICADO_EFEITO_FUTURO: '#1f4e79',
  PROPOSTO: '#6b4fa3',
  PENDENTE: '#b45309',
  ESTIMATIVA: '#8a6d1f',
};

export const COR_IMPOSTO: Readonly<Record<string, string>> = {
  ICMS: '#b45309',
  'PIS/Cofins': '#9a3412',
  DAS: '#c2410c',
  CBS: '#b42318',
  IBS: '#d97706',
};

export const CORES = {
  tinta: '#14213d',
  papel: '#fbfaf7',
  superficie: '#ffffff',
  primaria: '#1f4e79',
  acento: '#c28a2c',
  borda: '#d6d3cc',
  suave: '#5b6478',
  custo: '#64748b',
  despesas: '#94a3b8',
  lucro: '#1e7a4c',
  erro: '#b42318',
} as const;
