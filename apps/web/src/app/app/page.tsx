import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Aviso } from '@/components/aviso';
import { sair } from '../entrar/actions';
import { exigirSessao } from '@/lib/sessao';
import { BotaoEnviar } from '@/components/botao-enviar';

export const metadata: Metadata = { title: 'Painel | Calculadora Fiscal' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Painel({ searchParams }: Props) {
  const { usuario, vinculos } = await exigirSessao();
  const { aviso } = await searchParams;
  if (vinculos.length === 0) redirect('/app/nova-organizacao');

  return (
    <main className="conteudo">
      <header className="topo">
        <h1>Painel</h1>
        <form action={sair}>
          <BotaoEnviar className="secundario">Sair</BotaoEnviar>
        </form>
      </header>
      <Aviso aviso={aviso} />
      <p>Conectado como {usuario.email}.</p>
      <h2>Suas organizações</h2>
      <ul>
        {vinculos.map((v) => (
          <li key={v.organization_id}>
            {v.organizations?.nome ?? 'Organização'} ({v.papel})
          </li>
        ))}
      </ul>
      <p>
        <Link href="/app/calculadora" className="botao">
          Abrir a calculadora de preço
        </Link>
      </p>
      {vinculos.some((v) => v.papel === 'dono' || v.papel === 'administrador') && (
        <p>
          <Link href="/app/api">API e tokens de integração</Link>
        </p>
      )}
      <p>
        <Link href="/funcionalidades">Como funciona cada funcionalidade</Link>
      </p>
      <p>
        <Link href="/conta/seguranca">Segurança da conta</Link>
      </p>
    </main>
  );
}
