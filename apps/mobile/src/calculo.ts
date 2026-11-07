import {
  D,
  precificarAno,
  precoLiquidoPelaNota,
  precoPsicologico,
  VERSAO_MOTOR,
  type BaseMargem,
  type Fornecimento,
  type ParametrosAno,
  type PerfilVenda,
  type Status,
} from '@calculafiscal/motor-fiscal';
import { resolverPeriodo, type Cenario } from '@calculafiscal/regras/resolver';
import { tabelaOficial, type TabelaDeRegras } from '@calculafiscal/regras/tabela';

/**
 * Cálculo do app: só monta a entrada e chama o motor fiscal (o mesmo do site e da API).
 * Nenhuma fórmula fiscal mora aqui.
 */

export type RegimeApp = 'SIMPLES_DAS' | 'PRESUMIDO' | 'REAL';
export type Tratamento = '000001' | '200003' | '200034';

/** Configuração da empresa, guardada no celular. Percentuais como o usuário digita ("8" ou "3,65"). */
export interface ConfigEmpresa {
  readonly regime: RegimeApp;
  readonly aliquotaDas: string;
  readonly icmsVenda: string;
  readonly pisCofinsVenda: string;
  readonly despesas: string;
  readonly baseMargem: BaseMargem;
  readonly tratamento: Tratamento;
  readonly cenario: Cenario;
}

export const CONFIG_INICIAL: ConfigEmpresa = {
  regime: 'SIMPLES_DAS',
  aliquotaDas: '',
  icmsVenda: '',
  pisCofinsVenda: '',
  despesas: '',
  baseMargem: 'PRECO_COM_TRIBUTO',
  tratamento: '000001',
  cenario: 'base',
};

export const ROTULO_REGIME: Readonly<Record<RegimeApp, string>> = {
  SIMPLES_DAS: 'Simples Nacional',
  PRESUMIDO: 'Lucro Presumido',
  REAL: 'Lucro Real',
};

export const ROTULO_TRATAMENTO: Readonly<Record<Tratamento, string>> = {
  '000001': 'Tributação integral',
  '200003': 'Cesta básica (alíquota zero)',
  '200034': 'Alimentos com redução de 60%',
};

export interface Imposto {
  readonly sigla: 'IS' | 'ICMS' | 'PIS/Cofins' | 'DAS' | 'CBS' | 'IBS';
  readonly valor: string;
}

/** Imposto Seletivo pelo NCM: sem NCM, NCM fora da tabela do IS ou NCM com IS. */
export type Seletivo = 'sem-ncm' | 'nao-incide' | 'incide';

export type ResultadoAnoApp =
  | {
      readonly ano: number;
      readonly status: Status;
      readonly situacao: 'calculado';
      /** O que o cliente paga (preço + CBS e IBS destacados). */
      readonly clientePaga: string;
      /** Custo sem o Imposto Seletivo, que aparece à parte em `impostos`. */
      readonly custo: string;
      readonly impostos: readonly Imposto[];
      readonly totalImpostos: string;
      /** Impostos sobre o que o cliente paga, em fração. */
      readonly pesoImpostos: string;
      readonly despesas: string;
      readonly lucro: string;
      readonly margemSobrePreco: string;
      readonly margemSobreReceita: string;
      readonly sugerido: string;
    }
  | {
      readonly ano: number;
      readonly status: Status;
      readonly situacao: 'pendente';
      readonly motivo: string;
    };

export type Calculo =
  | {
      readonly ok: true;
      readonly anos: readonly ResultadoAnoApp[];
      readonly versao: string;
      readonly seletivo: Seletivo;
    }
  | { readonly ok: false; readonly erro: string };

/** "1.234,56", "1234,56", "4.89" ou "18%" para "1234.56". Nulo se não for número. */
export function numero(texto: string): string | null {
  let t = texto.trim().replace(/\s/g, '').replace(/^R\$/, '').replace(/%$/, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return /^\d{1,9}(\.\d{1,10})?$/.test(t) ? t : null;
}

/** NCM com 8 dígitos ("2202.10.00" ou "22021000"). Vazio = sem NCM; nulo = inválido. */
export function ncmValido(texto: string): string | null | '' {
  const digitos = texto.replace(/[\s.\-]/g, '');
  if (digitos === '') return '';
  return /^\d{8}$/.test(digitos)
    ? `${digitos.slice(0, 4)}.${digitos.slice(4, 6)}.${digitos.slice(6)}`
    : null;
}

const fracao = (texto: string): string | null => {
  const n = numero(texto);
  if (n === null) return null;
  const f = new D(n).div(100);
  return f.gte(1) ? null : f.toFixed();
};

/** O que falta preencher na configuração; vazio quando dá para calcular. */
export function pendenciasConfig(c: ConfigEmpresa): string[] {
  const faltas: string[] = [];
  if (fracao(c.despesas) === null) faltas.push('despesas variáveis');
  if (c.regime === 'SIMPLES_DAS') {
    if (fracao(c.aliquotaDas) === null) faltas.push('alíquota do DAS');
  } else {
    if (fracao(c.icmsVenda) === null) faltas.push('ICMS na venda');
    if (fracao(c.pisCofinsVenda) === null) faltas.push('PIS e Cofins na venda');
  }
  return faltas;
}

/**
 * O custo informado é o custo líquido (o que o produto custa, já descontado o imposto que
 * a empresa recupera). No regime regular, a CBS/IBS da compra vira crédito, então o preço do
 * fornecedor é o próprio custo. No Simples (DAS) não há crédito: o preço do fornecedor é o que,
 * com a CBS/IBS destacada, fecha o custo informado.
 * O custo informado é o de hoje, sem Imposto Seletivo: a partir de 2027 o IS do fabricante ou
 * importador chega embutido no preço da compra e soma ao custo (o motor nunca o credita).
 */
function fornecimentoDoAno(custo: string, regime: RegimeApp, p: ParametrosAno): Fornecimento {
  const semPreco: Omit<Fornecimento, 'precoLiquido'> = {
    aliquotaIcms: '0',
    aliquotaIpi: '0',
    aliquotaPisCofins: '0',
    substituicaoTributaria: null,
    freteEDespesas: '0',
  };
  const precoLiquido =
    regime === 'SIMPLES_DAS'
      ? precoLiquidoPelaNota(semPreco, custo, { ...p, aliquotaIs: '0' }).precoLiquido
      : custo;
  return { ...semPreco, precoLiquido };
}

export function calcular(
  config: ConfigEmpresa,
  custoTexto: string,
  margemTexto: string,
  opcoes: { readonly ncm?: string; readonly tabela?: TabelaDeRegras } = {},
): Calculo {
  const faltas = pendenciasConfig(config);
  if (faltas.length > 0) return { ok: false, erro: `Configure a empresa: ${faltas.join(', ')}.` };
  const custo = numero(custoTexto);
  if (custo === null || new D(custo).lte(0))
    return { ok: false, erro: 'Informe o custo do produto.' };
  const margem = fracao(margemTexto);
  if (margem === null) return { ok: false, erro: 'Informe a margem (menor que 100%).' };
  const ncm = ncmValido(opcoes.ncm ?? '');
  if (ncm === null) return { ok: false, erro: 'O NCM tem 8 dígitos (ex.: 2202.10.00).' };

  const simples = config.regime === 'SIMPLES_DAS';
  const perfil: PerfilVenda = {
    regime: config.regime,
    aliquotaIcmsSaida: simples ? '0' : (fracao(config.icmsVenda) as string),
    creditaIcmsEntrada: false,
    aliquotaPisCofinsSaida: simples ? '0' : (fracao(config.pisCofinsVenda) as string),
    creditoPisCofinsEntrada: '0',
    aliquotaDas: simples ? fracao(config.aliquotaDas) : null,
    parcelaCbsIbsNoDas: null,
    despesasVariaveis: fracao(config.despesas) as string,
    margem,
    baseMargem: config.baseMargem,
  };

  try {
    const tabela = opcoes.tabela ?? tabelaOficial();
    const parametros = resolverPeriodo(tabela.regras, {
      cenario: config.cenario,
      cClassTrib: config.tratamento,
      ...(ncm ? { ncm } : {}),
    });
    // Cenário sem IS ("MP caducada") também cai aqui: a tabela não cobra IS deste NCM.
    const seletivo: Seletivo = !ncm
      ? 'sem-ncm'
      : parametros.some((p) => new D(p.aliquotaIs).gt(0))
        ? 'incide'
        : 'nao-incide';
    const anos = parametros.map((p): ResultadoAnoApp => {
      const r = precificarAno(
        { fornecimento: fornecimentoDoAno(custo, config.regime, p), perfil },
        p,
      );
      if (r.situacao !== 'CALCULADO') {
        return { ano: r.ano, status: r.status, situacao: 'pendente', motivo: r.motivo };
      }
      const v = r.valores;
      const impostos = (
        [
          ['IS', v.isCompra],
          ['ICMS', v.icms],
          ['PIS/Cofins', v.pisCofins],
          ['DAS', v.das],
          ['CBS', v.cbs],
          ['IBS', v.ibs],
        ] as const
      )
        .filter(([, valor]) => new D(valor).gt(0))
        .map(([sigla, valor]) => ({ sigla, valor }));
      const total = impostos.reduce((t, i) => t.plus(i.valor), new D(0));
      return {
        ano: r.ano,
        status: r.status,
        situacao: 'calculado',
        clientePaga: v.precoComTributo,
        custo: new D(v.custoLiquido).minus(v.isCompra).toFixed(2),
        impostos,
        totalImpostos: total.toFixed(2),
        pesoImpostos: total.div(v.precoComTributo).toFixed(4),
        despesas: v.despesas,
        lucro: v.lucro,
        margemSobrePreco: v.margemSobrePrecoComTributo,
        margemSobreReceita: v.margemSobreReceitaLiquida,
        sugerido: precoPsicologico(v.precoComTributo),
      };
    });
    return {
      ok: true,
      anos,
      versao: `regras ${tabela.versao} · motor ${VERSAO_MOTOR}`,
      seletivo,
    };
  } catch (e) {
    return { ok: false, erro: e instanceof RangeError ? e.message : 'Não foi possível calcular.' };
  }
}
