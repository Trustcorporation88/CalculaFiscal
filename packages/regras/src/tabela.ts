import { PACOTE } from './pacote.gerado.js';
import { ArquivoRegras, type Regra } from './schema.js';

export interface TabelaDeRegras {
  readonly regras: readonly Regra[];
  /** Impressão digital dos arquivos de regras (SHA-256, 12 primeiros caracteres). */
  readonly versao: string;
}

/** Valida o conteúdo de cada arquivo de regras. Falha se houver id@versão duplicado. */
export function montarRegras(
  arquivos: readonly { readonly nome: string; readonly conteudo: unknown }[],
): Regra[] {
  const regras: Regra[] = [];
  const vistos = new Set<string>();
  for (const { nome, conteudo } of arquivos) {
    const { regras: lidas } = ArquivoRegras.parse(conteudo);
    for (const r of lidas) {
      const chave = `${r.id}@${r.versao}`;
      if (vistos.has(chave)) throw new Error(`Regra duplicada: ${chave} (${nome})`);
      vistos.add(chave);
      regras.push(r);
    }
  }
  return regras;
}

let tabela: TabelaDeRegras | undefined;

/**
 * As regras versionadas que acompanham este pacote (embutidas no build), validadas uma vez
 * por processo. Sem acesso a disco: serve para o site, a API e o app.
 */
export function tabelaOficial(): TabelaDeRegras {
  tabela ??= { regras: montarRegras(PACOTE.arquivos), versao: PACOTE.versao };
  return tabela;
}
