import type { Metadata } from 'next';
import Link from 'next/link';
import { tabelaOficial } from '@calculafiscal/regras';
import { VERSAO_MOTOR } from '@calculafiscal/motor-fiscal';
import { FORMULARIO_VAZIO } from '@/lib/calculadora/exemplos';
import { LIMITE_LOTE } from '@/lib/calculadora/lote';
import { exigirSessao } from '@/lib/sessao';
import { FormularioLote } from './formulario-lote';

export const metadata: Metadata = { title: 'Simulação em lote | Calculadora Fiscal' };

export default async function SimulacaoEmLote() {
  await exigirSessao();
  const { versao } = tabelaOficial();
  return (
    <main className="conteudo largo">
      <header className="topo">
        <div>
          <p className="ajuda">
            <Link href="/app">Painel</Link> · <Link href="/app/calculadora">Calculadora</Link>
          </p>
          <h1>Simulação em lote</h1>
        </div>
      </header>
      <p>
        Uma linha por produto, com a nota de compra de hoje. O regime, as despesas, a margem e o
        cenário são os do formulário, iguais para todo o lote. Até {LIMITE_LOTE} produtos por
        arquivo (.xlsx ou .csv).
      </p>
      <p className="ajuda">
        Tabela de regras {versao} · motor {VERSAO_MOTOR}. O arquivo é lido no seu navegador; só os
        valores das colunas do modelo vão para o cálculo.
      </p>
      <FormularioLote iniciais={FORMULARIO_VAZIO} />
    </main>
  );
}
