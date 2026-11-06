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

/**
 * O que a tela e as planilhas dizem sobre o tratamento do produto. A sugestão pelo NCM ainda não
 * existe: o enquadramento é escolha de quem informa, e o aviso pede a conferência no anexo.
 */
export function avisoTratamento(t: TratamentoInformado | null): string {
  if (!t) {
    return 'Tributação integral de CBS e IBS. Se o produto tiver redução ou alíquota zero da LC 214/2025 (cesta básica, hortícolas, medicamentos, alimentos do Anexo VII e outros), escolha o tratamento (cClassTrib). A sugestão automática pelo NCM ainda não está disponível.';
  }
  return `Tratamento ${t.codigo} aplicado de 2027 em diante, na compra e na venda: ${rotuloReducao(t.reducao)} de CBS e IBS (${t.descricao}). Confirme que o NCM do produto consta no anexo correspondente; a conferência automática pelo NCM ainda não está disponível.`;
}

export const AVISO_LOTE =
  'Cada produto usa o tratamento da coluna cClassTrib (vazio = tributação integral) de 2027 em diante, na compra e na venda. Confirme que o NCM de cada produto consta no anexo do tratamento informado; a conferência automática pelo NCM ainda não está disponível.';
