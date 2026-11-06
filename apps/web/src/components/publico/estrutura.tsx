import Link from 'next/link';
import { VERSAO_MOTOR } from '@calculafiscal/motor-fiscal';
import { tabelaOficial } from '@calculafiscal/regras';
import { Marca } from '@/components/marca';
import s from './publico.module.css';

/** Topo das páginas públicas (início e funcionalidades). */
export function CabecalhoPublico() {
  return (
    <header className={s.navegacao}>
      <div className={s.faixa}>
        <Marca />
        <nav className={s.links} aria-label="Principal">
          {/* Com a âncora, o clique leva ao topo (lista completa) mesmo já estando na página. */}
          <Link href="/funcionalidades#topo" className={s.sempre}>
            Funcionalidades
          </Link>
          <Link href="/#caso">O caso</Link>
          <Link href="/#api">API</Link>
          <Link href="/entrar" className={s.entrar}>
            Entrar
          </Link>
          <Link href="/cadastro" className={s.botao}>
            Criar conta
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Rodapé das páginas públicas, com as versões do motor e das regras. */
export function RodapePublico() {
  return (
    <footer className={s.rodape}>
      <div className={s.faixa}>
        <Marca />
        <nav className={s.linksRodape} aria-label="Rodapé">
          <Link href="/funcionalidades#topo">Funcionalidades</Link>
          <Link href="/#caso">O caso</Link>
          <a href="/v1/openapi.json">API</a>
          <Link href="/entrar">Entrar</Link>
          <Link href="/cadastro">Criar conta</Link>
        </nav>
        <p>
          Simulação para apoio à decisão; não substitui a análise do contador responsável.
          <br />
          Tabela de regras {tabelaOficial().versao} · motor {VERSAO_MOTOR}
        </p>
      </div>
    </footer>
  );
}
