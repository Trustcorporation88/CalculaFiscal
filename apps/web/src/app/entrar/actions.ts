'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { urlDoSite } from '@/lib/env';
import { supabaseServidor } from '@/lib/supabase/server';

const Email = z.email().max(254);
const Login = z.object({ email: Email, senha: z.string().min(1).max(200) });
const Cadastro = z.object({ email: Email, senha: z.string().min(10).max(200) });

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
  // Mesma resposta exista ou não a conta, para não revelar e-mails cadastrados.
  if (error?.status === 429) redirect('/entrar?erro=limite');
  redirect('/entrar?aviso=link_enviado');
}

export async function cadastrar(form: FormData) {
  const dados = Cadastro.safeParse({ email: form.get('email'), senha: form.get('senha') });
  if (!dados.success) {
    const senhaCurta = dados.error.issues.some((i) => i.path[0] === 'senha');
    redirect(`/cadastro?erro=${senhaCurta ? 'senha_fraca' : 'dados'}`);
  }
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signUp({
    email: dados.data.email,
    password: dados.data.senha,
    options: { emailRedirectTo: `${urlDoSite()}/auth/callback` },
  });
  if (error?.status === 429) redirect('/cadastro?erro=limite');
  if (error && error.code === 'weak_password') redirect('/cadastro?erro=senha_fraca');
  redirect('/entrar?aviso=cadastro_enviado');
}

export async function sair() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect('/entrar');
}
