import { generateKeyPairSync, sign, verify, createPublicKey } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { deBase64, verificarPacote, type PacoteAssinado } from '../src/assinatura.js';
import { CHAVE_PUBLICA_REGRAS } from '../src/chave-publica.js';
import { PACOTE } from '../src/pacote.gerado.js';
import { PACOTE_ASSINADO } from '../src/pacote-assinado.js';

describe('pacote de regras assinado', () => {
  it('está assinado com a versão atual das regras (rode "pnpm --filter @calculafiscal/regras assinar")', () => {
    expect(PACOTE_ASSINADO.versao).toBe(PACOTE.versao);
    const conteudo = JSON.parse(PACOTE_ASSINADO.conteudo) as {
      versao: string;
      publicadoEm: string;
      arquivos: unknown;
    };
    expect(conteudo.versao).toBe(PACOTE.versao);
    expect(conteudo.publicadoEm).toBe(PACOTE_ASSINADO.publicadoEm);
    expect(conteudo.arquivos).toEqual(PACOTE.arquivos);
  });

  it('a assinatura confere com a chave pública embutida (Node e a verificação do app)', () => {
    const publica = createPublicKey({
      key: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: Buffer.from(CHAVE_PUBLICA_REGRAS.base64, 'base64').toString('base64url'),
      },
      format: 'jwk',
    });
    expect(
      verify(
        null,
        Buffer.from(PACOTE_ASSINADO.conteudo, 'utf8'),
        publica,
        Buffer.from(PACOTE_ASSINADO.assinatura, 'base64'),
      ),
    ).toBe(true);
    const r = verificarPacote(PACOTE_ASSINADO);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tabela.versao).toBe(PACOTE.versao);
      expect(r.tabela.regras.length).toBeGreaterThan(10);
    }
  });

  it('recusa conteúdo alterado, mesmo com a assinatura original', () => {
    const adulterado: PacoteAssinado = {
      ...PACOTE_ASSINADO,
      conteudo: PACOTE_ASSINADO.conteudo.replace('"aliquota":"0.009"', '"aliquota":"0.001"'),
    };
    expect(adulterado.conteudo).not.toBe(PACOTE_ASSINADO.conteudo);
    expect(verificarPacote(adulterado)).toEqual({ ok: false, motivo: 'Assinatura não confere.' });
  });

  it('recusa pacote assinado por outra chave', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const x = publicKey.export({ format: 'jwk' }).x as string;
    const outra = {
      id: CHAVE_PUBLICA_REGRAS.id,
      base64: Buffer.from(x, 'base64url').toString('base64'),
    };
    const falso: PacoteAssinado = {
      ...PACOTE_ASSINADO,
      assinatura: sign(null, Buffer.from(PACOTE_ASSINADO.conteudo), privateKey).toString('base64'),
    };
    expect(verificarPacote(falso).ok).toBe(false);
    // O mesmo pacote passa quando a chave esperada é a outra: a recusa vem da chave.
    expect(verificarPacote(falso, outra).ok).toBe(true);
  });

  it('recusa formato desconhecido e lixo', () => {
    expect(verificarPacote(null).ok).toBe(false);
    expect(verificarPacote({ conteudo: 'x', assinatura: 'y', chave: 'z' })).toMatchObject({
      motivo: 'Chave desconhecida (z).',
    });
    expect(verificarPacote({ ...PACOTE_ASSINADO, assinatura: 'AAAA' })).toMatchObject({
      motivo: 'Assinatura malformada.',
    });
  });

  it('decodifica base64 como o Buffer do Node', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'Calculadora Fiscal ✓']) {
      const b64 = Buffer.from(s, 'utf8').toString('base64');
      expect(Buffer.from(deBase64(b64) as Uint8Array).toString('utf8')).toBe(s);
    }
    expect(deBase64('@@')).toBeNull();
  });
});
