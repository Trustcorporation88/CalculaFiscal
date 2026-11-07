// Assina o pacote de regras com Ed25519, para o app aceitar tabelas novas sem reinstalar.
//
// A chave privada NUNCA entra no repositório nem no servidor: fica no computador de quem publica
// (padrão: ~/.calculafiscal/regras/ed25519-privada.pem, ou CF_REGRAS_CHAVE_PRIVADA). O resultado,
// src/pacote-assinado.ts, é versionado; o site só o serve. Quem invadir o servidor não consegue
// publicar alíquotas que o app aceite.
//
//   node scripts/assinar-pacote.mjs              assina se as regras mudaram
//   node scripts/assinar-pacote.mjs --nova-chave cria o par de chaves (uma vez só)
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { gravarAtomico, lerDados, RAIZ } from './dados.mjs';

const FORMATO = 1;
const caminhoChave =
  process.env.CF_REGRAS_CHAVE_PRIVADA ??
  join(homedir(), '.calculafiscal', 'regras', 'ed25519-privada.pem');
const destinoAssinado = join(RAIZ, 'src', 'pacote-assinado.ts');
const destinoChavePublica = join(RAIZ, 'src', 'chave-publica.ts');

/** Chave pública crua (32 bytes) em base64 e um id curto para trocar de chave no futuro. */
function publicaCrua(privada) {
  const jwk = createPublicKey(privada).export({ format: 'jwk' });
  const bytes = Buffer.from(jwk.x, 'base64url');
  return { base64: bytes.toString('base64'), id: `ed25519-${bytes.toString('hex').slice(0, 8)}` };
}

if (process.argv.includes('--nova-chave')) {
  if (existsSync(caminhoChave)) {
    console.error(`Já existe uma chave em ${caminhoChave}. Não sobrescrevo.`);
    process.exit(1);
  }
  const { privateKey } = generateKeyPairSync('ed25519');
  mkdirSync(dirname(caminhoChave), { recursive: true });
  writeFileSync(caminhoChave, privateKey.export({ format: 'pem', type: 'pkcs8' }), {
    mode: 0o600,
  });
  console.log(`Chave privada criada em ${caminhoChave}. Guarde uma cópia em local seguro.`);
}

if (!existsSync(caminhoChave)) {
  console.error(`Sem chave privada em ${caminhoChave}. Rode com --nova-chave na primeira vez.`);
  process.exit(1);
}
const privada = createPrivateKey(readFileSync(caminhoChave));
const publica = publicaCrua(privada);

gravarAtomico(
  destinoChavePublica,
  `// Gerado por scripts/assinar-pacote.mjs. Não edite: a chave privada fica fora do repositório.
/** Chave pública Ed25519 que confere o pacote de regras baixado pelo app. */
export const CHAVE_PUBLICA_REGRAS = {
  id: '${publica.id}',
  base64: '${publica.base64}',
} as const;
`,
);

const { versao, arquivos } = lerDados();
const anterior = existsSync(destinoAssinado) ? readFileSync(destinoAssinado, 'utf8') : '';
const forcar = process.argv.includes('--forcar');
if (!forcar && anterior.includes(`"versao": "${versao}"`) && anterior.includes(publica.id)) {
  console.log(`regras: pacote ${versao} já está assinado.`);
  process.exit(0);
}

const publicadoEm = new Date().toISOString();
const conteudo = JSON.stringify({ formato: FORMATO, versao, publicadoEm, arquivos });
const assinatura = sign(null, Buffer.from(conteudo, 'utf8'), privada).toString('base64');

gravarAtomico(
  destinoAssinado,
  `// Gerado por scripts/assinar-pacote.mjs. Não edite: a assinatura deixaria de conferir.
import type { PacoteAssinado } from './assinatura.js';

export const PACOTE_ASSINADO: PacoteAssinado = ${JSON.stringify(
    // versao e publicadoEm por fora só para consulta rápida; o app usa os de dentro do conteúdo.
    { versao, publicadoEm, chave: publica.id, assinatura, conteudo },
    null,
    2,
  )};
`,
);
console.log(`regras: pacote ${versao} assinado com ${publica.id}.`);
