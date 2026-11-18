import {
  classificarPorNcm,
  criticarNcmNoAnexo,
  formatarNcm,
} from '@calculafiscal/regras/classificacao';

/** Tratamento de CBS/IBS do produto (cClassTrib), como vem da tabela de regras. */
export interface TratamentoInformado {
  readonly codigo: string;
  readonly descricao: string;
  /** Fração reduzida: '1' = alíquota zero, '0.6' = redução de 60%. */
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

/**
 * O que a tela e as planilhas dizem sobre o tratamento do produto, conferindo o NCM informado
 * contra os anexos oficiais da Receita Federal (LC 214/2025).
 */
export function avisoTratamento(t: TratamentoInformado | null, ncm?: string | null): string {
  const ncmOk = ncmNormalizado(ncm);

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
  'Cada produto usa o tratamento da coluna cClassTrib (vazio = tributação integral) de 2027 em diante, na compra e na venda. Para consultar ou conferir os anexos oficiais por NCM, use a calculadora unitária ou GET /v1/classificacao.';
