import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Aviso } from '@/components/aviso';
import { cotaDeEmailEsgotada } from '@/lib/auth-erros';
import { urlDoSite } from '@/lib/env';
import { supabaseServidor } from '@/lib/supabase/server';
import { BotaoEnviar } from '@/components/botao-enviar';

export const metadata: Metadata = { title: 'Recuperar senha | CalculaFiscal' };

async function pedirLink(form: FormData) {
  'use server';
  const email = z.email().max(254).safeParse(form.get('email'));
  if (!email.success) redirect('/recuperar-senha?erro=dados');
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${urlDoSite()}/auth/callback`,
  });
  if (error) {
    console.error(
      JSON.stringify({
        nivel: 'erro',
        msg: 'falha no Auth',
        operacao: 'recuperacao',
        status: error.status,
        codigo: error.code,
      }),
    );
  }
  if (cotaDeEmailEsgotada(error)) redirect('/recuperar-senha?erro=email_indisponivel');
  // Nos demais casos, a mesma resposta sempre, para não revelar quais e-mails têm conta.
  redirect('/recuperar-senha?aviso=recuperacao_enviada');
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RecuperarSenha({ searchParams }: Props) {
  const { erro, aviso } = await searchParams;
  return (
    <main className="cartao-auth">
      <h1>Recuperar senha</h1>
      <p>Informe o e-mail da conta. Enviaremos um link para criar uma nova senha.</p>
      <Aviso erro={erro} aviso={aviso} />
      <form action={pedirLink} className="formulario">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <BotaoEnviar>Enviar link</BotaoEnviar>
      </form>
      <p>
        <Link href="/entrar">Voltar para entrar</Link>
      </p>
    </main>
  );
}
