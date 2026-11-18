import { D } from '@calculafiscal/motor-fiscal';
import type { ValoresFormulario } from './entrada';

/**
 * Leitor seguro de XML da NF-e (modelo 55 / NFC-e 65, leiaute 4.00 + grupo IBSCBS de 2026).
 * Roda no navegador e no servidor sem dependências nativas, bloqueando entidades externas (XXE)
 * e arquivos acima de 5 MB. Nunca inventa alíquota ausente: informa em `observacoes` quando o
 * item veio com ST retida anteriormente (ICMS60/CSOSN 500) ou PIS/Cofins sem alíquota destacada.
 */

export const LIMITE_BYTES_XML = 5 * 1024 * 1024;

export interface ItemXmlNfe {
  readonly numeroItem: number;
  readonly codigoProduto: string;
  readonly descricao: string;
  readonly ncm: string;
  readonly quantidade: string;
  readonly valores: ValoresFormulario;
  readonly observacoes: readonly string[];
}

export type ResultadoLeituraXml =
  | {
      readonly ok: true;
      readonly chaveOuNumero: string | null;
      readonly emitente: string | null;
      readonly itens: readonly ItemXmlNfe[];
    }
  | { readonly ok: false; readonly erro: string };

const decodificarEntidadesXml = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

/** Extrai o conteúdo da primeira ocorrência de uma tag (ignorando eventual prefixo de namespace). */
function tag(bloco: string, nome: string): string | null {
  const re = new RegExp(
    `<(?:[A-Za-z0-9_]+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${nome}>`,
  );
  const m = re.exec(bloco);
  return m?.[1] !== undefined ? decodificarEntidadesXml(m[1].trim()) : null;
}

function decOuZero(texto: string | null): InstanceType<typeof D> {
  if (!texto) return new D(0);
  const limpo = texto.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(limpo) ? new D(limpo) : new D(0);
}

function formatarBr(valor: InstanceType<typeof D>, casasMaximas = 4): string {
  const fixo = valor.toDecimalPlaces(casasMaximas, D.ROUND_HALF_UP);
  const texto = casasMaximas === 2 ? fixo.toFixed(2) : fixo.toFixed();
  return texto.replace('.', ',');
}

function formatarMoedaBr(valor: InstanceType<typeof D>): string {
  return valor.toDecimalPlaces(2, D.ROUND_HALF_UP).toFixed(2).replace('.', ',');
}

function extrairBlocosDet(xml: string): Array<{ nItem: number; conteudo: string }> {
  const re = /<(?:[A-Za-z0-9_]+:)?det\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?det>/g;
  const itens: Array<{ nItem: number; conteudo: string }> = [];
  let m: RegExpExecArray | null;
  let indice = 1;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1] ?? '';
    const nItemMatch = /\bnItem\s*=\s*["'](\d+)["']/.exec(attrs);
    const nItem = nItemMatch ? Number(nItemMatch[1]) : indice;
    itens.push({ nItem, conteudo: m[2] ?? '' });
    indice++;
  }
  return itens;
}

/** Lê um XML de NF-e/NFC-e e devolve os itens convertidos para o formato da calculadora. */
export function lerXmlNfe(xmlTexto: string): ResultadoLeituraXml {
  const bytes = new TextEncoder().encode(xmlTexto).byteLength;
  if (bytes === 0) {
    return { ok: false, erro: 'O arquivo XML está vazio.' };
  }
  if (bytes > LIMITE_BYTES_XML) {
    return { ok: false, erro: 'XML maior que o limite de 5 MB.' };
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xmlTexto)) {
    return {
      ok: false,
      erro: 'XML recusado por segurança: declarações DOCTYPE ou ENTITY não são permitidas.',
    };
  }
  if (!/<(?:[A-Za-z0-9_]+:)?infNFe\b/.test(xmlTexto)) {
    return {
      ok: false,
      erro: 'Este arquivo não parece ser um XML de NF-e ou NFC-e (tag infNFe ausente).',
    };
  }

  const dets = extrairBlocosDet(xmlTexto);
  if (dets.length === 0) {
    return { ok: false, erro: 'Nenhum item (<det>) encontrado no XML da NF-e.' };
  }

  const ide = tag(xmlTexto, 'ide') ?? '';
  const numeroNota = tag(ide, 'nNF');
  const serieNota = tag(ide, 'serie');
  const emit = tag(xmlTexto, 'emit') ?? '';
  const emitente = tag(emit, 'xNome');
  const chaveOuNumero = numeroNota ? `NF-e ${numeroNota}${serieNota ? `/${serieNota}` : ''}` : null;

  const itens: ItemXmlNfe[] = [];

  for (const det of dets) {
    const prod = tag(det.conteudo, 'prod');
    if (!prod) continue;
    const imposto = tag(det.conteudo, 'imposto') ?? '';
    const observacoes: string[] = [];

    const codigoProduto = tag(prod, 'cProd') ?? '';
    const descricao = (tag(prod, 'xProd') ?? `Item ${det.nItem}`).slice(0, 120);
    const ncmDigitos = (tag(prod, 'NCM') ?? '').replace(/\D/g, '');
    const ncm =
      ncmDigitos.length === 8
        ? `${ncmDigitos.slice(0, 4)}.${ncmDigitos.slice(4, 6)}.${ncmDigitos.slice(6, 8)}`
        : '';

    let qCom = decOuZero(tag(prod, 'qCom'));
    if (qCom.lte(0)) qCom = decOuZero(tag(prod, 'qTrib'));
    if (qCom.lte(0)) qCom = new D(1);

    const vProd = decOuZero(tag(prod, 'vProd'));
    const vFrete = decOuZero(tag(prod, 'vFrete'));
    const vSeg = decOuZero(tag(prod, 'vSeg'));
    const vOutro = decOuZero(tag(prod, 'vOutro'));
    const vDesc = decOuZero(tag(prod, 'vDesc'));

    const blocoIcms = tag(imposto, 'ICMS') ?? '';
    const pICMS = decOuZero(tag(blocoIcms, 'pICMS'));
    const pMVAST = decOuZero(tag(blocoIcms, 'pMVAST'));
    const pICMSST = decOuZero(tag(blocoIcms, 'pICMSST'));
    const vICMSST = decOuZero(tag(blocoIcms, 'vICMSST'));
    const stRetidoAnteriormente = /<(?:[A-Za-z0-9_]+:)?ICMS60\b|<CSOSN>500<\/CSOSN>/.test(
      blocoIcms,
    );
    if (stRetidoAnteriormente && pICMS.isZero()) {
      observacoes.push(
        'ICMS-ST retido em etapa anterior (ICMS60/CSOSN 500): a nota não destaca a alíquota original da indústria; se quiser projetar a queda da ST de 2029 a 2033, informe as alíquotas do fabricante.',
      );
    }

    const blocoIpi = tag(imposto, 'IPI') ?? '';
    const pIPI = decOuZero(tag(blocoIpi, 'pIPI'));
    const vIPI = decOuZero(tag(blocoIpi, 'vIPI'));

    const blocoPis = tag(imposto, 'PIS') ?? '';
    const blocoCofins = tag(imposto, 'COFINS') ?? '';
    const pPIS = decOuZero(tag(blocoPis, 'pPIS'));
    const pCOFINS = decOuZero(tag(blocoCofins, 'pCOFINS'));
    const pPisCofins = pPIS.plus(pCOFINS);
    const pisNaoTributado = /<(?:[A-Za-z0-9_]+:)?PISNT\b/.test(blocoPis);
    if (pisNaoTributado && pPisCofins.isZero()) {
      observacoes.push(
        'PIS/Cofins sem alíquota destacada (PISNT, comum em revenda monofásica ou alíquota zero): se a compra veio direto da indústria com PIS/Cofins embutido, preencha o percentual.',
      );
    }

    const blocoIbsCbs = tag(imposto, 'IBSCBS') ?? '';
    const cClassTribXml = tag(blocoIbsCbs, 'cClassTrib');
    const cClassTrib = cClassTribXml && /^\d{6}$/.test(cClassTribXml) ? cClassTribXml : '000001';

    const freteTotal = D.max(new D(0), vFrete.plus(vSeg).plus(vOutro));
    const totalItem = vProd.minus(vDesc).plus(vIPI).plus(vICMSST).plus(freteTotal);
    if (totalItem.lte(0)) {
      observacoes.push('Valor total do item menor ou igual a zero no XML.');
    }
    const notaUnitaria = D.max(new D('0.01'), totalItem.div(qCom));
    const freteUnitario = freteTotal.div(qCom);

    const temSt = vICMSST.gt(0) || (pMVAST.gt(0) && pICMSST.gt(0));
    const valores: Record<string, string> = {
      natureza: 'MERCADORIA',
      descricao,
      ncm,
      cClassTrib,
      notaCompra: formatarMoedaBr(notaUnitaria),
      aliquotaIcms: formatarBr(pICMS),
      aliquotaIpi: formatarBr(pIPI),
      aliquotaPisCofins: formatarBr(pPisCofins),
      freteEDespesas: formatarMoedaBr(freteUnitario),
      temSt: temSt ? 'on' : '',
      mva: temSt ? formatarBr(pMVAST) : '',
      aliquotaInterna: temSt ? formatarBr(pICMSST.gt(0) ? pICMSST : pICMS) : '',
    };

    itens.push({
      numeroItem: det.nItem,
      codigoProduto,
      descricao,
      ncm,
      quantidade: formatarBr(qCom),
      valores,
      observacoes,
    });
  }

  if (itens.length === 0) {
    return { ok: false, erro: 'Nenhum produto válido (<prod>) encontrado no XML da NF-e.' };
  }

  return { ok: true, chaveOuNumero, emitente, itens };
}

/** Junta itens de um ou mais XMLs de NF-e para uso direto na simulação em lote. */
export function itensDeMultiplosXmls(
  arquivos: readonly { readonly nome: string; readonly conteudo: string }[],
  limiteItens: number,
):
  | {
      readonly ok: true;
      readonly linhas: ValoresFormulario[];
      readonly avisosGerais: readonly string[];
    }
  | { readonly ok: false; readonly erro: string } {
  if (arquivos.length === 0) {
    return { ok: false, erro: 'Nenhum arquivo XML selecionado.' };
  }
  const linhas: ValoresFormulario[] = [];
  const avisosGerais: string[] = [];

  for (const arq of arquivos) {
    const r = lerXmlNfe(arq.conteudo);
    if (!r.ok) {
      return { ok: false, erro: `${arq.nome}: ${r.erro}` };
    }
    const prefixoNota = r.chaveOuNumero ?? arq.nome;
    for (const item of r.itens) {
      linhas.push({
        ...item.valores,
        descricao: `${prefixoNota} #${item.numeroItem}: ${item.descricao}`.slice(0, 120),
      });
      for (const obs of item.observacoes) {
        avisosGerais.push(`${prefixoNota} item ${item.numeroItem}: ${obs}`);
      }
    }
  }

  if (linhas.length > limiteItens) {
    return {
      ok: false,
      erro: `Os XMLs somam ${linhas.length} itens; o limite por lote é ${limiteItens}.`,
    };
  }

  return { ok: true, linhas, avisosGerais };
}
