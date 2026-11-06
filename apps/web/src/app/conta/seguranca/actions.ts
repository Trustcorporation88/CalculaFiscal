'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseServidor } from '@/lib/supabase/server';

export type EstadoCadastroMfa =
  | { etapa: 'inicio'; erro?: string }
  | { etapa: 'verificar'; fatorId: string; qrCode: string; segredo: string; erro?: string };

const Codigo = z.string().regex(/^\d{6}$/);

/** Gera um novo fator TOTP. Fatores não verificados anteriores são descartados. */
export async function iniciarMfa(): Promise<EstadoCadastroMfa> {
  const supabase = await supabaseServidor();
  const { data: fatores } = await supabase.auth.mfa.listFactors();
  for (const f of fatores?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Autenticador ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) return { etapa: 'inicio', erro: 'Não foi possível iniciar. Tente de novo.' };
  return {
    etapa: 'verificar',
    fatorId: data.id,
    qrCode: data.totp.qr_code,
    segredo: data.totp.secret,
  };
}

/** Confirma o fator com o primeiro código do aplicativo. A sessão passa a AAL2. */
export async function confirmarMfa(
  anterior: EstadoCadastroMfa,
  form: FormData,
): Promise<EstadoCadastroMfa> {
  if (anterior.etapa !== 'verificar') return anterior;
  const codigo = Codigo.safeParse(form.get('codigo'));
  if (!codigo.success) return { ...anterior, erro: 'Digite os 6 números do aplicativo.' };
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: anterior.fatorId,
    code: codigo.data,
  });
  if (error) return { ...anterior, erro: 'Código inválido. Confira o aplicativo e tente de novo.' };
  redirect('/conta/seguranca?aviso=mfa_ativado');
}

/** Ação única usada pelo formulário: decide entre iniciar e confirmar. */
export async function acaoMfa(anterior: EstadoCadastroMfa, form: FormData) {
  return anterior.etapa === 'inicio' ? iniciarMfa() : confirmarMfa(anterior, form);
}
