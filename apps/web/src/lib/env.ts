import { z } from 'zod';

const Publico = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

/** Variáveis públicas validadas. Falha cedo, com mensagem clara, se faltar configuração. */
export function envPublico() {
  return Publico.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
  });
}

/** URL pública do site, usada nos links de e-mail (link mágico e confirmação). */
export function urlDoSite(): string {
  return process.env['SITE_URL'] ?? 'http://localhost:3000';
}
