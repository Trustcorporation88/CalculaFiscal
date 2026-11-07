// Gera src/pacote.gerado.ts com o conteúdo dos YAML de dados/, para embutir as regras no
// bundle (site, API e app) sem ler arquivos em tempo de execução. A validação continua no
// carregamento (tabelaOficial), com o mesmo schema Zod. Rode antes de build, typecheck e test.
import { join } from 'node:path';
import { gravarAtomico, lerDados, RAIZ } from './dados.mjs';

const { versao, arquivos } = lerDados();

const saida = `// Gerado por scripts/gerar-pacote.mjs a partir de dados/*.yaml. Não edite.
export const PACOTE: {
  readonly versao: string;
  readonly arquivos: readonly { readonly nome: string; readonly conteudo: unknown }[];
} = ${JSON.stringify({ versao, arquivos }, null, 2)};
`;
gravarAtomico(join(RAIZ, 'src', 'pacote.gerado.ts'), saida);
console.log(`regras: pacote ${versao} com ${arquivos.length} arquivos`);
