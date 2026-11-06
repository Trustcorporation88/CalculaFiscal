import type { Metadata } from 'next';
import Link from 'next/link';
import { precoSimplificado, VERSAO_MOTOR, type ResultadoAno } from '@calculafiscal/motor-fiscal';
import { tabelaOficial } from '@calculafiscal/regras';
import { reais } from '@/components/calculadora/formato';
import { SeloStatus } from '@/components/calculadora/selo-status';
import { calcularLinhaDoTempo } from '@/lib/calculadora/calcular';
import { lerEntrada } from '@/lib/calculadora/entrada';
import { EXEMPLO_COCA } from '@/lib/calculadora/exemplos';

export const metadata: Metadata = {
  title: 'CalculaFiscal: preço e margem na Reforma Tributária, de 2026 a 2033',
};

/** O caso da página inicial, calculado pelo mesmo motor da calculadora (nenhum número digitado). */
function casoCocaCola() {
  const leitura = lerEntrada(EXEMPLO_COCA);
  if (!leitura.ok) throw new Error('Exemplo da página inicial inválido.');
  const tabela = tabelaOficial();
  const correto = calcularLinhaDoTempo(leitura.entrada, tabela);
  const simplificadoHoje = precoSimplificado({
    custo: leitura.entrada.notaCompra,
    despesasVariaveis: leitura.entrada.despesasVariaveis,
    imposto: leitura.entrada.aliquotaDas ?? '0',
    margem: leitura.entrada.margem,
  });
  const ano = (a: number) => correto.anos.find((x) => x.ano === a) as ResultadoAno;
  return {
    simplificadoHoje: simplificadoHoje.preco,
    simplificadoReforma: correto.simplificado.ok ? correto.simplificado.resultado.preco : null,
    anos: [ano(2026), ano(2027), ano(2033)],
    versaoRegras: tabela.versao,
  };
}

const clientePaga = (a: ResultadoAno) =>
  a.situacao === 'CALCULADO' ? reais(a.valores.precoComTributo) : 'dado pendente';

export default function Inicio() {
  const caso = casoCocaCola();

  return (
    <main className="conteudo largo inicio">
      <header className="topo">
        <p className="marca">CalculaFiscal</p>
        <nav className="botoes-exportar" aria-label="Acesso">
          <Link href="/entrar">Entrar</Link>
          <Link href="/cadastro" className="botao">
            Criar conta
          </Link>
        </nav>
      </header>

      <section className="heroi">
        <h1>Preço e margem na Reforma Tributária, de 2026 a 2033</h1>
        <p className="subtitulo">
          CBS, IBS, Imposto Seletivo e a redução do ICMS, ano a ano, com a fonte e o status de cada
          alíquota e a memória de cálculo de cada número.
        </p>
        <p className="botoes-exportar">
          <Link href="/cadastro" className="botao">
            Criar conta
          </Link>
          <Link href="/entrar">Já tenho conta</Link>
        </p>
      </section>

      <section aria-labelledby="titulo-caso">
        <h2 id="titulo-caso">O caso da Coca-Cola 600 ml</h2>
        <p>
          Uma distribuidora no Simples Nacional compra a garrafa por <strong>R$ 4,89</strong> e quer
          25% de margem, com 6% de despesas. Quanto o cliente deve pagar?
        </p>
        <div className="comparador">
          <div className="cartao">
            <h3>Cálculo simplificado (o que circula)</h3>
            <ul className="lista-anos">
              <li>
                <span>Hoje, com o DAS por dentro</span>
                <span className="numero">{reais(caso.simplificadoHoje)}</span>
              </li>
              {caso.simplificadoReforma && (
                <li>
                  <span>&quot;Reforma&quot; com 26,5% por dentro</span>
                  <span className="numero">{reais(caso.simplificadoReforma)}</span>
                </li>
              )}
            </ul>
            <p className="ajuda">
              Aplica a alíquota cheia da Reforma por dentro, sobre o preço inteiro, como se valesse
              já em 2027, sem crédito da compra e sem a transição.
            </p>
          </div>
          <div className="cartao">
            <h3>Cálculo correto (o cliente paga)</h3>
            <ul className="lista-anos">
              {caso.anos.map((a) => (
                <li key={a.ano}>
                  <span>
                    {a.ano} <SeloStatus status={a.status} />
                  </span>
                  <span className="numero">{clientePaga(a)}</span>
                </li>
              ))}
            </ul>
            <p className="ajuda">
              Mesma margem de 25% em todos os anos. Valores de 2027 em diante dependem de regras
              ainda pendentes ou estimadas, e a tela mostra isso em cada número.
            </p>
          </div>
        </div>

        <h3>Por que a diferença</h3>
        <ol className="motivos">
          <li>
            <strong>Os 26,5% não valem em 2027.</strong> Em 2027 são 11,2% de CBS e 0,1% de IBS; o
            IBS cresce até 2033.
          </li>
          <li>
            <strong>Por fora, não por dentro.</strong> A CBS e o IBS incidem sobre o valor sem ICMS
            e PIS/Cofins, e não sobre o preço inteiro.
          </li>
          <li>
            <strong>O custo muda.</strong> Saem o PIS/Cofins e o IPI do fabricante, e o ICMS-ST cai
            até zerar em 2033.
          </li>
          <li>
            <strong>O Imposto Seletivo entra no custo</strong> das bebidas açucaradas a partir de
            fevereiro de 2027 e nunca vira crédito.
          </li>
          <li>
            <strong>O regime importa.</strong> No Simples, a CBS e o IBS da compra viram custo; no
            regime regular, viram crédito.
          </li>
        </ol>
        <p className="ajuda">
          Premissas da nota do fabricante estimadas (ICMS, IPI, PIS/Cofins monofásico e MVA),
          calibradas para fechar em R$ 4,89. Na calculadora, troque pelos dados da sua nota.
        </p>
      </section>

      <section aria-labelledby="titulo-recursos">
        <h2 id="titulo-recursos">O que dá para fazer</h2>
        <ul className="recursos">
          <li>
            <strong>Calculadora 2026 a 2033:</strong> o preço que mantém a sua margem em cada ano,
            nos quatro regimes (Simples no DAS ou regular, Presumido e Real).
          </li>
          <li>
            <strong>Cenários lado a lado:</strong> IBS baixo, central e alto, e a MP do Imposto
            Seletivo caducada.
          </li>
          <li>
            <strong>Preço psicológico</strong> sugerido em cada ano, com a margem efetiva.
          </li>
          <li>
            <strong>Reduções da LC 214:</strong> cesta básica, hortícolas, medicamentos, alimentos e
            outros tratamentos por cClassTrib.
          </li>
          <li>
            <strong>Lote por planilha</strong> de até 500 produtos, e exportação em Excel e PDF com
            a memória de cálculo.
          </li>
          <li>
            <strong>API para integrar</strong> o seu sistema, com o mesmo cálculo da tela (
            <a href="/v1/openapi.json">contrato OpenAPI</a>).
          </li>
        </ul>
      </section>

      <section aria-labelledby="titulo-transparencia">
        <h2 id="titulo-transparencia">Nenhum número com aparência de certo</h2>
        <p>
          Toda alíquota tem fonte, vigência e status: <SeloStatus status="EM_VIGOR" />{' '}
          <SeloStatus status="PUBLICADO_EFEITO_FUTURO" /> <SeloStatus status="PENDENTE" />{' '}
          <SeloStatus status="ESTIMATIVA" />. O que depende de norma ainda não publicada aparece
          como pendente, nunca como um número inventado.
        </p>
      </section>

      <footer className="rodape ajuda">
        <p>
          Simulação para apoio à decisão; não substitui a análise do contador responsável. Tabela de
          regras {caso.versaoRegras} · motor {VERSAO_MOTOR}.
        </p>
      </footer>
    </main>
  );
}
