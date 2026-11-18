import type { Metadata } from 'next';
import Link from 'next/link';
import {
  tabelaOficial,
  tratamentosDisponiveis,
  tratamentosServicoDisponiveis,
} from '@calculafiscal/regras';
import { VERSAO_MOTOR } from '@calculafiscal/motor-fiscal';
import { EXEMPLO_COCA, EXEMPLO_SERVICO, FORMULARIO_VAZIO } from '@/lib/calculadora/exemplos';
import { exigirSessao } from '@/lib/sessao';
import { FormularioCalculadora } from './formulario';

export const metadata: Metadata = { title: 'Calculadora | Calculadora Fiscal' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Calculadora({ searchParams }: Props) {
  await exigirSessao();
  const { exemplo } = await searchParams;
  const modoExemplo = exemplo === 'coca' ? 'coca' : exemplo === 'servico' ? 'servico' : 'vazio';
  const iniciais =
    modoExemplo === 'coca'
      ? EXEMPLO_COCA
      : modoExemplo === 'servico'
        ? EXEMPLO_SERVICO
        : FORMULARIO_VAZIO;
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
        Simule mercadorias (inclusive importando o XML da NF-e de compra) ou serviços (transição do
        ISS e reduções da LC 214), comparando o fornecedor que repassa a queda de tributos com o que
        mantém o preço bruto.
      </p>
      <p className="ajuda">
        Tabela de regras {versao} · motor {VERSAO_MOTOR} ·{' '}
        {modoExemplo !== 'vazio' ? (
          <Link href="/app/calculadora">Limpar o formulário</Link>
        ) : (
          <>
            <Link href="/app/calculadora?exemplo=coca">Exemplo Coca-Cola</Link> ·{' '}
            <Link href="/app/calculadora?exemplo=servico">Exemplo serviço contábil (30%)</Link>
          </>
        )}{' '}
        · <Link href="/app/calculadora/lote">Simular lote (planilha ou XMLs de NF-e)</Link>
      </p>
      {modoExemplo === 'coca' && (
        <p role="status" className="aviso aviso-estimativa">
          Exemplo com premissas estimadas: as alíquotas da nota do fabricante foram calibradas para
          fechar em R$ 4,89. Troque pelos dados da sua nota ou importe o XML.
        </p>
      )}
      {modoExemplo === 'servico' && (
        <p role="status" className="aviso aviso-estimativa">
          Exemplo ilustrativo de escritório contábil no Lucro Presumido (ISS 5%, PIS/Cofins 3,65%,
          20% de insumos tributados e redução de 30% no cClassTrib 200052). Ajuste para a sua
          realidade.
        </p>
      )}
      <FormularioCalculadora
        key={modoExemplo}
        iniciais={iniciais}
        tratamentosMercadoria={tratamentosDisponiveis(regras)}
        tratamentosServico={tratamentosServicoDisponiveis()}
      />
    </main>
  );
}
