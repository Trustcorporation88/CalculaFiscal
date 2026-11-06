'use client';

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from 'react';
import { CENARIOS, DESCRICAO_CENARIOS } from '@calculafiscal/regras/cenarios';
import type { Regime } from '@calculafiscal/motor-fiscal';
import type { ValoresFormulario } from '@/lib/calculadora/entrada';
import { Comparador } from '@/components/calculadora/comparador';
import { Fontes } from '@/components/calculadora/fontes';
import { reaisMilesimos } from '@/components/calculadora/formato';
import { LinhaDoTempo } from '@/components/calculadora/linha-do-tempo';
import { MemoriaCalculo } from '@/components/calculadora/memoria-calculo';
import { calcular, type EstadoCalculadora } from './actions';

const INICIAL: EstadoCalculadora = { situacao: 'vazio' };

const ROTULO_REGIME: Readonly<Record<Regime, string>> = {
  SIMPLES_DAS: 'Simples Nacional, CBS e IBS dentro do DAS',
  SIMPLES_REGULAR: 'Simples Nacional, CBS e IBS no regime regular',
  PRESUMIDO: 'Lucro Presumido',
  REAL: 'Lucro Real',
};

type CampoProps = {
  nome: string;
  rotulo: string;
  ajuda?: ReactNode;
  sufixo?: '%' | 'R$';
  obrigatorio?: boolean;
  iniciais: ValoresFormulario;
  erros: Readonly<Record<string, string>>;
};

/** Campo numérico em formato brasileiro (vírgula), com erro e ajuda ligados por aria. */
function CampoNumero({
  nome,
  rotulo,
  ajuda,
  sufixo,
  obrigatorio = true,
  iniciais,
  erros,
}: CampoProps) {
  const erro = erros[nome];
  const descricao = [ajuda ? `${nome}-ajuda` : null, erro ? `${nome}-erro` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="campo">
      <label htmlFor={nome}>
        {rotulo}
        {sufixo && <span className="ajuda"> ({sufixo})</span>}
        {!obrigatorio && <span className="ajuda"> opcional</span>}
      </label>
      <input
        id={nome}
        name={nome}
        inputMode="decimal"
        autoComplete="off"
        defaultValue={iniciais[nome] ?? ''}
        required={obrigatorio}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao || undefined}
      />
      {ajuda && (
        <p id={`${nome}-ajuda`} className="ajuda">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={`${nome}-erro`} className="erro-campo">
          {erro}
        </p>
      )}
    </div>
  );
}

export function FormularioCalculadora({ iniciais }: { iniciais: ValoresFormulario }) {
  const [estado, acao, pendente] = useActionState(calcular, INICIAL);
  const [regime, setRegime] = useState<Regime>((iniciais['regime'] as Regime) ?? 'SIMPLES_DAS');
  const [temSt, setTemSt] = useState(iniciais['temSt'] === 'on');
  const simples = regime === 'SIMPLES_DAS' || regime === 'SIMPLES_REGULAR';
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
      <form onSubmit={enviar} className="calculadora" noValidate>
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
          <div className="campo">
            <label htmlFor="cenario">Cenário</label>
            <select id="cenario" name="cenario" defaultValue={iniciais['cenario'] ?? 'base'}>
              {CENARIOS.map((c) => (
                <option key={c} value={c}>
                  {DESCRICAO_CENARIOS[c]}
                </option>
              ))}
            </select>
          </div>
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
          <div className="campo">
            <label htmlFor="regime">Regime</label>
            <select
              id="regime"
              name="regime"
              value={regime}
              onChange={(e) => setRegime(e.target.value as Regime)}
            >
              {(Object.keys(ROTULO_REGIME) as Regime[]).map((r) => (
                <option key={r} value={r}>
                  {ROTULO_REGIME[r]}
                </option>
              ))}
            </select>
          </div>
          {simples ? (
            <>
              <CampoNumero nome="aliquotaDas" rotulo="Alíquota efetiva do DAS" sufixo="%" {...p} />
              <CampoNumero
                nome="parcelaCbsIbsNoDas"
                rotulo="Parte do DAS que é CBS e IBS"
                sufixo="%"
                obrigatorio={false}
                ajuda="Ainda não definida pelo CGSN. Em branco, o crédito ao cliente aparece como pendente e o Simples no regime regular não é calculado."
                {...p}
              />
            </>
          ) : (
            <>
              <CampoNumero
                nome="aliquotaIcmsSaida"
                rotulo="ICMS na venda"
                sufixo="%"
                ajuda="Zero quando a ST já encerrou a tributação."
                {...p}
              />
              <div className="campo campo-caixa">
                <input
                  id="creditaIcmsEntrada"
                  name="creditaIcmsEntrada"
                  type="checkbox"
                  defaultChecked={iniciais['creditaIcmsEntrada'] === 'on'}
                />
                <label htmlFor="creditaIcmsEntrada">Aproveito o crédito do ICMS da compra</label>
              </div>
              <CampoNumero
                nome="aliquotaPisCofinsSaida"
                rotulo="PIS e Cofins na venda"
                sufixo="%"
                ajuda="Zero no monofásico."
                {...p}
              />
              <CampoNumero
                nome="creditoPisCofinsEntrada"
                rotulo="Crédito de PIS e Cofins sobre a compra"
                sufixo="%"
                ajuda="Zero quando não há crédito (Presumido ou monofásico)."
                {...p}
              />
            </>
          )}
          <CampoNumero nome="despesasVariaveis" rotulo="Despesas variáveis" sufixo="%" {...p} />
          <CampoNumero nome="margem" rotulo="Margem desejada" sufixo="%" {...p} />
          <div className="campo">
            <label htmlFor="baseMargem">Base da margem</label>
            <select
              id="baseMargem"
              name="baseMargem"
              defaultValue={iniciais['baseMargem'] ?? 'PRECO_COM_TRIBUTO'}
            >
              <option value="PRECO_COM_TRIBUTO">
                Sobre o preço com tributo (o que o cliente paga)
              </option>
              <option value="RECEITA_LIQUIDA">Sobre a receita líquida</option>
            </select>
          </div>
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
  // O regime do cálculo, não o do formulário (que pode ter mudado depois).
  const simples = r.regime === 'SIMPLES_DAS' || r.regime === 'SIMPLES_REGULAR';
  return (
    <section className="resultado" aria-live="polite" aria-labelledby="titulo-resultado">
      <h2 id="titulo-resultado">{r.descricao || 'Resultado'}</h2>
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

      <h3>Linha do tempo</h3>
      <LinhaDoTempo anos={r.anos} simples={simples} />

      <h3>Simplificado x correto</h3>
      <Comparador
        simplificado={r.simplificado}
        impostoSimplificado={r.impostoSimplificado}
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
