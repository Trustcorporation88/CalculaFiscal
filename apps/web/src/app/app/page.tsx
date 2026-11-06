import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sair } from '../entrar/actions';
import { exigirSessao } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Painel | CalculaFiscal' };

export default async function Painel() {
  const { usuario, vinculos } = await exigirSessao();
  if (vinculos.length === 0) redirect('/app/nova-organizacao');

  return (
    <main className="conteudo">
      <header className="topo">
        <h1>Painel</h1>
        <form action={sair}>
          <button type="submit" className="secundario">
            Sair
          </button>
        </form>
      </header>
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
        <Link href="/conta/seguranca">Segurança da conta</Link>
      </p>
      <p className="ajuda">A calculadora entra na fase do motor da Onda 1.</p>
    </main>
  );
}
