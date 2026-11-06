import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServidor } from '@/lib/supabase/server';

const TIPOS: readonly EmailOtpType[] = ['signup', 'magiclink', 'email', 'recovery', 'invite'];

/** Retorno dos links de e-mail (confirmação de cadastro e link mágico). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const supabase = await supabaseServidor();
  const destino = new URL('/app', request.url);
  const falha = new URL('/entrar?erro=link_invalido', request.url);

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(error ? falha : destino);
  }

  const tokenHash = params.get('token_hash');
  const tipo = params.get('type');
  if (tokenHash && tipo && (TIPOS as readonly string[]).includes(tipo)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tipo as EmailOtpType,
    });
    return NextResponse.redirect(error ? falha : destino);
  }

  return NextResponse.redirect(falha);
}
