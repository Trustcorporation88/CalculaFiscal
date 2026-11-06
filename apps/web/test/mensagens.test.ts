import { describe, expect, it } from 'vitest';
import { mensagem, MENSAGENS } from '../src/lib/mensagens';

describe('mensagens da URL', () => {
  it('traduz códigos conhecidos', () => {
    expect(mensagem('credenciais')).toBe(MENSAGENS.credenciais);
  });

  it('nunca reflete texto livre vindo da query (evita phishing e XSS refletido)', () => {
    expect(mensagem('<script>alert(1)</script>')).toBeNull();
    expect(mensagem('Sua conta foi bloqueada, ligue para 0800')).toBeNull();
    expect(mensagem('toString')).toBeNull();
  });

  it('ignora ausência e listas', () => {
    expect(mensagem(undefined)).toBeNull();
    expect(mensagem(['credenciais', 'dados'])).toBeNull();
  });
});
