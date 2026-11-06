import type { Metadata } from 'next';
import Link from 'next/link';
import { D, precoSimplificado, type ResultadoAno } from '@calculafiscal/motor-fiscal';
import { CENARIOS, tabelaOficial, tratamentosDisponiveis } from '@calculafiscal/regras';
import { reais } from '@/components/calculadora/formato';
import { SeloStatus } from '@/components/calculadora/selo-status';
import { calcularLinhaDoTempo } from '@/lib/calculadora/calcular';
import { lerEntrada } from '@/lib/calculadora/entrada';
import { EXEMPLO_COCA } from '@/lib/calculadora/exemplos';
import { CabecalhoPublico, RodapePublico } from '@/components/publico/estrutura';
import s from '@/components/publico/publico.module.css';

export const metadata: Metadata = {
  title: 'Calculadora Fiscal: preço e margem na Reforma Tributária, de 2026 a 2033',
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
  }).preco;
  const simplificadoReforma = correto.simplificado.ok ? correto.simplificado.resultado.preco : null;
  const de2027 = correto.anos.find((a) => a.ano === 2027);
  const correto2027 = de2027?.situacao === 'CALCULADO' ? de2027.valores.precoComTributo : null;
  const acima =
    simplificadoReforma && correto2027
      ? new D(simplificadoReforma).div(correto2027).minus(1).times(100).round().toNumber()
      : null;
  return {
    anos: correto.anos,
    simplificadoHoje,
    simplificadoReforma,
    correto2027,
    acima,
    tratamentos: tratamentosDisponiveis(tabela.regras).length,
  };
}

const pago = (a: ResultadoAno) => (a.situacao === 'CALCULADO' ? a.valores.precoComTributo : null);

const MOTIVOS = [
  {
    titulo: 'Os 26,5% não valem em 2027',
    texto: 'Em 2027 são 11,2% de CBS e 0,1% de IBS. O IBS sobe aos poucos até 2033.',
  },
  {
    titulo: 'Por fora, não por dentro',
    texto: 'CBS e IBS incidem sobre o valor sem ICMS e PIS/Cofins, não sobre o preço inteiro.',
  },
  {
    titulo: 'O custo de compra muda',
    texto: 'Saem o PIS/Cofins e o IPI do fabricante, e o ICMS-ST cai até zerar em 2033.',
  },
  {
    titulo: 'Imposto Seletivo no custo',
    texto: 'Bebidas açucaradas pagam IS a partir de fevereiro de 2027, e ele nunca vira crédito.',
  },
  {
    titulo: 'O regime faz diferença',
    texto: 'No Simples, CBS e IBS da compra viram custo. No regime regular, viram crédito.',
  },
];

const RECURSOS = [
  {
    titulo: 'Linha do tempo 2026 a 2033',
    texto: 'O preço que mantém a sua margem em cada ano, nos regimes Simples, Presumido e Real.',
    icone: 'M4 19h16M6 15l4-4 3 3 5-6',
  },
  {
    titulo: 'Cenários lado a lado',
    texto: 'IBS baixo, central e alto, e a MP do Imposto Seletivo caducada, na mesma tela.',
    icone: 'M5 5h5v14H5zM14 9h5v10h-5z',
  },
  {
    titulo: 'Reduções da LC 214',
    texto: 'Cesta básica, hortícolas, medicamentos, alimentos e outros tratamentos por cClassTrib.',
    icone: 'M7 17L17 7M8 8h.01M16 16h.01',
  },
  {
    titulo: 'Preço psicológico',
    texto: 'O próximo preço com final comercial em cada ano, com a margem efetiva nele.',
    icone: 'M12 4v16M8 8h6a3 3 0 010 6H9',
  },
  {
    titulo: 'Lote e exportação',
    texto: 'Até 500 produtos por planilha. Excel e PDF com a memória de cálculo completa.',
    icone: 'M5 4h14v16H5zM5 9h14M10 9v11',
  },
  {
    titulo: 'API para o seu sistema',
    texto: 'O mesmo cálculo da tela, com contrato OpenAPI, tokens por organização e limites.',
    icone: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12',
  },
];

function Icone({ d }: { d: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className={s.icone}>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Inicio() {
  const caso = casoCocaCola();
  const precos = caso.anos.map(pago).filter((p): p is string => p !== null);
  const maximo = Math.max(...precos.map(Number), Number(caso.simplificadoReforma ?? 0));
  const largura = (valor: string) => `${Math.max(8, (Number(valor) / maximo) * 100)}%`;

  return (
    <div className={s.pagina}>
      <CabecalhoPublico />

      <main>
        <section className={`${s.faixa} ${s.heroi}`}>
          <div>
            <p className={s.sobretitulo}>Reforma Tributária · 2026 a 2033</p>
            <h1>O preço certo em cada ano da Reforma</h1>
            <p className={s.lide}>
              CBS, IBS, Imposto Seletivo e a redução do ICMS, ano a ano, para manter a sua margem.
              Cada alíquota com fonte, vigência e status, e cada número com a memória de cálculo.
            </p>
            <div className={s.acoes}>
              <Link href="/cadastro" className={s.botao}>
                Criar conta grátis
              </Link>
              <a href="#caso" className={s.secundario}>
                Ver o caso da Coca-Cola
              </a>
            </div>
          </div>

          <figure className={s.painel} aria-labelledby="legenda-painel">
            <figcaption id="legenda-painel" className={s.painelTitulo}>
              <span>Coca-Cola 600 ml · o cliente paga</span>
              <span className={s.painelNota}>margem de 25% em todos os anos</span>
            </figcaption>
            <ul className={s.barras}>
              {caso.anos.map((a) => {
                const valor = pago(a);
                return (
                  <li key={a.ano}>
                    <span className={s.ano}>{a.ano}</span>
                    <span className={s.trilho}>
                      {valor && <span className={s.barra} style={{ width: largura(valor) }} />}
                    </span>
                    <span className={s.valor}>{valor ? reais(valor) : 'pendente'}</span>
                  </li>
                );
              })}
              {caso.simplificadoReforma && (
                <li className={s.errado}>
                  <span className={s.ano}>26,5%</span>
                  <span className={s.trilho}>
                    <span
                      className={s.barra}
                      style={{ width: largura(caso.simplificadoReforma) }}
                    />
                  </span>
                  <span className={s.valor}>{reais(caso.simplificadoReforma)}</span>
                </li>
              )}
            </ul>
            <p className={s.painelRodape}>
              Última barra: o &quot;cálculo simplificado&quot;, com 26,5% por dentro.
            </p>
          </figure>
        </section>

        <section className={s.numeros} aria-label="Em números">
          <div className={s.faixa}>
            <div>
              <strong>8 anos</strong>
              <span>de 2026 a 2033, com o status de cada premissa</span>
            </div>
            <div>
              <strong>{CENARIOS.length} cenários</strong>
              <span>de IBS e de Imposto Seletivo</span>
            </div>
            <div>
              <strong>{caso.tratamentos} tratamentos</strong>
              <span>de redução e alíquota zero da LC 214</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>de cobertura de testes no motor de cálculo</span>
            </div>
          </div>
        </section>

        <section id="caso" className={`${s.faixa} ${s.secao}`}>
          <p className={s.sobretitulo}>O caso</p>
          <h2>Uma garrafa de R$ 4,89 e duas respostas</h2>
          <p className={s.lide}>
            Uma distribuidora no Simples Nacional compra a Coca-Cola 600 ml por R$ 4,89 e quer 25%
            de margem, com 6% de despesas.
          </p>
          <div className={s.comparacao}>
            <div className={`${s.cartao} ${s.cartaoErrado}`}>
              <p className={s.rotulo}>Cálculo simplificado</p>
              <p className={s.grande}>
                {caso.simplificadoReforma ? reais(caso.simplificadoReforma) : '—'}
              </p>
              <p>
                Hoje {reais(caso.simplificadoHoje)}. Com os 26,5% da Reforma aplicados por dentro,
                sobre o preço inteiro, como se valessem já em 2027.
              </p>
            </div>
            <div className={`${s.cartao} ${s.cartaoCerto}`}>
              <p className={s.rotulo}>Cálculo correto em 2027</p>
              <p className={s.grande}>{caso.correto2027 ? reais(caso.correto2027) : '—'}</p>
              <p>
                O preço que mantém os mesmos 25%, com CBS e IBS por fora, crédito da compra, Imposto
                Seletivo no custo e o ICMS da transição.
                {caso.acima !== null && (
                  <>
                    {' '}
                    O simplificado cobra <strong>{caso.acima}% a mais</strong>.
                  </>
                )}
              </p>
            </div>
          </div>
          <ol className={s.motivos}>
            {MOTIVOS.map((m) => (
              <li key={m.titulo}>
                <strong>{m.titulo}</strong>
                <span>{m.texto}</span>
              </li>
            ))}
          </ol>
          <p className={s.notaRodape}>
            Premissas da nota do fabricante estimadas (ICMS, IPI, PIS/Cofins e MVA), calibradas para
            fechar em R$ 4,89. Na calculadora, você usa os dados da sua nota.
          </p>
        </section>

        <section id="recursos" className={s.fundoSuave}>
          <div className={`${s.faixa} ${s.secao}`}>
            <p className={s.sobretitulo}>Recursos</p>
            <h2>Do produto avulso à carteira inteira</h2>
            <p className={s.lide}>
              <Link href="/funcionalidades" className={s.secundario}>
                Ver como cada funcionalidade funciona
              </Link>
            </p>
            <div className={s.grade}>
              {RECURSOS.map((r) => (
                <article key={r.titulo} className={s.cartao}>
                  <Icone d={r.icone} />
                  <h3>{r.titulo}</h3>
                  <p>{r.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${s.faixa} ${s.secao}`}>
          <p className={s.sobretitulo}>Transparência</p>
          <h2>Nenhum número com aparência de certo</h2>
          <div className={s.status}>
            <div>
              <SeloStatus status="EM_VIGOR" />
              <p>Regra publicada e produzindo efeitos.</p>
            </div>
            <div>
              <SeloStatus status="PUBLICADO_EFEITO_FUTURO" />
              <p>Publicada, com efeito a partir de uma data futura.</p>
            </div>
            <div>
              <SeloStatus status="PENDENTE" />
              <p>Depende de ato ainda não publicado (Senado, TCU, CGSN).</p>
            </div>
            <div>
              <SeloStatus status="ESTIMATIVA" />
              <p>Sem norma ainda: valor estimado e sinalizado como tal.</p>
            </div>
          </div>
        </section>

        <section id="api" className={s.fundoEscuro}>
          <div className={`${s.faixa} ${s.secao} ${s.api}`}>
            <div>
              <p className={s.sobretitulo}>API</p>
              <h2>Integre o cálculo ao seu sistema</h2>
              <p>
                Tokens de serviço por organização, valores em texto decimal, erros em português e a
                versão do motor e das regras em toda resposta.
              </p>
              <a href="/v1/openapi.json" className={s.secundario}>
                Ver o contrato OpenAPI
              </a>
            </div>
            <pre className={s.codigo}>
              <code>{`POST /v1/simulacoes
Authorization: Bearer cf_live_…

{
  "venda": { "regime": "SIMPLES_DAS",
             "aliquotaDas": "0.08",
             "despesasVariaveis": "0.06",
             "margem": "0.25" },
  "itens": [{ "ncm": "2202.10.00",
              "compra": { "totalNota": "4.89", … } }]
}`}</code>
            </pre>
          </div>
        </section>

        <section className={`${s.faixa} ${s.chamada}`}>
          <h2>Comece com a sua nota de compra</h2>
          <p>Informe o custo de hoje e veja o preço que mantém a sua margem até 2033.</p>
          <Link href="/cadastro" className={s.botao}>
            Criar conta grátis
          </Link>
        </section>
      </main>

      <RodapePublico />
    </div>
  );
}
