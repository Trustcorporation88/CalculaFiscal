'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import type { ValoresFormulario } from '@/lib/calculadora/entrada';
import { AVISO_REDUCOES } from '@/lib/calculadora/avisos';
import { abasDoResultado } from '@/lib/calculadora/planilha';
import { CampoCenario, CampoNumero, CamposVenda } from '@/components/calculadora/campos';
import { CenariosLadoALado } from '@/components/calculadora/cenarios';
import { Comparador } from '@/components/calculadora/comparador';
import { BotoesExportar } from '@/components/calculadora/exportar';
import { Fontes } from '@/components/calculadora/fontes';
import { reaisMilesimos } from '@/components/calculadora/formato';
import { LinhaDoTempo } from '@/components/calculadora/linha-do-tempo';
import { MemoriaCalculo } from '@/components/calculadora/memoria-calculo';
import { PrecoPsicologico } from '@/components/calculadora/psicologico';
import { ResumoEntrada } from '@/components/calculadora/resumo-entrada';
import { calcular, type EstadoCalculadora } from './actions';

const INICIAL: EstadoCalculadora = { situacao: 'vazio' };

export function FormularioCalculadora({ iniciais }: { iniciais: ValoresFormulario }) {
  const [estado, acao, pendente] = useActionState(calcular, INICIAL);
  const [temSt, setTemSt] = useState(iniciais['temSt'] === 'on');
  const erros = estado.situacao === 'erro' ? estado.campos : {};
  const p = { iniciais, erros };

  // onSubmit em vez de action: o React não limpa o formulário depois do cálculo.
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => acao(dados));
  }

  return (
    <>
      <form onSubmit={enviar} className="calculadora nao-imprimir" noValidate>
        <fieldset>
          <legend>Produto e cenário</legend>
          <div className="campo">
            <label htmlFor="descricao">
              Descrição <span className="ajuda">opcional</span>
            </label>
            <input
              id="descricao"
              name="descricao"
              maxLength={120}
              defaultValue={iniciais['descricao'] ?? ''}
            />
          </div>
          <div className="campo">
            <label htmlFor="ncm">
              NCM <span className="ajuda">opcional, necessário para o Imposto Seletivo</span>
            </label>
            <input
              id="ncm"
              name="ncm"
              inputMode="numeric"
              placeholder="2202.10.00"
              defaultValue={iniciais['ncm'] ?? ''}
              aria-invalid={erros['ncm'] ? true : undefined}
              aria-describedby={erros['ncm'] ? 'ncm-erro' : undefined}
            />
            {erros['ncm'] && (
              <p id="ncm-erro" className="erro-campo">
                {erros['ncm']}
              </p>
            )}
          </div>
          <CampoCenario iniciais={iniciais} />
        </fieldset>

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

        <fieldset>
          <legend>Venda: como a sua empresa vende</legend>
          <CamposVenda {...p} />
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
  // O regime do cálculo, não o do formulário (que pode ter mudado depois).
  const simples = e.regime === 'SIMPLES_DAS' || e.regime === 'SIMPLES_REGULAR';
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
        Premissa: o fornecedor mantém o preço líquido de {reaisMilesimos(r.precoLiquidoFornecedor)}{' '}
        (sem tributos), calculado a partir da sua nota de 2026. Se ele mantiver o preço bruto, o
        custo dos anos seguintes muda.
        {r.faixaPrecoLiquido.de !== r.faixaPrecoLiquido.ate && (
          <>
            {' '}
            Como a nota tem só centavos, qualquer preço líquido entre{' '}
            {reaisMilesimos(r.faixaPrecoLiquido.de)} e {reaisMilesimos(r.faixaPrecoLiquido.ate)}{' '}
            fecha o mesmo total; os anos seguintes podem variar alguns centavos dentro dessa faixa.
          </>
        )}
      </p>

      {r.ajusteNota && <p className="aviso aviso-pendente">{r.ajusteNota}</p>}
      <p className="aviso aviso-pendente">{AVISO_REDUCOES}</p>

      <h3>Linha do tempo</h3>
      <LinhaDoTempo anos={r.anos} simples={simples} />

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
        <summary>Preço líquido do fornecedor a partir da nota</summary>
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
