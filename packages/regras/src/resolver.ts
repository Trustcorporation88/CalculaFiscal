import { D, dec, type ParametrosAno, type ReferenciaRegra } from '@calculafiscal/motor-fiscal';
import type { Regra } from './schema.js';
import { vigentesEm } from './vigencia.js';

export const CENARIOS = ['base', 'ibs-baixo', 'ibs-alto', 'mp-caducada'] as const;
export type Cenario = (typeof CENARIOS)[number];

export interface PedidoAno {
  readonly ano: number;
  readonly cenario?: Cenario;
  /** NCM do produto (com ou sem pontos), para Imposto Seletivo. */
  readonly ncm?: string;
  /** Data de referência dentro do ano. Padrão: 1º de julho. */
  readonly data?: string;
}

const soDigitos = (ncm: string) => ncm.replace(/\D/g, '');

/** Entre as regras vigentes com o mesmo id, escolhe a do cenário; se não houver, a do cenário base. */
function escolher(candidatas: Regra[], cenario: Cenario, rotulo: string): Regra | undefined {
  const doCenario = candidatas.filter((r) => r.cenarios.includes(cenario));
  const base = candidatas.filter((r) => r.cenarios.length === 0);
  const lista = doCenario.length > 0 ? doCenario : base;
  if (lista.length > 1) {
    throw new Error(
      `Regras ambíguas para ${rotulo}: ${lista.map((r) => `${r.id}@${r.versao}`).join(', ')}`,
    );
  }
  return lista[0];
}

function exigir(r: Regra | undefined, rotulo: string, data: string): Regra {
  if (!r) throw new Error(`Nenhuma regra vigente para ${rotulo} em ${data}.`);
  return r;
}

const comoRef = (r: Regra, status = r.status): ReferenciaRegra => ({
  id: r.id,
  versao: r.versao,
  status,
});

/** IS do NCM numa data: a regra cujo NCM é o prefixo mais longo do produto. */
function regraIs(vigentes: Regra[], ncm: string, cenario: Cenario): Regra | undefined {
  const alvo = soDigitos(ncm);
  const casam = vigentes
    .filter((r) => r.tributo === 'IS')
    .map((r) => ({
      r,
      tam: Math.max(
        0,
        ...r.abrangencia.ncm
          .map(soDigitos)
          .filter((n) => alvo.startsWith(n))
          .map((n) => n.length),
      ),
    }))
    .filter((x) => x.tam > 0);
  if (casam.length === 0) return undefined;
  const maior = Math.max(...casam.map((x) => x.tam));
  return escolher(
    casam.filter((x) => x.tam === maior).map((x) => x.r),
    cenario,
    `IS do NCM ${ncm}`,
  );
}

/**
 * Resolve os parâmetros de um ano a partir das regras versionadas.
 * IS de 2028 em diante ainda não tem lei: no cenário base repete 2027, marcado como ESTIMATIVA.
 * No cenário "mp-caducada" o IS não incide.
 */
export function resolverAno(regras: readonly Regra[], pedido: PedidoAno): ParametrosAno {
  const cenario = pedido.cenario ?? 'base';
  const data = pedido.data ?? `${pedido.ano}-07-01`;
  const vigentes = vigentesEm(regras, data);
  const porId = (id: string) =>
    exigir(
      escolher(
        vigentes.filter((r) => r.id === id),
        cenario,
        id,
      ),
      id,
      data,
    );
  const porTributo = (t: Regra['tributo']) =>
    exigir(
      escolher(
        vigentes.filter((r) => r.tributo === t),
        cenario,
        t,
      ),
      t,
      data,
    );

  const efeito = porId('transicao.cbs-ibs-efeito');
  const pisCofins = porId('transicao.pis-cofins');
  const ipi = porId('transicao.ipi');
  const fator = porId('transicao.fator-icms-iss');
  const cbs = porTributo('CBS');

  // IBS: total (2026 e 2029+) ou soma das parcelas estadual e municipal (2027–2028).
  const ibsTotal = escolher(
    vigentes.filter((r) => r.tributo === 'IBS'),
    cenario,
    'IBS',
  );
  const ibsPartes = ibsTotal ? [ibsTotal] : [porTributo('IBS_UF'), porTributo('IBS_MUN')];
  const ibs = ibsPartes.reduce((soma, r) => soma.plus(dec(r.valor.aliquota)), new D(0));

  const refs: ReferenciaRegra[] = [efeito, pisCofins, ipi, fator, cbs, ...ibsPartes].map((r) =>
    comoRef(r),
  );

  let aliquotaIs = '0';
  if (pedido.ncm && cenario !== 'mp-caducada') {
    const atual = regraIs(vigentes, pedido.ncm, cenario);
    if (atual) {
      aliquotaIs = atual.valor.aliquota;
      refs.push(comoRef(atual));
    } else if (pedido.ano >= 2028) {
      const de2027 = regraIs(vigentesEm(regras, '2027-07-01'), pedido.ncm, cenario);
      if (de2027) {
        aliquotaIs = de2027.valor.aliquota;
        refs.push(comoRef(de2027, 'ESTIMATIVA'));
      }
    }
  }

  return {
    ano: pedido.ano,
    cbs: cbs.valor.aliquota,
    ibs: ibs.toString(),
    cbsIbsComEfeito: efeito.valor.aliquota === '1',
    fatorIcms: fator.valor.aliquota,
    pisCofinsVigente: pisCofins.valor.aliquota === '1',
    ipiVigente: ipi.valor.aliquota === '1',
    aliquotaIs,
    regras: refs,
  };
}

/** Parâmetros de 2026 a 2033 para um produto e cenário. */
export function resolverPeriodo(
  regras: readonly Regra[],
  pedido: Omit<PedidoAno, 'ano' | 'data'>,
  de = 2026,
  ate = 2033,
): ParametrosAno[] {
  const anos: ParametrosAno[] = [];
  for (let ano = de; ano <= ate; ano++) anos.push(resolverAno(regras, { ...pedido, ano }));
  return anos;
}
