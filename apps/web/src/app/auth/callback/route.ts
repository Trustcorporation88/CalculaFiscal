import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { urlDoSite } from '@/lib/env';
import { supabaseServidor } from '@/lib/supabase/server';

const TIPOS: readonly EmailOtpType[] = ['signup', 'magiclink', 'email', 'recovery', 'invite'];

/**
 * Retorno dos links de e-mail (confirmação, link mágico e recuperação de senha).
 * Os redirecionamentos usam SITE_URL: atrás do proxy do Railway, request.url aponta para o
 * endereço interno do contêiner (localhost:8080), que não existe para o navegador.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const site = urlDoSite();
  const supabase = await supabaseServidor();
  const falha = NextResponse.redirect(new URL('/entrar?erro=link_invalido', site));

  const tokenHash = params.get('token_hash');
  const tipo = params.get('type');
  if (tokenHash && tipo && (TIPOS as readonly string[]).includes(tipo)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tipo as EmailOtpType,
    });
    if (error) return falha;
    const destino = tipo === 'recovery' ? '/conta/nova-senha' : '/app';
    return NextResponse.redirect(new URL(destino, site));
  }

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? falha : NextResponse.redirect(new URL('/app', site));
  }

  return falha;
}
