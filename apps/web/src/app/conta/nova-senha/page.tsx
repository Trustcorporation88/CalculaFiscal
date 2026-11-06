import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Aviso } from '@/components/aviso';
import { supabaseServidor, usuarioAtual } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Nova senha | CalculaFiscal' };

const NovaSenha = z.object({ senha: z.string().min(10).max(200), confirmacao: z.string() });

async function trocarSenha(form: FormData) {
  'use server';
  const dados = NovaSenha.safeParse({
    senha: form.get('senha'),
    confirmacao: form.get('confirmacao'),
  });
  if (!dados.success) redirect('/conta/nova-senha?erro=senha_fraca');
  if (dados.data.senha !== dados.data.confirmacao)
    redirect('/conta/nova-senha?erro=senhas_diferentes');
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.updateUser({ password: dados.data.senha });
  if (error) {
    if (error.code === 'weak_password') redirect('/conta/nova-senha?erro=senha_fraca');
    redirect('/conta/nova-senha?erro=falha');
  }
  redirect('/app?aviso=senha_alterada');
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Chega aqui pelo link de recuperação (sessão criada no /auth/callback) ou logado. */
export default async function PaginaNovaSenha({ searchParams }: Props) {
  const { usuario } = await usuarioAtual();
  if (!usuario) redirect('/entrar');
  const { erro } = await searchParams;
  return (
    <main className="cartao-auth">
      <h1>Criar nova senha</h1>
      <Aviso erro={erro} />
      <form action={trocarSenha} className="formulario">
        <label htmlFor="senha">Nova senha</label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          aria-describedby="senha-ajuda"
        />
        <p id="senha-ajuda" className="ajuda">
          Pelo menos 10 caracteres.
        </p>
        <label htmlFor="confirmacao">Repita a nova senha</label>
        <input
          id="confirmacao"
          name="confirmacao"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <button type="submit">Salvar nova senha</button>
      </form>
    </main>
  );
}
