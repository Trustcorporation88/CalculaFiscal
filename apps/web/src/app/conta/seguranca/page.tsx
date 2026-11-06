import type { Metadata } from 'next';
import Link from 'next/link';
import { Aviso } from '@/components/aviso';
import { exigirSessao } from '@/lib/sessao';
import { CadastroMfa } from './cadastro-mfa';
import { Marca } from '@/components/marca';

export const metadata: Metadata = { title: 'Segurança da conta | Calculadora Fiscal' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Seguranca({ searchParams }: Props) {
  const { supabase, temMfa } = await exigirSessao({ permitirSemMfa: true });
  const { erro, aviso } = await searchParams;
  const { data: fatores } = await supabase.auth.mfa.listFactors();
  const verificados = (fatores?.totp ?? []).filter((f) => f.status === 'verified');

  return (
    <main className="cartao-auth">
      <div className="cartao-marca">
        <Marca />
      </div>
      <h1>Segurança da conta</h1>
      <Aviso erro={erro} aviso={aviso} />
      <h2>Verificação em duas etapas</h2>
      {verificados.length > 0 ? (
        <>
          <p>Ativada com {verificados.length} aplicativo(s) autenticador(es).</p>
          {temMfa && <Link href="/app">Ir para o painel</Link>}
        </>
      ) : (
        <>
          <p>
            Proteja a conta com um código do aplicativo autenticador. É obrigatório para donos e
            administradores de organização.
          </p>
          <CadastroMfa />
        </>
      )}
    </main>
  );
}
