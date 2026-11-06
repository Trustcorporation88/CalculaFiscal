import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Aviso } from '@/components/aviso';
import { supabaseServidor, usuarioAtual } from '@/lib/supabase/server';
import { BotaoEnviar } from '@/components/botao-enviar';

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
    // Sessão antiga com secure_password_change: repetir o formulário não resolve.
    // O link de recuperação cria uma sessão nova, que satisfaz a exigência.
    if (error.code === 'reauthentication_needed') redirect('/recuperar-senha?aviso=reautenticar');
    redirect('/conta/nova-senha?erro=falha');
  }
  // Confirmação na própria página: /app pode redirecionar (ex.: para criar organização) e perder o aviso.
  redirect('/conta/nova-senha?aviso=senha_alterada');
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Chega aqui pelo link de recuperação (sessão criada no /auth/callback) ou logado. */
export default async function PaginaNovaSenha({ searchParams }: Props) {
  const { usuario } = await usuarioAtual();
  if (!usuario) redirect('/entrar');
  const { erro, aviso } = await searchParams;
  if (aviso === 'senha_alterada') {
    return (
      <main className="cartao-auth">
        <h1>Senha alterada</h1>
        <Aviso aviso={aviso} />
        <p>
          <Link href="/app">Continuar</Link>
        </p>
      </main>
    );
  }
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
        <BotaoEnviar>Salvar nova senha</BotaoEnviar>
      </form>
    </main>
  );
}
