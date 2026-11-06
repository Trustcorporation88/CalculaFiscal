// Gera src/pacote.gerado.ts com o conteúdo dos YAML de dados/, para embutir as regras no
// bundle (site, API e app) sem ler arquivos em tempo de execução. A validação continua no
// carregamento (tabelaOficial), com o mesmo schema Zod. Rode antes de build, typecheck e test.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const dados = join(raiz, 'dados');

const hash = createHash('sha256');
const arquivos = [];
for (const nome of readdirSync(dados)
  .filter((f) => f.endsWith('.yaml'))
  .sort()) {
  const bytes = readFileSync(join(dados, nome));
  // Mesmo algoritmo de versaoDasRegras (src/index.ts).
  hash.update(nome).update('\u0000').update(bytes).update('\u0000');
  arquivos.push({ nome, conteudo: parse(bytes.toString('utf8')) });
}
const versao = hash.digest('hex').slice(0, 12);

const saida = `// Gerado por scripts/gerar-pacote.mjs a partir de dados/*.yaml. Não edite.
export const PACOTE: {
  readonly versao: string;
  readonly arquivos: readonly { readonly nome: string; readonly conteudo: unknown }[];
} = ${JSON.stringify({ versao, arquivos }, null, 2)};
`;
// Grava num temporário e renomeia: build, typecheck e test podem gerar ao mesmo tempo.
const destino = join(raiz, 'src', 'pacote.gerado.ts');
const temporario = `${destino}.${process.pid}.tmp`;
writeFileSync(temporario, saida);
renameSync(temporario, destino);
console.log(`regras: pacote ${versao} com ${arquivos.length} arquivos`);
