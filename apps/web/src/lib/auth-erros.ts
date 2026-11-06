/**
 * Cota de e-mails do projeto inteiro esgotada (SMTP padrão do Supabase). Por ser global, avisar
 * não revela se uma conta existe, e esconder faria a pessoa esperar um e-mail que não foi enviado.
 */
export function cotaDeEmailEsgotada(erro: { code?: string | undefined } | null): boolean {
  return erro?.code === 'over_email_send_rate_limit';
}
