'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { cotaDeEmailEsgotada } from '@/lib/auth-erros';
import { urlDoSite } from '@/lib/env';
import { supabaseServidor } from '@/lib/supabase/server';

const Email = z.email().max(254);
const Login = z.object({ email: Email, senha: z.string().min(1).max(200) });
const Cadastro = z.object({ email: Email, senha: z.string().min(10).max(200) });

/** Log estruturado sem dado pessoal: só a operação, o status e o código do erro. */
function registrarErroAuth(
  operacao: string,
  erro: { status?: number | undefined; code?: string | undefined },
) {
  console.error(
    JSON.stringify({
      nivel: 'erro',
      msg: 'falha no Auth',
      operacao,
      status: erro.status,
      codigo: erro.code,
    }),
  );
}

function codigoDoErro(status: number | undefined): string {
  return status === 429 ? 'limite' : 'credenciais';
}

export async function entrarComSenha(form: FormData) {
  const dados = Login.safeParse({ email: form.get('email'), senha: form.get('senha') });
  if (!dados.success) redirect('/entrar?erro=dados');
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: dados.data.email,
    password: dados.data.senha,
  });
  if (error) redirect(`/entrar?erro=${codigoDoErro(error.status)}`);
  redirect('/app');
}

export async function enviarLinkMagico(form: FormData) {
  const dados = Email.safeParse(form.get('email'));
  if (!dados.success) redirect('/entrar?erro=dados');
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email: dados.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${urlDoSite()}/auth/callback` },
  });
  // Sempre a mesma resposta pública, exista ou não a conta: um 429 só acontece para contas
  // existentes e revelaria o cadastro. Os limites continuam aplicados pelo Supabase Auth.
  if (error) registrarErroAuth('link_magico', error);
  if (cotaDeEmailEsgotada(error)) redirect('/entrar?erro=email_indisponivel');
  redirect('/entrar?aviso=link_enviado');
}

export async function cadastrar(form: FormData) {
  const dados = Cadastro.safeParse({ email: form.get('email'), senha: form.get('senha') });
  if (!dados.success) {
    const senhaCurta = dados.error.issues.some((i) => i.path[0] === 'senha');
    redirect(`/cadastro?erro=${senhaCurta ? 'senha_fraca' : 'dados'}`);
  }
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.signUp({
    email: dados.data.email,
    password: dados.data.senha,
    options: { emailRedirectTo: `${urlDoSite()}/auth/callback` },
  });
  if (error) {
    registrarErroAuth('cadastro', error);
    if (cotaDeEmailEsgotada(error)) redirect('/cadastro?erro=email_indisponivel');
    if (error.status === 429) redirect('/cadastro?erro=limite');
    if (error.code === 'weak_password') redirect('/cadastro?erro=senha_fraca');
    // Só ocorre sem confirmação por e-mail (staging); com confirmação o Supabase já não revela isso.
    if (error.code === 'user_already_exists') redirect('/entrar?erro=conta_existente');
    // Falha de servidor, rede ou SMTP: não dizer que o e-mail foi enviado.
    redirect('/cadastro?erro=falha');
  }
  // Sem confirmação por e-mail (ex.: staging), o Supabase já devolve a sessão.
  if (data.session) redirect('/app');
  redirect('/entrar?aviso=cadastro_enviado');
}

export async function sair() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect('/entrar');
}
