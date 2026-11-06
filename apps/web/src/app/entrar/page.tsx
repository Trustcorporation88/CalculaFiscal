import type { Metadata } from 'next';
import Link from 'next/link';
import { Aviso } from '@/components/aviso';
import { entrarComSenha, enviarLinkMagico } from './actions';

export const metadata: Metadata = { title: 'Entrar | CalculaFiscal' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Entrar({ searchParams }: Props) {
  const { erro, aviso } = await searchParams;
  return (
    <main className="cartao-auth">
      <h1>Entrar</h1>
      <Aviso erro={erro} aviso={aviso} />

      <form action={entrarComSenha} className="formulario">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required />
        <button type="submit">Entrar</button>
      </form>
      <p>
        <Link href="/recuperar-senha">Esqueci a senha</Link>
      </p>

      <h2>Ou receba um link de acesso</h2>
      <form action={enviarLinkMagico} className="formulario">
        <label htmlFor="email-link">E-mail</label>
        <input id="email-link" name="email" type="email" autoComplete="email" required />
        <button type="submit" className="secundario">
          Enviar link
        </button>
      </form>

      <p>
        Ainda não tem conta? <Link href="/cadastro">Criar conta</Link>
      </p>
    </main>
  );
}
