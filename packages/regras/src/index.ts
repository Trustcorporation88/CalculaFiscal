import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ArquivoRegras, type Regra } from './schema.js';

export * from './schema.js';
export { vigentesEm } from './vigencia.js';
export * from './resolver.js';

/** Carrega e valida todos os arquivos YAML de um diretório. Falha se houver id@versão duplicado. */
export function carregarRegras(diretorio: string): Regra[] {
  const regras: Regra[] = [];
  const vistos = new Set<string>();
  for (const arquivo of readdirSync(diretorio)
    .filter((f) => f.endsWith('.yaml'))
    .sort()) {
    const conteudo: unknown = parse(readFileSync(join(diretorio, arquivo), 'utf8'));
    const { regras: lidas } = ArquivoRegras.parse(conteudo);
    for (const r of lidas) {
      const chave = `${r.id}@${r.versao}`;
      if (vistos.has(chave)) throw new Error(`Regra duplicada: ${chave} (${arquivo})`);
      vistos.add(chave);
      regras.push(r);
    }
  }
  return regras;
}
