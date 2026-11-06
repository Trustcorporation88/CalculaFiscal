import type { Metadata } from 'next';
import Link from 'next/link';
import { Aviso } from '@/components/aviso';
import { cadastrar } from '../entrar/actions';

export const metadata: Metadata = { title: 'Criar conta | CalculaFiscal' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Cadastro({ searchParams }: Props) {
  const { erro } = await searchParams;
  return (
    <main className="cartao-auth">
      <h1>Criar conta</h1>
      <Aviso erro={erro} />
      <form action={cadastrar} className="formulario">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="senha">Senha</label>
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
        <button type="submit">Criar conta</button>
      </form>
      <p>
        Já tem conta? <Link href="/entrar">Entrar</Link>
      </p>
    </main>
  );
}
