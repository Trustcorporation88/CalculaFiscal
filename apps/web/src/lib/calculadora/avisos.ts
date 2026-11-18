import {
  classificarPorNbs,
  classificarPorNcm,
  criticarNbsNoAnexo,
  criticarNcmNoAnexo,
  formatarNbs,
  formatarNcm,
} from '@calculafiscal/regras/classificacao';
import type { NaturezaCalculo } from '@calculafiscal/regras/resolver';

/** Tratamento de CBS/IBS do produto ou serviço (cClassTrib). */
export interface TratamentoInformado {
  readonly codigo: string;
  readonly descricao: string;
  /** Fração reduzida: '1' = alíquota zero, '0.6' = redução de 60%, '0.3' = redução de 30%. */
  readonly reducao: string;
}

export const rotuloReducao = (reducao: string) =>
  reducao === '1'
    ? 'alíquota zero'
    : `redução de ${(Number(reducao) * 100).toLocaleString('pt-BR')}%`;

function ncmNormalizado(ncm?: string | null): string | null {
  if (!ncm) return null;
  try {
    return formatarNcm(ncm);
  } catch {
    return null;
  }
}

function nbsNormalizada(nbs?: string | null): string | null {
  if (!nbs) return null;
  try {
    return formatarNbs(nbs);
  } catch {
    return null;
  }
}

/**
 * O que a tela e as planilhas dizem sobre o tratamento do produto ou serviço, conferindo NCM/NBS
 * contra os anexos oficiais da Receita Federal (LC 214/2025).
 */
export function avisoTratamento(
  t: TratamentoInformado | null,
  ncmOuNbs?: string | null,
  natureza: NaturezaCalculo = 'MERCADORIA',
): string {
  if (natureza === 'SERVICO') {
    const nbsOk = nbsNormalizada(ncmOuNbs);
    if (!t) {
      if (!nbsOk) {
        return 'Tributação integral de CBS e IBS no serviço. Se houver redução (como 30% nas profissões intelectuais regulamentadas no código 200052 ou 60% em educação e saúde nos códigos 200028 e 200029), selecione o tratamento ou informe a NBS.';
      }
      const sugeridas = classificarPorNbs(nbsOk).sugestoes.filter((s) => s.cClassTrib !== '000001');
      if (sugeridas.length > 0) {
        const resumo = sugeridas
          .map(
            (s) =>
              `${s.cClassTrib} (${rotuloReducao(s.reducao)}${s.anexo ? `, Anexo ${s.anexo}` : ''}, ${s.artigo})`,
          )
          .join('; ');
        return `Tributação integral de CBS e IBS aplicada ao serviço. Atenção: a NBS ${nbsOk} consta na base da Receita Federal com tratamento diferenciado: ${resumo}.`;
      }
      return `Tributação integral de CBS e IBS no serviço. A NBS ${nbsOk} não consta nos anexos de educação ou saúde (profissões regulamentadas com redução de 30% usam o código 200052, sem anexo de NBS).`;
    }
    const baseServico = `Tratamento ${t.codigo} aplicado de 2027 em diante na prestação do serviço: ${rotuloReducao(t.reducao)} de CBS e IBS (${t.descricao}). Os insumos tributados da entrada continuam gerando crédito pela alíquota geral.`;
    if (!nbsOk) return baseServico;
    const critica = criticarNbsNoAnexo(nbsOk, t.codigo);
    if (critica.situacao === 'VINCULADO')
      return `${baseServico} Conferência oficial: ${critica.mensagem}`;
    if (critica.situacao === 'NAO_VINCULADO') return `${baseServico} Atenção: ${critica.mensagem}`;
    return `${baseServico} ${critica.mensagem}`;
  }

  const ncmOk = ncmNormalizado(ncmOuNbs);

  if (!t) {
    if (!ncmOk) {
      return 'Tributação integral de CBS e IBS. Informe o NCM de 8 dígitos para sugerir automaticamente tratamentos com redução ou alíquota zero da LC 214/2025.';
    }
    const r = classificarPorNcm(ncmOk);
    const suportadas = r.sugestoes.filter(
      (s) => s.cClassTrib !== '000001' && s.suportadoNaCalculadora,
    );
    if (suportadas.length > 0) {
      const resumo = suportadas
        .map(
          (s) =>
            `${s.cClassTrib} (${rotuloReducao(s.reducao)}${s.anexo ? `, Anexo ${s.anexo}` : ''}, ${s.artigo})`,
        )
        .join('; ');
      return `Tributação integral de CBS e IBS aplicada. Atenção: o NCM ${ncmOk} consta na tabela oficial da Receita Federal com tratamento diferenciado: ${resumo}. Se o produto atender ao texto legal, selecione esse cClassTrib.`;
    }
    return `Tributação integral de CBS e IBS. O NCM ${ncmOk} não consta nos anexos de alíquota zero ou redução por NCM da LC 214/2025 (tratamentos sem anexo, como medicamentos na Anvisa ou produtos in natura, dependem de requisito próprio).`;
  }

  const base = `Tratamento ${t.codigo} aplicado de 2027 em diante, na compra e na venda: ${rotuloReducao(t.reducao)} de CBS e IBS (${t.descricao}).`;
  if (!ncmOk) {
    return `${base} Informe o NCM de 8 dígitos para validar automaticamente contra o anexo oficial da Receita Federal.`;
  }

  const critica = criticarNcmNoAnexo(ncmOk, t.codigo);
  if (critica.situacao === 'VINCULADO') {
    return `${base} Conferência oficial: ${critica.mensagem}`;
  }
  if (critica.situacao === 'NAO_VINCULADO') {
    const sugeridas = classificarPorNcm(ncmOk).sugestoes.filter(
      (s) => s.cClassTrib !== '000001' && s.suportadoNaCalculadora,
    );
    const dica =
      sugeridas.length > 0
        ? ` Para este NCM, a tabela da Receita aponta: ${sugeridas.map((s) => `${s.cClassTrib} (${rotuloReducao(s.reducao)})`).join(', ')}.`
        : '';
    return `${base} Atenção: ${critica.mensagem}${dica}`;
  }
  return `${base} ${critica.mensagem}`;
}

export const AVISO_LOTE =
  'Cada item usa o tratamento da coluna cClassTrib (ou a tag IBSCBS do XML, quando presente; vazio = tributação integral) de 2027 em diante. Para consultar ou conferir os anexos oficiais por NCM/NBS, use a calculadora unitária ou GET /v1/classificacao.';
