import { describe, expect, it } from 'vitest';
import { cotaDeEmailEsgotada } from '../src/lib/auth-erros';

describe('cota de e-mail do projeto', () => {
  it('reconhece a cota global esgotada', () => {
    expect(cotaDeEmailEsgotada({ code: 'over_email_send_rate_limit' })).toBe(true);
  });
  it('não trata outros erros como cota global (evita revelar contas)', () => {
    expect(cotaDeEmailEsgotada({ code: 'over_request_rate_limit' })).toBe(false);
    expect(cotaDeEmailEsgotada({ code: 'otp_disabled' })).toBe(false);
    expect(cotaDeEmailEsgotada(null)).toBe(false);
  });
});
