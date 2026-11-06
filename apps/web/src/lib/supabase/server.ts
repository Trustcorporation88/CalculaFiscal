import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { envPublico } from '../env';

/** Cliente Supabase para Server Components, Server Actions e Route Handlers. */
export async function supabaseServidor() {
  // cookies() primeiro: marca a rota como dinâmica antes de qualquer leitura de configuração.
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = envPublico();
  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (aDefinir) => {
        try {
          for (const { name, value, options } of aDefinir) cookieStore.set(name, value, options);
        } catch {
          // Server Components não podem gravar cookies; o proxy renova a sessão.
        }
      },
    },
  });
}

/** Usuário autenticado validado no servidor de Auth (não confia só no cookie). */
export async function usuarioAtual() {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, usuario: null } as const;
  return { supabase, usuario: data.user } as const;
}
