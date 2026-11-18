// Gera src/pacote.gerado.ts com o conteúdo dos YAML de dados/, para embutir as regras no
// bundle (site, API e app) sem ler arquivos em tempo de execução, e src/catalogo.gerado.ts com o
// catálogo oficial de anexos NCM/NBS, IS e Simples Nacional da Receita Federal (fontes/).
// O catálogo fica fora de PACOTE para preservar o hash e a assinatura Ed25519 das alíquotas.
import { readFileSync } from 'node:fs';
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

const catalogo = JSON.parse(
  readFileSync(join(RAIZ, 'fontes', 'rfb-rtc-anexos-V0059.json'), 'utf8'),
);
const saidaCatalogo = `// Gerado por scripts/gerar-pacote.mjs a partir de fontes/rfb-rtc-anexos-V0059.json. Não edite.
export const CATALOGO_RFB = ${JSON.stringify(catalogo, null, 2)} as const;
`;
gravarAtomico(join(RAIZ, 'src', 'catalogo.gerado.ts'), saidaCatalogo);

console.log(`regras: pacote ${versao} com ${arquivos.length} arquivos + catálogo RFB`);
