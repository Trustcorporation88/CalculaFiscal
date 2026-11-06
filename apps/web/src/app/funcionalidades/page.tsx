import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  CENARIOS,
  DESCRICAO_CENARIOS,
  tabelaOficial,
  tratamentosDisponiveis,
} from '@calculafiscal/regras';
import { SeloStatus } from '@/components/calculadora/selo-status';
import { CabecalhoPublico, RodapePublico } from '@/components/publico/estrutura';
import s from '@/components/publico/publico.module.css';
import { rotuloReducao } from '@/lib/calculadora/avisos';

export const metadata: Metadata = {
  title: 'Funcionalidades | Calculadora Fiscal',
  description:
    'Como funcionam a calculadora 2026–2033, os cenários, o preço psicológico, as reduções da LC 214, o lote por planilha, as exportações e a API da Calculadora Fiscal.',
};

type Item = { id: string; titulo: string };

const SUMARIO: Item[] = [
  { id: 'calculadora', titulo: 'Calculadora 2026 a 2033' },
  { id: 'status', titulo: 'Status das premissas' },
  { id: 'cenarios', titulo: 'Cenários' },
  { id: 'psicologico', titulo: 'Preço psicológico' },
  { id: 'comparativo', titulo: 'Simplificado x correto' },
  { id: 'memoria', titulo: 'Memória de cálculo e fontes' },
  { id: 'reducoes', titulo: 'Reduções da LC 214' },
  { id: 'lote', titulo: 'Simulação em lote' },
  { id: 'exportar', titulo: 'Excel e PDF' },
  { id: 'api', titulo: 'API e tokens' },
  { id: 'seguranca', titulo: 'Conta e segurança' },
  { id: 'limites', titulo: 'O que ainda não faz' },
];

function Bloco({
  id,
  numero,
  titulo,
  resumo,
  children,
  naTela,
}: {
  id: string;
  numero: number;
  titulo: string;
  resumo: string;
  children: ReactNode;
  naTela?: ReactNode;
}) {
  return (
    <section id={id} className={s.bloco} aria-labelledby={`titulo-${id}`}>
      <div>
        <p className={s.sobretitulo}>{String(numero).padStart(2, '0')}</p>
        <h2 id={`titulo-${id}`}>{titulo}</h2>
        <p className={s.lide}>{resumo}</p>
        <div className={s.textoBloco}>{children}</div>
      </div>
      {naTela && (
        <aside className={s.naTela} aria-label={`Na tela: ${titulo}`}>
          <p className={s.rotulo}>Na tela</p>
          {naTela}
        </aside>
      )}
    </section>
  );
}

export default function Funcionalidades() {
  const tratamentos = tratamentosDisponiveis(tabelaOficial().regras);
  const zero = tratamentos.filter((t) => t.reducao === '1');
  const sessenta = tratamentos.filter((t) => t.reducao !== '1');

  return (
    <div className={s.pagina}>
      <CabecalhoPublico />

      <main>
        <section className={`${s.faixa} ${s.topoPagina}`}>
          <p className={s.sobretitulo}>Funcionalidades</p>
          <h1>Tudo o que a Calculadora Fiscal faz, e como</h1>
          <p className={s.lide}>
            Você informa a nota de compra de hoje e como a sua empresa vende. A Calculadora Fiscal
            projeta o preço que mantém a sua margem em cada ano da Reforma, de 2026 a 2033, e mostra
            de onde vem cada número.
          </p>
          <nav className={s.sumario} aria-label="Nesta página">
            {SUMARIO.map((i) => (
              <a key={i.id} href={`#${i.id}`}>
                {i.titulo}
              </a>
            ))}
          </nav>
        </section>

        <div className={s.faixa}>
          <Bloco
            id="calculadora"
            numero={1}
            titulo="Calculadora de preço, 2026 a 2033"
            resumo="O preço que mantém a sua margem em cada ano da transição, para um produto."
            naTela={
              <ul className={s.listaTela}>
                <li>Nota de compra e custo líquido de cada ano</li>
                <li>Preço de venda e o que o cliente paga</li>
                <li>ICMS, PIS/Cofins ou DAS, CBS e IBS da venda</li>
                <li>Crédito que o seu cliente aproveita</li>
                <li>Lucro e as duas margens</li>
              </ul>
            }
          >
            <h3>O que você informa</h3>
            <ol className={s.passos}>
              <li>
                <strong>Produto:</strong> descrição, NCM (necessário para o Imposto Seletivo) e o
                tratamento de CBS/IBS, quando houver redução.
              </li>
              <li>
                <strong>Compra de hoje (2026):</strong> o total da nota por unidade e as alíquotas
                do fornecedor: ICMS, IPI, PIS/Cofins e, se houver, ICMS-ST (MVA e alíquota interna).
              </li>
              <li>
                <strong>Venda:</strong> o regime (Simples no DAS ou no regime regular, Presumido ou
                Real), os tributos da saída, as despesas variáveis e a margem desejada.
              </li>
              <li>
                <strong>Base da margem:</strong> sobre o preço com tributo (o que o cliente paga) ou
                sobre a receita líquida. As duas margens aparecem sempre.
              </li>
            </ol>
            <p>
              A partir da nota, a calculadora encontra o preço líquido do fornecedor e o mantém nos
              anos seguintes. Essa premissa e a faixa de valores que fecham a mesma nota aparecem
              junto do resultado.
            </p>
            <p>
              <Link href="/app/calculadora?exemplo=coca">Abrir a calculadora com o exemplo</Link>{' '}
              (exige login).
            </p>
          </Bloco>

          <Bloco
            id="status"
            numero={2}
            titulo="Status das premissas"
            resumo="Cada ano mostra o quanto a regra por trás do número já está definida."
            naTela={
              <ul className={s.listaSelos}>
                <li>
                  <SeloStatus status="EM_VIGOR" /> 2026
                </li>
                <li>
                  <SeloStatus status="PENDENTE" /> 2027
                </li>
                <li>
                  <SeloStatus status="ESTIMATIVA" /> 2028 a 2033
                </li>
              </ul>
            }
          >
            <ul className={s.marcadores}>
              <li>
                <SeloStatus status="EM_VIGOR" /> regra publicada e produzindo efeitos.
              </li>
              <li>
                <SeloStatus status="PUBLICADO_EFEITO_FUTURO" /> publicada, com efeito numa data
                futura (por exemplo, o Imposto Seletivo a partir de fevereiro de 2027).
              </li>
              <li>
                <SeloStatus status="PENDENTE" /> depende de ato ainda não publicado, como a alíquota
                de referência da CBS pelo Senado.
              </li>
              <li>
                <SeloStatus status="ESTIMATIVA" /> sem norma ainda: valor estimado e sinalizado.
              </li>
            </ul>
            <p>
              O status de um ano é o da regra menos firme usada nele. Quando falta um dado sem o
              qual não há conta honesta, como a partilha do DAS no Simples regular, o ano aparece
              como <strong>dado pendente</strong>, sem número.
            </p>
          </Bloco>

          <Bloco
            id="cenarios"
            numero={3}
            titulo="Cenários lado a lado"
            resumo="O mesmo produto em todos os cenários de premissas, para ver quanto cada incerteza pesa."
          >
            <ul className={s.marcadores}>
              {CENARIOS.map((c) => (
                <li key={c}>{DESCRICAO_CENARIOS[c]}.</li>
              ))}
            </ul>
            <p>
              Você escolhe o cenário principal no formulário; o resultado traz uma tabela com o que
              o cliente paga em cada ano, em todos eles, com o escolhido destacado.
            </p>
          </Bloco>

          <Bloco
            id="psicologico"
            numero={4}
            titulo="Preço psicológico"
            resumo="O próximo preço com final comercial, ano a ano, com a margem efetiva nele."
            naTela={
              <ul className={s.listaTela}>
                <li>R$ 7,09 → R$ 7,49</li>
                <li>R$ 12,34 → R$ 12,90</li>
                <li>R$ 123,45 → R$ 129,90</li>
              </ul>
            }
          >
            <p>
              Até R$ 10, finais ,49, ,90 ou ,99; de R$ 10 a R$ 100, ,90 ou ,99; acima disso, a
              dezena terminada em 9,90. O arredondamento é sempre para cima, então a margem nunca
              cai. Para cada ano aparecem o lucro e as duas margens no preço sugerido.
            </p>
          </Bloco>

          <Bloco
            id="comparativo"
            numero={5}
            titulo="Simplificado x correto"
            resumo="O markup com o imposto por dentro, que circula no mercado, ao lado do cálculo correto."
          >
            <p>
              O cálculo simplificado divide a nota por (1 − despesas − imposto − margem), com o
              percentual que você informar (por padrão, 26,5%). Ele ignora o crédito da compra, o
              imposto por fora e a transição. O correto mostra 2026, 2027 e 2033 lado a lado, com a
              memória de cada um.
            </p>
          </Bloco>

          <Bloco
            id="memoria"
            numero={6}
            titulo="Memória de cálculo e fontes"
            resumo="Cada número vem com a fórmula, os valores usados e as regras aplicadas."
          >
            <ul className={s.marcadores}>
              <li>
                <strong>Memória por ano:</strong> preço líquido do fornecedor, nota de compra,
                créditos, custo líquido, preço, tributos e lucro, passo a passo.
              </li>
              <li>
                <strong>Fontes:</strong> cada regra usada, com norma, artigo, vigência, valor,
                status e a marca &quot;a conferir&quot; quando ainda falta checar o texto legal.
              </li>
              <li>
                <strong>Versões:</strong> a tabela de regras e o motor de cálculo que produziram o
                resultado, para reproduzi-lo depois.
              </li>
            </ul>
          </Bloco>

          <Bloco
            id="reducoes"
            numero={7}
            titulo="Reduções e alíquota zero da LC 214"
            resumo="O tratamento de CBS e IBS do produto, pelo mesmo código da NF-e (cClassTrib)."
          >
            <p>
              Ao escolher o tratamento, a redução vale na compra e na venda, de 2027 em diante. Os
              percentuais vêm da tabela oficial de classificações da Receita Federal.
            </p>
            <div className={s.duasColunas}>
              <div>
                <h3>{rotuloReducao('1')}</h3>
                <ul className={s.marcadores}>
                  {zero.map((t) => (
                    <li key={t.codigo}>
                      <code>{t.codigo}</code> {t.descricao}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>{rotuloReducao(sessenta[0]?.reducao ?? '0.6')}</h3>
                <ul className={s.marcadores}>
                  {sessenta.map((t) => (
                    <li key={t.codigo}>
                      <code>{t.codigo}</code> {t.descricao}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className={s.nota}>
              Confira se o NCM do produto consta no anexo do tratamento: a sugestão automática pelo
              NCM ainda não está disponível.
            </p>
          </Bloco>

          <Bloco
            id="lote"
            numero={8}
            titulo="Simulação em lote"
            resumo="Uma planilha com até 500 produtos, com o mesmo perfil de venda."
            naTela={
              <ul className={s.listaTela}>
                <li>O que o cliente paga em 2026, 2027, 2029 e 2033</li>
                <li>Preço psicológico de cada ano</li>
                <li>Status de cada ano</li>
                <li>Erros explicados por linha</li>
              </ul>
            }
          >
            <ol className={s.passos}>
              <li>Baixe o modelo (.xlsx) na tela de lote.</li>
              <li>
                Preencha uma linha por produto: descrição, NCM, cClassTrib, total da nota e as
                alíquotas do fornecedor. Percentuais em número: 18 para 18%.
              </li>
              <li>Envie o arquivo (.xlsx ou .csv) e escolha o regime, a margem e o cenário.</li>
              <li>Baixe o resultado em Excel, com todos os anos de 2026 a 2033.</li>
            </ol>
            <p>
              A planilha é lida no seu navegador; só os valores das colunas do modelo vão para o
              cálculo. Uma linha com erro não para as outras, e a célula formatada como % no Excel é
              apontada em vez de adivinhada.
            </p>
          </Bloco>

          <Bloco
            id="exportar"
            numero={9}
            titulo="Exportação em Excel e PDF"
            resumo="Leve o resultado para a sua planilha, para o cliente ou para o contador."
          >
            <ul className={s.marcadores}>
              <li>
                <strong>Excel:</strong> abas com o resumo dos dados informados, a linha do tempo, o
                preço psicológico, os cenários, a memória de cálculo e as fontes.
              </li>
              <li>
                <strong>PDF:</strong> pela impressão do navegador (&quot;Salvar como PDF&quot;), em
                A4 paisagem, com a memória de cálculo aberta.
              </li>
            </ul>
          </Bloco>

          <Bloco
            id="api"
            numero={10}
            titulo="API e tokens de integração"
            resumo="O mesmo cálculo da tela dentro do seu sistema."
          >
            <ul className={s.marcadores}>
              <li>
                <strong>Rotas:</strong> simulação de até 20 itens por chamada, regras vigentes numa
                data e cenários. O contrato está em <a href="/v1/openapi.json">/v1/openapi.json</a>.
              </li>
              <li>
                <strong>Tokens:</strong> criados por dono ou administrador da organização, com
                escopos, mostrados uma única vez e revogáveis na hora.
              </li>
              <li>
                <strong>Convenções:</strong> valores em texto decimal, erros em português, limite de
                60 chamadas por minuto e a versão do motor e das regras em toda resposta.
              </li>
            </ul>
          </Bloco>

          <Bloco
            id="seguranca"
            numero={11}
            titulo="Conta, organização e segurança"
            resumo="Cada escritório ou empresa enxerga só os próprios dados."
          >
            <ul className={s.marcadores}>
              <li>
                Cadastro com confirmação por e-mail, senha de pelo menos 10 caracteres e link de
                acesso.
              </li>
              <li>
                Organizações com papéis (dono, administrador, analista, leitor), isoladas no banco
                de dados.
              </li>
              <li>
                Verificação em duas etapas (aplicativo autenticador), obrigatória para dono e
                administrador.
              </li>
              <li>Ações administrativas e criação de tokens ficam registradas na auditoria.</li>
            </ul>
          </Bloco>

          <Bloco
            id="limites"
            numero={12}
            titulo="O que ainda não faz"
            resumo="Para você saber exatamente onde o cálculo para."
          >
            <ul className={s.marcadores}>
              <li>Sugestão do tratamento (cClassTrib) a partir do NCM.</li>
              <li>
                Simples Nacional no regime regular: depende da partilha do DAS por anexo, ainda não
                definida pelo CGSN.
              </li>
              <li>
                Reduções que dependem de quem compra (administração pública, produtor rural, Zona
                Franca de Manaus).
              </li>
              <li>
                Serviços (transição do ISS) e regimes específicos, como combustíveis e imóveis.
              </li>
              <li>Importação de XML da NF-e e cenário em que o fornecedor mantém o preço bruto.</li>
            </ul>
          </Bloco>
        </div>

        <section className={`${s.faixa} ${s.chamada}`}>
          <h2>Experimente com a sua nota</h2>
          <p>Crie a conta, abra a calculadora e veja o preço que mantém a sua margem até 2033.</p>
          <Link href="/cadastro" className={s.botao}>
            Criar conta grátis
          </Link>
        </section>
      </main>

      <RodapePublico />
    </div>
  );
}
