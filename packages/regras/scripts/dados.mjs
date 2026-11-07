// Leitura dos YAML de dados/, comum ao gerador do pacote e ao assinador.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));

/** Arquivos de regras em ordem e a impressão digital (mesmo algoritmo de versaoDasRegras). */
export function lerDados() {
  const dados = join(RAIZ, 'dados');
  const hash = createHash('sha256');
  const arquivos = [];
  for (const nome of readdirSync(dados)
    .filter((f) => f.endsWith('.yaml'))
    .sort()) {
    const bytes = readFileSync(join(dados, nome));
    hash.update(nome).update('\u0000').update(bytes).update('\u0000');
    arquivos.push({ nome, conteudo: parse(bytes.toString('utf8')) });
  }
  return { versao: hash.digest('hex').slice(0, 12), arquivos };
}

/** Grava num temporário e renomeia: build, typecheck e test podem gerar ao mesmo tempo. */
export function gravarAtomico(destino, texto) {
  const temporario = `${destino}.${process.pid}.tmp`;
  writeFileSync(temporario, texto);
  renameSync(temporario, destino);
}
