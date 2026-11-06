import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Aviso } from '@/components/aviso';
import { exigirSessao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Nova organização | CalculaFiscal' };

async function criar(form: FormData) {
  'use server';
  const nome = z.string().trim().min(2).max(200).safeParse(form.get('nome'));
  if (!nome.success) redirect('/app/nova-organizacao?erro=dados');
  const supabase = await supabaseServidor();
  const { error } = await supabase.rpc('criar_organizacao', { nome: nome.data });
  if (error) redirect('/app/nova-organizacao?erro=falha');
  // O criador vira dono, e dono precisa de MFA: o painel encaminha para a ativação.
  redirect('/app');
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NovaOrganizacao({ searchParams }: Props) {
  await exigirSessao({ permitirSemMfa: true });
  const { erro } = await searchParams;
  return (
    <main className="cartao-auth">
      <h1>Crie sua organização</h1>
      <p>Pode ser a sua empresa ou o seu escritório de contabilidade.</p>
      <Aviso erro={erro} />
      <form action={criar} className="formulario">
        <label htmlFor="nome">Nome da organização</label>
        <input id="nome" name="nome" minLength={2} maxLength={200} required />
        <button type="submit">Criar</button>
      </form>
    </main>
  );
}
