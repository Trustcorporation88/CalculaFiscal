import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Aviso } from '@/components/aviso';
import { sair } from '../entrar/actions';
import { usuarioAtual, supabaseServidor } from '@/lib/supabase/server';
import { BotaoEnviar } from '@/components/botao-enviar';

export const metadata: Metadata = { title: 'Verificação em duas etapas | CalculaFiscal' };

async function verificar(form: FormData) {
  'use server';
  const codigo = z
    .string()
    .regex(/^\d{6}$/)
    .safeParse(form.get('codigo'));
  if (!codigo.success) redirect('/mfa?erro=codigo');
  const supabase = await supabaseServidor();
  const { data: fatores } = await supabase.auth.mfa.listFactors();
  const fator = (fatores?.totp ?? []).find((f) => f.status === 'verified');
  if (!fator) redirect('/conta/seguranca');
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: fator.id,
    code: codigo.data,
  });
  if (error) redirect(`/mfa?erro=${error.status === 429 ? 'limite' : 'codigo'}`);
  redirect('/app');
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Mfa({ searchParams }: Props) {
  const { usuario } = await usuarioAtual();
  if (!usuario) redirect('/entrar');
  const { erro } = await searchParams;
  return (
    <main className="cartao-auth">
      <h1>Verificação em duas etapas</h1>
      <p>Digite o código de 6 números do seu aplicativo autenticador.</p>
      <Aviso erro={erro} />
      <form action={verificar} className="formulario">
        <label htmlFor="codigo">Código</label>
        <input
          id="codigo"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
        />
        <BotaoEnviar>Verificar</BotaoEnviar>
      </form>
      <form action={sair}>
        <BotaoEnviar className="link">Sair</BotaoEnviar>
      </form>
    </main>
  );
}
