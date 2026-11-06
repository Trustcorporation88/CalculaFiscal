import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Renova a sessão do Supabase a cada requisição e barra rotas logadas sem sessão.
 * A checagem de papel e de MFA acontece no layout da aplicação e, como segunda barreira, no RLS.
 */
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const chave = process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !chave) return resposta;

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (aDefinir, cabecalhos) => {
        for (const { name, value } of aDefinir) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of aDefinir) resposta.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(cabecalhos)) resposta.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const rotaLogada = ['/app', '/conta', '/mfa'].some((p) => request.nextUrl.pathname.startsWith(p));
  if (rotaLogada && !data.user) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/entrar';
    destino.search = '';
    return NextResponse.redirect(destino);
  }
  return resposta;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|monitoramento|.*\\.(?:svg|png|jpg|ico|webp)$).*)',
  ],
};
