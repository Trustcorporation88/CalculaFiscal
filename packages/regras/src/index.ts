import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Regra } from './schema.js';
import { montarRegras } from './tabela.js';

export * from './schema.js';
export { vigentesEm } from './vigencia.js';
export * from './resolver.js';
export { montarRegras, tabelaOficial, type TabelaDeRegras } from './tabela.js';

const arquivosYaml = (diretorio: string) =>
  readdirSync(diretorio)
    .filter((f) => f.endsWith('.yaml'))
    .sort();

/** Carrega e valida todos os arquivos YAML de um diretório. Falha se houver id@versão duplicado. */
export function carregarRegras(diretorio: string): Regra[] {
  return montarRegras(
    arquivosYaml(diretorio).map((nome) => ({
      nome,
      conteudo: parse(readFileSync(join(diretorio, nome), 'utf8')) as unknown,
    })),
  );
}

/** Impressão digital estável do conteúdo dos arquivos YAML (mesmo algoritmo do gerador). */
export function versaoDasRegras(diretorio: string): string {
  const hash = createHash('sha256');
  for (const nome of arquivosYaml(diretorio)) {
    hash
      .update(nome)
      .update('\u0000')
      .update(readFileSync(join(diretorio, nome)))
      .update('\u0000');
  }
  return hash.digest('hex').slice(0, 12);
}
