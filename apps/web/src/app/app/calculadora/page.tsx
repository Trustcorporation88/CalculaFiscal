import type { Metadata } from 'next';
import Link from 'next/link';
import { tabelaOficial, tratamentosDisponiveis } from '@calculafiscal/regras';
import { VERSAO_MOTOR } from '@calculafiscal/motor-fiscal';
import { EXEMPLO_COCA, FORMULARIO_VAZIO } from '@/lib/calculadora/exemplos';
import { exigirSessao } from '@/lib/sessao';
import { FormularioCalculadora } from './formulario';

export const metadata: Metadata = { title: 'Calculadora | CalculaFiscal' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Calculadora({ searchParams }: Props) {
  await exigirSessao();
  const { exemplo } = await searchParams;
  const ehExemplo = exemplo === 'coca';
  const { versao, regras } = tabelaOficial();

  return (
    <main className="conteudo largo">
      <header className="topo">
        <div>
          <p className="ajuda">
            <Link href="/app">Painel</Link>
          </p>
          <h1>Calculadora de preço, 2026 a 2033</h1>
        </div>
      </header>
      <p>
        Informe a nota de compra de hoje e como você vende. A calculadora projeta o preço que mantém
        a sua margem em cada ano da transição, com CBS, IBS, Imposto Seletivo e a redução do ICMS, e
        mostra a premissa e a fonte de cada número.
      </p>
      <p className="ajuda">
        Tabela de regras {versao} · motor {VERSAO_MOTOR} ·{' '}
        {ehExemplo ? (
          <Link href="/app/calculadora">Limpar o formulário</Link>
        ) : (
          <Link href="/app/calculadora?exemplo=coca">Preencher com o exemplo da Coca-Cola</Link>
        )}{' '}
        · <Link href="/app/calculadora/lote">Simular vários produtos por planilha</Link>
      </p>
      {ehExemplo && (
        <p role="status" className="aviso aviso-estimativa">
          Exemplo com premissas estimadas: as alíquotas da nota do fabricante foram calibradas para
          fechar em R$ 4,89. Troque pelos dados da sua nota.
        </p>
      )}
      <FormularioCalculadora
        key={ehExemplo ? 'coca' : 'vazio'}
        iniciais={ehExemplo ? EXEMPLO_COCA : FORMULARIO_VAZIO}
        tratamentos={tratamentosDisponiveis(regras)}
      />
    </main>
  );
}
