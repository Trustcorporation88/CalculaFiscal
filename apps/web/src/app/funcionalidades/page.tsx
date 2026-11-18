import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  CENARIOS,
  DESCRICAO_CENARIOS,
  tabelaOficial,
  tratamentosDisponiveis,
  tratamentosServicoDisponiveis,
} from '@calculafiscal/regras';
import { SeloStatus } from '@/components/calculadora/selo-status';
import { CabecalhoPublico, RodapePublico } from '@/components/publico/estrutura';
import { LinkFuncionalidades } from '@/components/publico/link-funcionalidades';
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
        <LinkFuncionalidades className={s.voltar}>
          ↑ Ver todas as funcionalidades
        </LinkFuncionalidades>
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
  const tratamentosServico = tratamentosServicoDisponiveis();
  const zero = tratamentos.filter((t) => t.reducao === '1');
  const sessenta = tratamentos.filter((t) => t.reducao !== '1');

  return (
    <div className={s.pagina}>
      <CabecalhoPublico />

      <main>
        <section id="topo" className={`${s.faixa} ${s.topoPagina}`}>
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
            titulo="Calculadora de preço, 2026 a 2033 (mercadorias e serviços)"
            resumo="O preço que mantém a sua margem em cada ano da transição, para uma mercadoria ou prestação de serviço."
            naTela={
              <ul className={s.listaTela}>
                <li>Nota de compra (ou XML da NF-e) e custo líquido de cada ano</li>
                <li>Comparativo: fornecedor mantendo preço líquido x preço bruto</li>
                <li>ICMS, ISS, PIS/Cofins ou DAS, CBS e IBS da venda</li>
                <li>Crédito que o seu cliente aproveita</li>
                <li>Lucro e as duas margens</li>
              </ul>
            }
          >
            <h3>O que você informa</h3>
            <ol className={s.passos}>
              <li>
                <strong>Mercadoria ou serviço:</strong> escolha entre mercadoria (com NCM e
                importação opcional do XML da NF-e de compra) ou prestação de serviço (transição do
                ISS até 2033, NBS e distinção entre folha salarial sem crédito e insumos tributados
                com crédito).
              </li>
              <li>
                <strong>Compra ou custos de hoje (2026):</strong> na mercadoria, o total da nota por
                unidade (ou XML da NF-e) com ICMS, IPI, PIS/Cofins e ICMS-ST; no serviço, o custo
                direto e a parcela vinda de insumos no regime regular.
              </li>
              <li>
                <strong>Premissa do fornecedor:</strong> compare o fornecedor que repassa a extinção
                de PIS/Cofins e IPI (mantém o preço líquido) com o que não repassa (mantém o preço
                bruto). O resultado já traz o comparativo imediato entre os dois modos.
              </li>
              <li>
                <strong>Venda e margem:</strong> o regime (Simples no DAS ou no regime regular,
                Presumido ou Real), os tributos da saída (ICMS ou ISS), as despesas variáveis, a
                margem desejada e a base da margem (as duas bases aparecem sempre).
              </li>
            </ol>
            <p>
              <Link href="/app/calculadora?exemplo=coca">Exemplo da Coca-Cola</Link> ·{' '}
              <Link href="/app/calculadora?exemplo=servico">
                Exemplo de serviço contábil (redução de 30%)
              </Link>{' '}
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
              Ao informar o NCM de 8 dígitos, a calculadora sugere o tratamento e valida contra os
              anexos oficiais da Receita Federal (incluindo exceções por subposição). Confira sempre
              se a descrição comercial do produto atende ao item do anexo.
            </p>
          </Bloco>

          <Bloco
            id="lote"
            numero={8}
            titulo="Simulação em lote (planilhas e XMLs de NF-e)"
            resumo="Até 500 itens por lote, a partir de planilha (.xlsx/.csv) ou de múltiplos XMLs de NF-e de compra."
            naTela={
              <ul className={s.listaTela}>
                <li>Upload de .xlsx, .csv ou múltiplos .xml de NF-e</li>
                <li>O que o cliente paga em 2026, 2027, 2029 e 2033</li>
                <li>Preço psicológico e status de cada ano</li>
                <li>Alertas fiscais do XML (ICMS60, PISNT) e erros por linha</li>
              </ul>
            }
          >
            <ol className={s.passos}>
              <li>
                <strong>Por XML da NF-e:</strong> selecione um ou vários arquivos <code>.xml</code>{' '}
                de notas de compra; cada item <code>&lt;det&gt;</code> (incluindo o{' '}
                <code>cClassTrib</code> de 2026 quando presente) vira uma linha do lote.
              </li>
              <li>
                <strong>Por planilha:</strong> baixe o modelo (<code>.xlsx</code>), preencha uma
                linha por produto (percentuais em número: 18 para 18%) e envie <code>.xlsx</code> ou{' '}
                <code>.csv</code>.
              </li>
              <li>
                Escolha o regime, a margem, o cenário e a premissa do fornecedor (preço líquido ou
                preço bruto) e baixe o resultado completo em Excel.
              </li>
            </ol>
            <p>
              Planilhas e XMLs são lidos no seu navegador (com bloqueio contra entidades externas e
              limite de 5 MB por arquivo); apenas os campos fiscais extraídos vão para o cálculo.
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
                data, sugestão e crítica de CST/cClassTrib por NCM ou NBS e cenários. O contrato
                está em <a href="/v1/openapi.json">/v1/openapi.json</a>.
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
              <li>
                Partilha automática do DAS por anexo no Simples Nacional: aguarda definição nas
                Resoluções CGSN (na calculadora oficial da Receita Federal, os percentuais efetivos
                pIBSSN e pCBSSN são informados pelo contribuinte; no site e na API você já pode
                informar essa proporção manualmente quando quiser simular).
              </li>
              <li>
                Reduções condicionadas a quem compra (administração pública, produtor rural não
                contribuinte e Zona Franca de Manaus).
              </li>
              <li>
                Regimes específicos (combustíveis monofásicos, serviços financeiros, imóveis, bares
                e hotelaria).
              </li>
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
