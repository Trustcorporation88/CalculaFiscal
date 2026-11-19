'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import type { NaturezaCalculo } from '@calculafiscal/regras/resolver';
import type { ValoresFormulario } from '@/lib/calculadora/entrada';
import { avisoTratamento, type TratamentoInformado } from '@/lib/calculadora/avisos';
import { abasDoResultado } from '@/lib/calculadora/planilha';
import { ROTULO_MODO_FORNECEDOR, ROTULO_NATUREZA } from '@/lib/calculadora/rotulos';
import { lerXmlNfe, type ItemXmlNfe } from '@/lib/calculadora/xml-nfe';
import {
  CampoCenario,
  CampoModoFornecedor,
  CampoNumero,
  CampoTratamento,
  CamposVenda,
} from '@/components/calculadora/campos';
import { CenariosLadoALado } from '@/components/calculadora/cenarios';
import { Comparador } from '@/components/calculadora/comparador';
import { BotoesExportar } from '@/components/calculadora/exportar';
import { Fontes } from '@/components/calculadora/fontes';
import { reais, reaisMilesimos } from '@/components/calculadora/formato';
import { LinhaDoTempo } from '@/components/calculadora/linha-do-tempo';
import { MemoriaCalculo } from '@/components/calculadora/memoria-calculo';
import { PrecoPsicologico } from '@/components/calculadora/psicologico';
import { ResumoEntrada } from '@/components/calculadora/resumo-entrada';
import { calcular, type EstadoCalculadora } from './actions';

const INICIAL: EstadoCalculadora = { situacao: 'vazio' };

export function FormularioCalculadora({
  iniciais: baseIniciais,
  tratamentosMercadoria,
  tratamentosServico,
}: {
  iniciais: ValoresFormulario;
  tratamentosMercadoria: readonly TratamentoInformado[];
  tratamentosServico: readonly TratamentoInformado[];
}) {
  const [estado, acao, pendente] = useActionState(calcular, INICIAL);
  const [iniciais, setIniciais] = useState<ValoresFormulario>(baseIniciais);
  const [versaoImportacao, setVersaoImportacao] = useState(0);
  const [natureza, setNatureza] = useState<NaturezaCalculo>(
    (baseIniciais['natureza'] as NaturezaCalculo) || 'MERCADORIA',
  );
  const [temSt, setTemSt] = useState(baseIniciais['temSt'] === 'on');
  const [ncm, setNcm] = useState(baseIniciais['ncm'] ?? '');
  const [nbs, setNbs] = useState(baseIniciais['nbs'] ?? '');
  const [xmlItens, setXmlItens] = useState<readonly ItemXmlNfe[] | null>(null);
  const [xmlCabecalho, setXmlCabecalho] = useState<string | null>(null);
  const [xmlObservacoes, setXmlObservacoes] = useState<readonly string[]>([]);
  const [xmlErro, setXmlErro] = useState<string | null>(null);

  const ehServico = natureza === 'SERVICO';
  const erros = estado.situacao === 'erro' ? estado.campos : {};
  const p = { iniciais, erros };

  function aplicarItemXml(item: ItemXmlNfe) {
    setNatureza('MERCADORIA');
    setIniciais((ant) => ({ ...ant, ...item.valores }));
    setNcm(item.valores['ncm'] ?? '');
    setTemSt(item.valores['temSt'] === 'on');
    setXmlObservacoes(item.observacoes);
    setVersaoImportacao((n) => n + 1);
  }

  async function importarXml(arquivo: File | undefined) {
    setXmlErro(null);
    setXmlObservacoes([]);
    setXmlItens(null);
    setXmlCabecalho(null);
    if (!arquivo) return;
    try {
      const lido = lerXmlNfe(await arquivo.text());
      if (!lido.ok) {
        setXmlErro(lido.erro);
        return;
      }
      const origem = [lido.chaveOuNumero, lido.emitente].filter(Boolean).join(' · ');
      setXmlCabecalho(origem || arquivo.name);
      if (lido.itens.length === 1 && lido.itens[0]) {
        aplicarItemXml(lido.itens[0]);
      } else {
        setXmlItens(lido.itens);
        if (lido.itens[0]) aplicarItemXml(lido.itens[0]);
      }
    } catch {
      setXmlErro('Não foi possível ler o arquivo XML.');
    }
  }

  function trocarNatureza(nova: NaturezaCalculo) {
    setNatureza(nova);
    setIniciais((ant) => ({ ...ant, natureza: nova, cClassTrib: '000001' }));
    setVersaoImportacao((n) => n + 1);
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    dados.delete('arquivoXml');
    startTransition(() => acao(dados));
  }

  return (
    <>
      <form onSubmit={enviar} className="calculadora nao-imprimir" noValidate>
        <fieldset>
          <legend>Operação, item e cenário</legend>
          <div className="campo">
            <label htmlFor="natureza">Tipo de operação</label>
            <select
              id="natureza"
              name="natureza"
              value={natureza}
              onChange={(e) => trocarNatureza(e.target.value as NaturezaCalculo)}
            >
              {(Object.keys(ROTULO_NATUREZA) as NaturezaCalculo[]).map((n) => (
                <option key={n} value={n}>
                  {ROTULO_NATUREZA[n]}
                </option>
              ))}
            </select>
          </div>

          {!ehServico && (
            <div className="campo campo-largo">
              <label htmlFor="arquivoXml">
                Importar XML da NF-e de compra{' '}
                <span className="ajuda">opcional, lido no navegador</span>
              </label>
              <input
                id="arquivoXml"
                name="arquivoXml"
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={(e) => void importarXml(e.target.files?.[0])}
              />
              {xmlCabecalho && (
                <p className="ajuda" role="status">
                  Carregado de {xmlCabecalho}.
                </p>
              )}
              {xmlItens && xmlItens.length > 1 && (
                <div className="campo">
                  <label htmlFor="itemXmlEscolhido">
                    A nota tem {xmlItens.length} itens: escolha qual preencher
                  </label>
                  <select
                    id="itemXmlEscolhido"
                    onChange={(e) => {
                      const item = xmlItens.find((x) => String(x.numeroItem) === e.target.value);
                      if (item) aplicarItemXml(item);
                    }}
                  >
                    {xmlItens.map((it) => (
                      <option key={it.numeroItem} value={String(it.numeroItem)}>
                        Item {it.numeroItem}: {it.descricao} (NCM {it.ncm || 'sem NCM'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {xmlObservacoes.map((obs) => (
                <p key={obs} className="aviso aviso-pendente">
                  {obs}
                </p>
              ))}
              {xmlErro && <p className="erro-campo">{xmlErro}</p>}
            </div>
          )}

          <div className="campo">
            <label htmlFor="descricao">
              Descrição <span className="ajuda">opcional</span>
            </label>
            <input
              key={`descricao:${versaoImportacao}`}
              id="descricao"
              name="descricao"
              maxLength={120}
              defaultValue={iniciais['descricao'] ?? ''}
            />
          </div>

          {ehServico ? (
            <div className="campo">
              <label htmlFor="nbs">
                NBS{' '}
                <span className="ajuda">
                  opcional, 9 dígitos (sugere anexos de educação, saúde e outros)
                </span>
              </label>
              <input
                id="nbs"
                name="nbs"
                inputMode="numeric"
                placeholder="1.1302.21.00"
                value={nbs}
                onChange={(e) => setNbs(e.target.value)}
                aria-invalid={erros['nbs'] ? true : undefined}
                aria-describedby={erros['nbs'] ? 'nbs-erro' : undefined}
              />
              {erros['nbs'] && (
                <p id="nbs-erro" className="erro-campo">
                  {erros['nbs']}
                </p>
              )}
            </div>
          ) : (
            <div className="campo">
              <label htmlFor="ncm">
                NCM{' '}
                <span className="ajuda">
                  opcional, usado no Imposto Seletivo e na sugestão do cClassTrib
                </span>
              </label>
              <input
                id="ncm"
                name="ncm"
                inputMode="numeric"
                placeholder="2202.10.00"
                value={ncm}
                onChange={(e) => setNcm(e.target.value)}
                aria-invalid={erros['ncm'] ? true : undefined}
                aria-describedby={erros['ncm'] ? 'ncm-erro' : undefined}
              />
              {erros['ncm'] && (
                <p id="ncm-erro" className="erro-campo">
                  {erros['ncm']}
                </p>
              )}
            </div>
          )}

          <CampoCenario iniciais={iniciais} />
          <CampoTratamento
            key={`tratamento:${natureza}:${versaoImportacao}`}
            iniciais={iniciais}
            erros={erros}
            tratamentos={ehServico ? tratamentosServico : tratamentosMercadoria}
            ncm={ncm}
            nbs={nbs}
            natureza={natureza}
          />
        </fieldset>

        {ehServico ? (
          <fieldset>
            <legend>Custos diretos do serviço hoje (2026)</legend>
            <CampoNumero
              nome="custoDireto"
              rotulo="Custo direto por serviço"
              sufixo="R$"
              ajuda="Mão de obra direta mais insumos consumidos para prestar o serviço."
              {...p}
            />
            <CampoNumero
              nome="parcelaInsumosTributados"
              rotulo="Parcela desse custo em insumos de fornecedores no regime regular"
              sufixo="%"
              obrigatorio={false}
              ajuda="Folha salarial não gera crédito de CBS/IBS. Sistemas, energia, aluguel e insumos de PJ no regime regular geram crédito de 2027 em diante."
              {...p}
            />
            <CampoNumero
              nome="aliquotaPisCofinsInsumos"
              rotulo="PIS e Cofins embutido nesses insumos hoje"
              sufixo="%"
              obrigatorio={false}
              ajuda="Ex.: 9,25% ou 3,65%. Usado para reconstruir o custo dos insumos em 2027."
              {...p}
            />
            <CampoModoFornecedor
              iniciais={iniciais}
              rotulo="Como os fornecedores dos insumos formam o preço em 2027"
            />
          </fieldset>
        ) : (
          <fieldset>
            <legend>Compra: a nota do fornecedor hoje (2026)</legend>
            <CampoNumero
              nome="notaCompra"
              rotulo="Total da nota por unidade"
              sufixo="R$"
              ajuda="Com IPI e ICMS-ST, como está na nota."
              {...p}
            />
            <CampoNumero nome="aliquotaIcms" rotulo="ICMS do fornecedor" sufixo="%" {...p} />
            <CampoNumero nome="aliquotaIpi" rotulo="IPI" sufixo="%" {...p} />
            <CampoNumero
              nome="aliquotaPisCofins"
              rotulo="PIS e Cofins do fornecedor"
              sufixo="%"
              ajuda="Embutidos no preço. No monofásico, a soma das alíquotas da indústria."
              {...p}
            />
            <CampoNumero
              nome="freteEDespesas"
              rotulo="Frete e despesas da compra"
              sufixo="R$"
              obrigatorio={false}
              {...p}
            />
            <CampoModoFornecedor iniciais={iniciais} />
            <div className="campo campo-caixa">
              <input
                id="temSt"
                name="temSt"
                type="checkbox"
                checked={temSt}
                onChange={(e) => setTemSt(e.target.checked)}
              />
              <label htmlFor="temSt">A compra tem ICMS por substituição tributária (ST)</label>
            </div>
            {temSt && (
              <>
                <CampoNumero nome="mva" rotulo="MVA" sufixo="%" {...p} />
                <CampoNumero
                  nome="aliquotaInterna"
                  rotulo="Alíquota interna do ICMS-ST"
                  sufixo="%"
                  {...p}
                />
              </>
            )}
          </fieldset>
        )}

        <fieldset>
          <legend>Venda: como a sua empresa vende</legend>
          <CamposVenda iniciais={iniciais} erros={erros} natureza={natureza} />
          <CampoNumero
            nome="impostoSimplificado"
            rotulo="Imposto do cálculo simplificado, para comparar"
            sufixo="%"
            ajuda="O percentual que o mercado costuma pôr por dentro no markup (ex.: 26,5%)."
            {...p}
          />
        </fieldset>

        {estado.situacao === 'erro' && (
          <p role="alert" className="aviso aviso-erro">
            {estado.mensagem}
          </p>
        )}
        <button type="submit" disabled={pendente}>
          {pendente ? 'Calculando...' : 'Calcular 2026 a 2033'}
        </button>
      </form>

      {estado.situacao === 'ok' && <Resultado estado={estado} />}
    </>
  );
}

function Resultado({ estado }: { estado: Extract<EstadoCalculadora, { situacao: 'ok' }> }) {
  const r = estado.resultado;
  const e = r.entrada;
  const simples = e.regime === 'SIMPLES_DAS' || e.regime === 'SIMPLES_REGULAR';
  const ehServico = e.natureza === 'SERVICO';
  const alt2027 = r.comparativoFornecedor.anos.find((a) => a.ano === 2027)?.precoComTributo;
  const alt2033 = r.comparativoFornecedor.anos.find((a) => a.ano === 2033)?.precoComTributo;

  return (
    <section className="resultado" aria-live="polite" aria-labelledby="titulo-resultado">
      <div className="topo">
        <h2 id="titulo-resultado">{e.descricao || 'Resultado'}</h2>
        <BotoesExportar nome={e.descricao} montarAbas={() => abasDoResultado(r, new Date())} />
      </div>
      <p className="so-imprimir ajuda">
        Gerado em {new Date().toLocaleString('pt-BR')} · tabela de regras {r.versaoRegras} · motor{' '}
        {r.versaoMotor}
      </p>
      <ResumoEntrada entrada={e} />
      <p className="aviso aviso-estimativa">
        {ehServico ? (
          <>
            Premissa nos insumos ({ROTULO_MODO_FORNECEDOR[e.modoFornecedor]}).
            {alt2027 && alt2033 && (
              <>
                {' '}
                No modo alternativo (
                {ROTULO_MODO_FORNECEDOR[r.comparativoFornecedor.modoAlternativo]}), o cliente
                pagaria {reais(alt2027)} em 2027 e {reais(alt2033)} em 2033.
              </>
            )}
          </>
        ) : (
          <>
            Premissa selecionada: {ROTULO_MODO_FORNECEDOR[e.modoFornecedor]} (preço líquido base de{' '}
            {reaisMilesimos(r.precoLiquidoFornecedor)} calculado a partir da nota de 2026).
            {r.faixaPrecoLiquido.de !== r.faixaPrecoLiquido.ate && (
              <>
                {' '}
                Faixa que fecha o mesmo centavo da nota: {reaisMilesimos(
                  r.faixaPrecoLiquido.de,
                )} a {reaisMilesimos(r.faixaPrecoLiquido.ate)}.
              </>
            )}
            {alt2027 && alt2033 && (
              <>
                {' '}
                Comparativo imediato: em{' '}
                <strong>{ROTULO_MODO_FORNECEDOR[r.comparativoFornecedor.modoAlternativo]}</strong>,
                o cliente pagaria <strong>{reais(alt2027)}</strong> em 2027 e{' '}
                <strong>{reais(alt2033)}</strong> em 2033.
              </>
            )}
          </>
        )}
      </p>

      {r.ajusteNota && <p className="aviso aviso-pendente">{r.ajusteNota}</p>}
      <p className="aviso aviso-pendente">
        {avisoTratamento(r.tratamento, ehServico ? e.nbs : e.ncm, e.natureza)}
      </p>

      <h3>Linha do tempo</h3>
      <LinhaDoTempo anos={r.anos} simples={simples} servico={ehServico} />

      <h3>Preço psicológico</h3>
      <PrecoPsicologico anos={r.anos} sugestoes={r.sugestoes} />

      <h3>Cenários lado a lado</h3>
      <CenariosLadoALado cenarios={r.cenarios} escolhido={e.cenario} />

      <h3>Simplificado x correto</h3>
      <Comparador
        simplificado={r.simplificado}
        impostoSimplificado={e.impostoSimplificado}
        anos={r.anos}
      />

      <h3>Memória de cálculo</h3>
      <details>
        <summary>
          {ehServico
            ? 'Base de custos diretos do serviço'
            : 'Preço líquido do fornecedor a partir da nota'}
        </summary>
        <MemoriaCalculo passos={[r.memoriaNota]} />
      </details>
      {r.anos.map((a) => (
        <details key={a.ano}>
          <summary>{a.ano}</summary>
          {a.memoria.length > 0 ? (
            <MemoriaCalculo passos={a.memoria} />
          ) : (
            <p className="ajuda">Sem cálculo neste ano: dado pendente.</p>
          )}
        </details>
      ))}

      <h3>Fontes e status das regras</h3>
      <Fontes fontes={r.fontes} />
      <p className="ajuda">
        Tabela de regras {r.versaoRegras} · motor {r.versaoMotor}. Simulação para apoio à decisão;
        não substitui a análise do contador responsável.
      </p>
    </section>
  );
}
