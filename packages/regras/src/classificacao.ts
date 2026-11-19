import { CATALOGO_RFB } from './catalogo.gerado.js';
import { TRIBUTACAO_INTEGRAL } from './resolver.js';
import type { Regra } from './schema.js';
import { tabelaOficial } from './tabela.js';
import { vigentesEm } from './vigencia.js';

/**
 * Classificação e crítica de NCM/NBS segundo os anexos da LC 214/2025 e os parâmetros do
 * Simples Nacional (NT 2026.005 v1.00), extraídos dos repositórios oficiais da Receita Federal
 * (calculadora-rtc-regime-regular e calculadora-rtc-simples-nacional).
 * Sem dependência de Node: roda no servidor, no navegador e offline no app.
 */

export interface VinculoCatalogo {
  readonly codigo: string;
  readonly excecoes?: readonly string[];
  readonly item?: string;
  readonly descricaoItem?: string;
}

export interface ItemAnexo {
  readonly prefixo: string;
  readonly numero: string | null;
  readonly descricao: string | null;
}

export type CriterioSemAnexo =
  | 'TRIBUTACAO_INTEGRAL'
  | 'REGISTRO_ANVISA'
  | 'SAUDE_MENSTRUAL_NCM_9619'
  | 'PRODUTO_IN_NATURA'
  | 'PROFISSAO_REGULAMENTADA'
  | 'REQUISITO_LEGAL_SERVICO'
  | 'NAO_CATALOGADO';

export type CriticaAnexo =
  | {
      readonly situacao: 'VINCULADO';
      readonly cClassTrib: string;
      readonly anexo: string;
      readonly artigo: string;
      readonly itens: readonly ItemAnexo[];
      readonly mensagem: string;
    }
  | {
      readonly situacao: 'NAO_VINCULADO';
      readonly cClassTrib: string;
      readonly anexo: string;
      readonly artigo: string;
      readonly excecaoAplicada: string | null;
      readonly mensagem: string;
    }
  | {
      readonly situacao: 'SEM_ANEXO';
      readonly cClassTrib: string;
      readonly artigo: string | null;
      readonly criterio: CriterioSemAnexo;
      readonly compativelComCodigo: boolean;
      readonly mensagem: string;
    };

export type GrauConfianca = 'ALTA' | 'MEDIA' | 'PADRAO';

export interface SugestaoClassificacao {
  readonly cst: string;
  readonly cClassTrib: string;
  readonly descricao: string;
  /** Fração reduzida: '1' = alíquota zero, '0.6' = redução de 60%, '0' = integral. */
  readonly reducao: string;
  readonly artigo: string;
  readonly anexo: string | null;
  /** Tipo de Receita Bruta do Simples Nacional (NT 2026.005). */
  readonly tpRbsn: number;
  readonly confianca: GrauConfianca;
  readonly motivo: string;
  readonly itensAnexo: readonly ItemAnexo[];
  /** Verdadeiro quando o código já entra direto na calculadora de mercadorias. */
  readonly suportadoNaCalculadora: boolean;
  /** Regra correspondente na tabela de alíquotas (reducao.cclasstrib-...), quando existir. */
  readonly regraId: string | null;
}

export type EnquadramentoIs =
  | {
      readonly incidencia: 'NAO_INCIDE';
      readonly regraId: null;
      readonly aliquota2027: null;
      readonly mensagem: string;
    }
  | {
      readonly incidencia: 'INCIDE_MP_1399';
      readonly regraId: string;
      readonly aliquota2027: string;
      readonly descricao: string;
      readonly mensagem: string;
    }
  | {
      readonly incidencia: 'PREVISTO_LC_214';
      readonly regraId: null;
      readonly aliquota2027: null;
      readonly prefixo: string;
      readonly mensagem: string;
    };

export interface ResultadoClassificacao {
  readonly tipo: 'NCM' | 'NBS';
  readonly codigo: string;
  readonly codigoLimpo: string;
  readonly sugestoes: readonly SugestaoClassificacao[];
  readonly impostoSeletivo: EnquadramentoIs | null;
  readonly validacao: CriticaAnexo | null;
  readonly fonte: {
    readonly organizacao: string;
    readonly versaoBaseDados: string;
    readonly dataBaseDados: string;
    readonly notaTecnicaSimples: string;
    readonly repositorios: readonly string[];
  };
}

export type AnexoSimples = 'I' | 'II' | 'III' | 'IV' | 'V';
export type ModoFatorR = 'NAO_APLICAVEL' | 'OPCIONAL' | 'OBRIGATORIO' | 'INDISPONIVEL';

export interface AtividadeSimples {
  readonly codigo: string;
  readonly descricao: string;
  readonly anexoSemFatorR: AnexoSimples | null;
  readonly anexoComFatorR: AnexoSimples | null;
  readonly rotulo: string;
  readonly naoTributavel: boolean;
  readonly modelosDfe: readonly number[];
}

export interface TipoReceitaBrutaSimples {
  readonly codigo: number;
  readonly descricao: string;
  readonly compoeReceita: boolean;
  readonly fatorReceita: string;
  readonly pendenteSuspenso: boolean;
  readonly exigeAliquota: boolean;
}

export const CODIGOS_SERVICO_SUPORTADOS = [
  '200016',
  '200028',
  '200029',
  '200037',
  '200038',
  '200039',
  '200041',
  '200042',
  '200052',
] as const;

const SET_SERVICO_SUPORTADOS = new Set<string>(CODIGOS_SERVICO_SUPORTADOS);
/** Classificações cujo enquadramento depende sempre da destinação/uso, mesmo com 1 só anexo. */
const DEPENDE_DESTINACAO = new Set(['200038', '200039']);
const NCM_SAUDE_MENSTRUAL = '96190000';

const soDigitos = (s: string) => s.replace(/\D/g, '');

export function formatarNcm(ncm: string): string {
  const d = soDigitos(ncm);
  if (d.length !== 8) {
    throw new RangeError('NCM precisa ter 8 dígitos (ex.: 1006.30.21).');
  }
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

export function formatarNbs(nbs: string): string {
  const d = soDigitos(nbs);
  if (d.length !== 9) {
    throw new RangeError('NBS precisa ter 9 dígitos (ex.: 1.2201.12.00).');
  }
  return `${d.slice(0, 1)}.${d.slice(1, 5)}.${d.slice(5, 7)}.${d.slice(7, 9)}`;
}

/**
 * Tabela-verdade idêntica a NcmAplicavelService / NbsAplicavelService da Receita Federal:
 * A = algum vínculo cobre o código;
 * E = algum vínculo coberto possui exceção que também cobre o código;
 * S = algum vínculo coberto não possui nenhuma exceção.
 * Aceita se e somente se A && (!E || S).
 */
export function avaliarVinculosContraAnexo(
  codigoLimpo: string,
  vinculos: readonly VinculoCatalogo[],
):
  | { readonly aceito: true; readonly itens: ItemAnexo[] }
  | { readonly aceito: false; readonly excecaoAplicada: string | null } {
  const cobertos = vinculos.filter((v) => codigoLimpo.startsWith(v.codigo));
  if (cobertos.length === 0) {
    return { aceito: false, excecaoAplicada: null };
  }

  let excecaoEncontrada: string | null = null;
  for (const v of cobertos) {
    for (const ex of v.excecoes ?? []) {
      if (codigoLimpo.startsWith(ex)) {
        excecaoEncontrada = ex;
        break;
      }
    }
    if (excecaoEncontrada !== null) break;
  }

  const temSemExcecao = cobertos.some((v) => (v.excecoes?.length ?? 0) === 0);
  if (excecaoEncontrada !== null && !temSemExcecao) {
    return { aceito: false, excecaoAplicada: excecaoEncontrada };
  }

  const vistos = new Set<string>();
  const itens: ItemAnexo[] = [];
  for (const v of cobertos) {
    if ((v.excecoes ?? []).some((ex) => codigoLimpo.startsWith(ex))) continue;
    const chave = `${v.codigo}|${v.item ?? ''}|${v.descricaoItem ?? ''}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    itens.push({
      prefixo: v.codigo,
      numero: v.item ?? null,
      descricao: v.descricaoItem ?? null,
    });
  }
  return { aceito: true, itens };
}

type EntradaCatalogo = (typeof CATALOGO_RFB.classificacoes)[number];

const POR_CODIGO = new Map<string, EntradaCatalogo>(
  CATALOGO_RFB.classificacoes.map((c) => [c.cClassTrib, c]),
);

function criterioSemAnexo(
  cClassTrib: string,
  artigo: string | null,
  ncmLimpo: string | null,
): CriticaAnexo {
  if (cClassTrib === TRIBUTACAO_INTEGRAL) {
    return {
      situacao: 'SEM_ANEXO',
      cClassTrib,
      artigo: 'Regra geral (LC 214/2025)',
      criterio: 'TRIBUTACAO_INTEGRAL',
      compativelComCodigo: true,
      mensagem: 'Tributação integral de CBS e IBS (000001): aceita qualquer NCM ou NBS.',
    };
  }
  if (cClassTrib === '200013') {
    const compativel = ncmLimpo === null || ncmLimpo === NCM_SAUDE_MENSTRUAL;
    return {
      situacao: 'SEM_ANEXO',
      cClassTrib,
      artigo: artigo ?? 'Art. 147',
      criterio: 'SAUDE_MENSTRUAL_NCM_9619',
      compativelComCodigo: compativel,
      mensagem: compativel
        ? 'Tratamento 200013 (LC 214/2025, art. 147): alíquota zero para tampões, absorventes e coletores menstruais do NCM 9619.00.00 (não alcança fraldas desse mesmo NCM).'
        : `Atenção: o art. 147 da LC 214/2025 restringe o tratamento 200013 ao código 9619.00.00 da NCM/SH (tampões, absorventes e coletores menstruais), diferente do NCM informado (${formatarNcm(ncmLimpo)}).`,
    };
  }
  if (cClassTrib === '200009' || cClassTrib === '200032' || cClassTrib === '200053') {
    return {
      situacao: 'SEM_ANEXO',
      cClassTrib,
      artigo,
      criterio: 'REGISTRO_ANVISA',
      compativelComCodigo: true,
      mensagem: `Tratamento ${cClassTrib} (LC 214/2025, ${artigo ?? 'arts. 133 e 146'}): não usa anexo de NCM na base da Receita Federal; o enquadramento depende do registro sanitário na Anvisa (ou manipulação no 200032).`,
    };
  }
  if (cClassTrib === '200036') {
    return {
      situacao: 'SEM_ANEXO',
      cClassTrib,
      artigo: artigo ?? 'Art. 137',
      criterio: 'PRODUTO_IN_NATURA',
      compativelComCodigo: true,
      mensagem:
        'Tratamento 200036 (LC 214/2025, art. 137): não usa anexo de NCM na base da Receita Federal; exige que o produto agropecuário, aquícola, pesqueiro, florestal ou extrativista vegetal esteja in natura.',
    };
  }
  if (cClassTrib === '200052') {
    return {
      situacao: 'SEM_ANEXO',
      cClassTrib,
      artigo: artigo ?? 'Art. 127, I a XVIII',
      criterio: 'PROFISSAO_REGULAMENTADA',
      compativelComCodigo: true,
      mensagem:
        'Tratamento 200052 (LC 214/2025, art. 127, I a XVIII): redução de 30% para serviços de profissões intelectuais submetidas a conselho profissional (como contabilidade, advocacia, engenharia, arquitetura e administração), cumpridos os requisitos societários do art. 127.',
    };
  }
  if (
    cClassTrib === '200016' ||
    cClassTrib === '200037' ||
    cClassTrib === '200041' ||
    cClassTrib === '200042'
  ) {
    return {
      situacao: 'SEM_ANEXO',
      cClassTrib,
      artigo,
      criterio: 'REQUISITO_LEGAL_SERVICO',
      compativelComCodigo: true,
      mensagem: `Tratamento ${cClassTrib} (LC 214/2025, ${artigo ?? 'serviço diferenciado'}): não usa anexo de NBS na base da Receita Federal; exige atender aos requisitos objetivos do artigo.`,
    };
  }
  return {
    situacao: 'SEM_ANEXO',
    cClassTrib,
    artigo,
    criterio: 'NAO_CATALOGADO',
    compativelComCodigo: true,
    mensagem: `Classificação ${cClassTrib} sem tabela de anexo NCM/NBS cadastrada neste catálogo.`,
  };
}

/** Critica um NCM de 8 dígitos contra o anexo oficial de uma cClassTrib (regra REG-011 da RFB). */
export function criticarNcmNoAnexo(ncm: string, cClassTrib: string): CriticaAnexo {
  const formatado = formatarNcm(ncm);
  const limpo = soDigitos(formatado);
  if (!/^\d{6}$/.test(cClassTrib)) {
    throw new RangeError('cClassTrib precisa ter 6 dígitos.');
  }
  const entrada = POR_CODIGO.get(cClassTrib);
  if (!entrada || entrada.vinculosNcm.length === 0 || entrada.anexo === null) {
    return criterioSemAnexo(cClassTrib, entrada?.artigo ?? null, limpo);
  }
  const av = avaliarVinculosContraAnexo(limpo, entrada.vinculosNcm);
  if (av.aceito) {
    const resumoItem = av.itens[0]?.numero
      ? `, item ${av.itens[0].numero}${av.itens[0].descricao ? ` (${av.itens[0].descricao})` : ''}`
      : '';
    return {
      situacao: 'VINCULADO',
      cClassTrib,
      anexo: entrada.anexo,
      artigo: entrada.artigo,
      itens: av.itens,
      mensagem: `NCM ${formatado} consta no Anexo ${entrada.anexo} da LC 214/2025 (${entrada.artigo}${resumoItem}).`,
    };
  }
  const detalheExcecao = av.excecaoAplicada
    ? ` (excluído pela exceção NCM ${av.excecaoAplicada})`
    : '';
  return {
    situacao: 'NAO_VINCULADO',
    cClassTrib,
    anexo: entrada.anexo,
    artigo: entrada.artigo,
    excecaoAplicada: av.excecaoAplicada,
    mensagem: `NCM ${formatado} não está vinculado ao tratamento ${cClassTrib} no Anexo ${entrada.anexo} da LC 214/2025${detalheExcecao} (crítica REG-011 da Receita Federal).`,
  };
}

/** Critica uma NBS de 9 dígitos contra o anexo oficial de uma cClassTrib. */
export function criticarNbsNoAnexo(nbs: string, cClassTrib: string): CriticaAnexo {
  const formatado = formatarNbs(nbs);
  const limpo = soDigitos(formatado);
  if (!/^\d{6}$/.test(cClassTrib)) {
    throw new RangeError('cClassTrib precisa ter 6 dígitos.');
  }
  const entrada = POR_CODIGO.get(cClassTrib);
  if (!entrada || entrada.vinculosNbs.length === 0 || entrada.anexo === null) {
    return criterioSemAnexo(cClassTrib, entrada?.artigo ?? null, null);
  }
  const av = avaliarVinculosContraAnexo(limpo, entrada.vinculosNbs);
  if (av.aceito) {
    const resumoItem = av.itens[0]?.numero
      ? `, item ${av.itens[0].numero}${av.itens[0].descricao ? ` (${av.itens[0].descricao})` : ''}`
      : '';
    return {
      situacao: 'VINCULADO',
      cClassTrib,
      anexo: entrada.anexo,
      artigo: entrada.artigo,
      itens: av.itens,
      mensagem: `NBS ${formatado} consta no Anexo ${entrada.anexo} da LC 214/2025 (${entrada.artigo}${resumoItem}).`,
    };
  }
  const detalheExcecao = av.excecaoAplicada
    ? ` (excluído pela exceção NBS ${av.excecaoAplicada})`
    : '';
  return {
    situacao: 'NAO_VINCULADO',
    cClassTrib,
    anexo: entrada.anexo,
    artigo: entrada.artigo,
    excecaoAplicada: av.excecaoAplicada,
    mensagem: `NBS ${formatado} não está vinculada ao tratamento ${cClassTrib} no Anexo ${entrada.anexo} da LC 214/2025${detalheExcecao}.`,
  };
}

/** Enquadramento de um NCM de 8 dígitos no Imposto Seletivo (MP 1.399/2026 + LC 214/2025). */
export function enquadrarImpostoSeletivo(
  ncmLimpo: string,
  regras: readonly Regra[] = tabelaOficial().regras,
): EnquadramentoIs {
  const vigentes2027 = vigentesEm(regras, '2027-07-01')
    .filter((r) => r.tributo === 'IS' && r.cenarios.length === 0)
    .map((r) => ({
      regra: r,
      tam: Math.max(
        0,
        ...r.abrangencia.ncm
          .map(soDigitos)
          .filter((n) => ncmLimpo.startsWith(n))
          .map((n) => n.length),
      ),
    }))
    .filter((x) => x.tam > 0)
    .sort((a, b) => b.tam - a.tam);

  const mp = vigentes2027[0]?.regra;
  if (mp) {
    const pct = `${(Number(mp.valor.aliquota) * 100).toLocaleString('pt-BR')}%`;
    return {
      incidencia: 'INCIDE_MP_1399',
      regraId: `${mp.id}@${mp.versao}`,
      aliquota2027: mp.valor.aliquota,
      descricao: mp.descricao,
      mensagem: `Sujeito ao Imposto Seletivo na MP 1.399/2026 (${mp.descricao}: ${pct} a partir de 02/02/2027).`,
    };
  }

  const prefixoLc = CATALOGO_RFB.ncmsImpostoSeletivoLc214
    .filter((p) => ncmLimpo.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  if (prefixoLc) {
    return {
      incidencia: 'PREVISTO_LC_214',
      regraId: null,
      aliquota2027: null,
      prefixo: prefixoLc,
      mensagem: `NCM alcançado pelo Imposto Seletivo na base da Receita Federal (prefixo ${prefixoLc}: veículos, embarcações, aeronaves ou bens minerais), ainda sem alíquota cadastrada na Onda 1.`,
    };
  }

  return {
    incidencia: 'NAO_INCIDE',
    regraId: null,
    aliquota2027: null,
    mensagem: 'NCM fora da lista de incidência do Imposto Seletivo.',
  };
}

function ordenarSugestoes(lista: SugestaoClassificacao[]): SugestaoClassificacao[] {
  return lista.sort(
    (a, b) => Number(b.reducao) - Number(a.reducao) || a.cClassTrib.localeCompare(b.cClassTrib),
  );
}

function sugestaoPadraoIntegral(
  tipo: 'NCM' | 'NBS',
  codigoFormatado: string,
): SugestaoClassificacao {
  const complemento =
    tipo === 'NCM'
      ? ' Reduções sem anexo de NCM (medicamentos registrados na Anvisa nos códigos 200009, 200032 e 200053, ou produtos in natura no 200036) dependem de requisito sanitário ou de estado natural.'
      : ' Serviços sem anexo de NBS (como profissões intelectuais regulamentadas com redução de 30% no código 200052, art. 127) dependem do enquadramento profissional e societário.';
  return {
    cst: '000',
    cClassTrib: TRIBUTACAO_INTEGRAL,
    descricao: 'Situações tributadas integralmente pelo IBS e CBS',
    reducao: '0',
    artigo: 'Regra geral (LC 214/2025)',
    anexo: null,
    tpRbsn: 1,
    confianca: 'PADRAO',
    motivo: `${tipo} ${codigoFormatado} não consta nos anexos de alíquota zero ou redução por ${tipo} da LC 214/2025.${complemento}`,
    itensAnexo: [],
    suportadoNaCalculadora: true,
    regraId: null,
  };
}

/** Sugere CST e cClassTrib a partir de um NCM de 8 dígitos e, se pedido, valida um cClassTrib. */
export function classificarPorNcm(
  ncm: string,
  opcoes: { readonly cClassTrib?: string; readonly regras?: readonly Regra[] } = {},
): ResultadoClassificacao {
  const codigo = formatarNcm(ncm);
  const limpo = soDigitos(codigo);
  const encontradas: Array<{ entrada: EntradaCatalogo; itens: ItemAnexo[] }> = [];

  for (const entrada of CATALOGO_RFB.classificacoes) {
    if (entrada.vinculosNcm.length === 0) continue;
    const av = avaliarVinculosContraAnexo(limpo, entrada.vinculosNcm);
    if (av.aceito) encontradas.push({ entrada, itens: av.itens });
  }

  const sugestoes: SugestaoClassificacao[] = [];

  // Caso legal explícito sem linha em NCM_APLICAVEL: art. 147 cita nominalmente o NCM 9619.00.00.
  if (limpo === NCM_SAUDE_MENSTRUAL) {
    const e200013 = POR_CODIGO.get('200013');
    if (e200013) {
      sugestoes.push({
        cst: e200013.cst,
        cClassTrib: e200013.cClassTrib,
        descricao: e200013.descricao,
        reducao: e200013.reducao,
        artigo: e200013.artigo,
        anexo: null,
        tpRbsn: e200013.tpRbsn,
        confianca: 'MEDIA',
        motivo:
          'Código 9619.00.00 citado no art. 147 da LC 214/2025: alíquota zero apenas para tampões higiênicos, absorventes higiênicos e coletores menstruais (fraldas seguem na tributação integral 000001).',
        itensAnexo: [],
        suportadoNaCalculadora: true,
        regraId: 'reducao.cclasstrib-200013',
      });
    }
  }

  const gerais = encontradas.filter((x) => !DEPENDE_DESTINACAO.has(x.entrada.cClassTrib));
  const multiplasGerais = gerais.length + sugestoes.length > 1;
  for (const { entrada, itens } of encontradas) {
    const exigeDestinacao = DEPENDE_DESTINACAO.has(entrada.cClassTrib);
    const confianca: GrauConfianca = exigeDestinacao || multiplasGerais ? 'MEDIA' : 'ALTA';
    const itemRef = itens[0]?.numero
      ? `, item ${itens[0].numero}${itens[0].descricao ? ` (${itens[0].descricao})` : ''}`
      : '';
    const motivo = exigeDestinacao
      ? `Consta no Anexo ${entrada.anexo} da LC 214/2025 (${entrada.artigo}${itemRef}); exige confirmar a destinação prevista no artigo.`
      : multiplasGerais
        ? `Consta no Anexo ${entrada.anexo} da LC 214/2025 (${entrada.artigo}${itemRef}), mas este NCM aparece em mais de um anexo de produto: confirme a descrição no item.`
        : `Consta no Anexo ${entrada.anexo} da LC 214/2025 (${entrada.artigo}${itemRef}); confira se a descrição comercial atende ao texto do item.`;
    sugestoes.push({
      cst: entrada.cst,
      cClassTrib: entrada.cClassTrib,
      descricao: entrada.descricao,
      reducao: entrada.reducao,
      artigo: entrada.artigo,
      anexo: entrada.anexo,
      tpRbsn: entrada.tpRbsn,
      confianca,
      motivo,
      itensAnexo: itens,
      suportadoNaCalculadora: true,
      regraId: `reducao.cclasstrib-${entrada.cClassTrib}`,
    });
  }

  ordenarSugestoes(sugestoes);
  if (sugestoes.length === 0) {
    sugestoes.push(sugestaoPadraoIntegral('NCM', codigo));
  }

  return {
    tipo: 'NCM',
    codigo,
    codigoLimpo: limpo,
    sugestoes,
    impostoSeletivo: enquadrarImpostoSeletivo(limpo, opcoes.regras),
    validacao: opcoes.cClassTrib ? criticarNcmNoAnexo(codigo, opcoes.cClassTrib) : null,
    fonte: CATALOGO_RFB.fonte,
  };
}

/** Sugere CST e cClassTrib a partir de uma NBS de 9 dígitos e, se pedido, valida um cClassTrib. */
export function classificarPorNbs(
  nbs: string,
  opcoes: { readonly cClassTrib?: string } = {},
): ResultadoClassificacao {
  const codigo = formatarNbs(nbs);
  const limpo = soDigitos(codigo);
  const encontradas: Array<{ entrada: EntradaCatalogo; itens: ItemAnexo[] }> = [];

  for (const entrada of CATALOGO_RFB.classificacoes) {
    if (entrada.vinculosNbs.length === 0) continue;
    const av = avaliarVinculosContraAnexo(limpo, entrada.vinculosNbs);
    if (av.aceito) encontradas.push({ entrada, itens: av.itens });
  }

  const multiplas = encontradas.length > 1;
  const sugestoes: SugestaoClassificacao[] = encontradas.map(({ entrada, itens }) => {
    const exigeDestinacao = DEPENDE_DESTINACAO.has(entrada.cClassTrib);
    const confianca: GrauConfianca = multiplas || exigeDestinacao ? 'MEDIA' : 'ALTA';
    const itemRef = itens[0]?.numero
      ? `, item ${itens[0].numero}${itens[0].descricao ? ` (${itens[0].descricao})` : ''}`
      : '';
    const motivo = multiplas
      ? `Consta no Anexo ${entrada.anexo} da LC 214/2025 (${entrada.artigo}${itemRef}), mas esta NBS aparece em mais de um tratamento: confirme o serviço prestado.`
      : `Consta no Anexo ${entrada.anexo} da LC 214/2025 (${entrada.artigo}${itemRef}).`;
    return {
      cst: entrada.cst,
      cClassTrib: entrada.cClassTrib,
      descricao: entrada.descricao,
      reducao: entrada.reducao,
      artigo: entrada.artigo,
      anexo: entrada.anexo,
      tpRbsn: entrada.tpRbsn,
      confianca,
      motivo,
      itensAnexo: itens,
      suportadoNaCalculadora: true,
      regraId: `reducao.cclasstrib-${entrada.cClassTrib}`,
    };
  });

  ordenarSugestoes(sugestoes);
  if (sugestoes.length === 0) {
    sugestoes.push(sugestaoPadraoIntegral('NBS', codigo));
  }

  return {
    tipo: 'NBS',
    codigo,
    codigoLimpo: limpo,
    sugestoes,
    impostoSeletivo: null,
    validacao: opcoes.cClassTrib ? criticarNbsNoAnexo(codigo, opcoes.cClassTrib) : null,
    fonte: CATALOGO_RFB.fonte,
  };
}

/** Catálogo oficial das 15 atividades do Simples Nacional (NT 2026.005 v1.00). */
export function atividadesSimplesNacional(): readonly AtividadeSimples[] {
  return CATALOGO_RFB.simplesNacional.atividades as readonly AtividadeSimples[];
}

/** Efeitos oficiais do Tipo de Receita Bruta do Simples Nacional (tpRBSN, NT 2026.005 v1.00). */
export function tiposReceitaBrutaSimples(): readonly TipoReceitaBrutaSimples[] {
  return CATALOGO_RFB.simplesNacional.tiposReceitaBruta;
}

/**
 * Fator de deslocamento CBS -> IBS em compras governamentais (tpEnteGov 2, 3 ou 4) no Simples
 * Nacional (NT 2026.005, seção 5.3.3; arts. 372 e 473 da LC 214/2025).
 */
export function fatorTransicaoCompraGovSimples(anoOuData: number | string): string {
  const data = typeof anoOuData === 'number' ? `${anoOuData}-07-01` : anoOuData;
  const linha = CATALOGO_RFB.simplesNacional.transicaoCompraGovernamental.find(
    (t) => data >= t.inicio && (t.fim === null || data <= t.fim),
  );
  if (!linha) {
    throw new RangeError(
      `Data ${data} fora da tabela de transição de compras governamentais do Simples Nacional (vigência a partir de 2027-01-01).`,
    );
  }
  return linha.fator;
}

const ANEXOS_ORDEM: readonly AnexoSimples[] = ['I', 'II', 'III', 'IV', 'V'];

/**
 * Regra pura de derivação de disponibilidade e modo de Fator R de uma atividade do Simples
 * Nacional (idêntica a DerivacaoAnexosSimples da calculadora oficial da Receita Federal).
 */
export function derivarAnexosAtividadeSimples(
  atividade: Pick<AtividadeSimples, 'anexoSemFatorR' | 'anexoComFatorR'>,
  anexosConfigurados: ReadonlySet<AnexoSimples> | null = null,
): {
  readonly disponivel: boolean;
  readonly anexosFaltantes: readonly AnexoSimples[];
  readonly modoFatorR: ModoFatorR;
} {
  if (atividade.anexoComFatorR !== null && atividade.anexoSemFatorR === null) {
    throw new Error('Atividade inconsistente: anexoComFatorR preenchido sem anexoSemFatorR.');
  }
  const configurados = anexosConfigurados ?? new Set<AnexoSimples>(ANEXOS_ORDEM);
  const possiveis = ANEXOS_ORDEM.filter(
    (a) => a === atividade.anexoSemFatorR || a === atividade.anexoComFatorR,
  );
  const anexosFaltantes = possiveis.filter((a) => !configurados.has(a));
  const disponivel = possiveis.length === 0 || possiveis.some((a) => configurados.has(a));

  let modoFatorR: ModoFatorR;
  if (atividade.anexoComFatorR === null) {
    modoFatorR = 'NAO_APLICAVEL';
  } else if (configurados.has(atividade.anexoComFatorR)) {
    modoFatorR =
      atividade.anexoSemFatorR !== null && configurados.has(atividade.anexoSemFatorR)
        ? 'OPCIONAL'
        : 'OBRIGATORIO';
  } else {
    modoFatorR = 'INDISPONIVEL';
  }

  return { disponivel, anexosFaltantes, modoFatorR };
}

const REGRAS_SERVICO: readonly Regra[] = CATALOGO_RFB.classificacoes
  .filter((c) => SET_SERVICO_SUPORTADOS.has(c.cClassTrib))
  .map((c): Regra => ({
    id: `reducao.cclasstrib-${c.cClassTrib}`,
    versao: 1,
    tributo: 'REDUCAO_CBS_IBS',
    descricao: `${c.cClassTrib}: ${c.descricao}`,
    vigencia: { inicio: '2027-01-01', fim: null },
    abrangencia: {
      ncm: [],
      nbs: [],
      cClassTrib: [c.cClassTrib],
      uf: [],
      regime: [],
      elo: [],
    },
    valor: { aliquota: c.reducao },
    fonte: {
      norma: 'LC 214/2025',
      artigo: `${c.artigo}${c.anexo ? `; Anexo ${c.anexo}` : ''}; base RFB V0059`,
    },
    cenarios: [],
    status: 'PUBLICADO_EFEITO_FUTURO',
    conferencia: 'OK',
  }));

/** Regras oficiais de redução de CBS/IBS para serviços (extraídas do catálogo V0059 da RFB). */
export function regrasServicoOficiais(): readonly Regra[] {
  return REGRAS_SERVICO;
}
