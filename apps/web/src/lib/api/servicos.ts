import { VERSAO_MOTOR } from '@calculafiscal/motor-fiscal';
import {
  CENARIOS,
  DESCRICAO_CENARIOS,
  vigentesEm,
  type Regra,
  type TabelaDeRegras,
} from '@calculafiscal/regras';
import { calcularLinhaDoTempo } from '../calculadora/calcular';
import type { EntradaCalculadora } from '../calculadora/entrada';
import type { SimulacaoV1 } from './contrato';
import { corpoProblema } from './problema';

/**
 * Camada de serviço da API: a mesma função de cálculo da tela (calcularLinhaDoTempo), sem
 * nenhuma regra própria. Recebe a requisição já validada pelo contrato.
 */

function entradaDoItem(req: SimulacaoV1, item: SimulacaoV1['itens'][number]): EntradaCalculadora {
  const v = req.venda;
  const simples = v.regime === 'SIMPLES_DAS' || v.regime === 'SIMPLES_REGULAR';
  return {
    descricao: item.descricao,
    ncm: item.ncm ?? null,
    cClassTrib: item.cClassTrib,
    cenario: req.cenario,
    notaCompra: item.compra.totalNota,
    aliquotaIcms: item.compra.aliquotaIcms,
    aliquotaIpi: item.compra.aliquotaIpi,
    aliquotaPisCofins: item.compra.aliquotaPisCofins,
    substituicaoTributaria: item.compra.substituicaoTributaria,
    freteEDespesas: item.compra.freteEDespesas,
    regime: v.regime,
    aliquotaDas: simples ? (v.aliquotaDas ?? null) : null,
    parcelaCbsIbsNoDas: simples ? (v.parcelaCbsIbsNoDas ?? null) : null,
    aliquotaIcmsSaida: simples ? '0' : v.aliquotaIcmsSaida,
    creditaIcmsEntrada: !simples && v.creditaIcmsEntrada,
    aliquotaPisCofinsSaida: simples ? '0' : v.aliquotaPisCofinsSaida,
    creditoPisCofinsEntrada: simples ? '0' : v.creditoPisCofinsEntrada,
    despesasVariaveis: v.despesasVariaveis,
    margem: v.margem,
    baseMargem: v.baseMargem,
    impostoSimplificado: req.impostoSimplificado,
  };
}

/** Resposta conferida contra RespostaSimulacaoV1 nos testes de contrato. */
export function simular(req: SimulacaoV1, tabela: TabelaDeRegras, requestId: string) {
  return {
    request_id: requestId,
    versao_motor: VERSAO_MOTOR,
    versao_regras: tabela.versao,
    cenario: req.cenario,
    itens: req.itens.map((item) => {
      const idExterno = item.idExterno ?? null;
      try {
        const r = calcularLinhaDoTempo(entradaDoItem(req, item), tabela);
        return {
          idExterno,
          situacao: 'calculado' as const,
          resultado: {
            precoLiquidoFornecedor: r.precoLiquidoFornecedor,
            faixaPrecoLiquido: r.faixaPrecoLiquido,
            ajusteNota: r.ajusteNota,
            tratamento: r.tratamento,
            memoriaNota: r.memoriaNota,
            anos: [...r.anos],
            sugestoes: [...r.sugestoes],
            cenarios: r.cenarios.map((c) => ({ cenario: c.cenario, anos: [...c.anos] })),
            simplificado: r.simplificado,
            fontes: [...r.fontes],
          },
        };
      } catch (e) {
        // RangeError = combinação impossível; o item volta com o motivo, os outros seguem.
        if (!(e instanceof RangeError)) throw e;
        return {
          idExterno,
          situacao: 'erro' as const,
          problema: corpoProblema('entrada-impossivel', { detail: e.message, requestId }),
        };
      }
    }),
  };
}

/** Data de hoje no fuso de Brasília (AAAA-MM-DD). */
export const hojeEmBrasilia = (agora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);

const soDigitos = (s: string) => s.replace(/\D/g, '');

export function consultarRegras(
  q: {
    data?: string | undefined;
    tributo?: string | undefined;
    ncm?: string | undefined;
    cClassTrib?: string | undefined;
  },
  tabela: TabelaDeRegras,
  requestId: string,
) {
  const data = q.data ?? hojeEmBrasilia();
  const ncm = q.ncm ? soDigitos(q.ncm) : null;
  const regras = vigentesEm(tabela.regras, data)
    .filter((r) => !q.tributo || r.tributo === q.tributo)
    .filter(
      (r) =>
        !ncm ||
        r.abrangencia.ncm.length === 0 ||
        r.abrangencia.ncm.some((n) => ncm.startsWith(soDigitos(n))),
    )
    .filter(
      (r) =>
        !q.cClassTrib ||
        r.abrangencia.cClassTrib.length === 0 ||
        r.abrangencia.cClassTrib.includes(q.cClassTrib),
    )
    .map((r: Regra) => ({
      chave: `${r.id}@${r.versao}`,
      id: r.id,
      versao: r.versao,
      tributo: r.tributo,
      descricao: r.descricao,
      vigencia: r.vigencia,
      abrangencia: r.abrangencia as Record<string, string[]>,
      valor: r.valor as Record<string, unknown>,
      fonte: r.fonte,
      cenarios: r.cenarios,
      status: r.status,
      conferencia: r.conferencia,
      observacao: r.observacao ?? null,
    }));
  return { request_id: requestId, versao_regras: tabela.versao, data, regras };
}

export function listarCenarios(tabela: TabelaDeRegras, requestId: string) {
  return {
    request_id: requestId,
    versao_regras: tabela.versao,
    cenarios: CENARIOS.map((id) => ({ id, descricao: DESCRICAO_CENARIOS[id] })),
  };
}
