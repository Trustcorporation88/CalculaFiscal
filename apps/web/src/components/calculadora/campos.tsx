'use client';

import { useState, type ReactNode } from 'react';
import { CENARIOS, DESCRICAO_CENARIOS } from '@calculafiscal/regras/cenarios';
import type { BaseMargem, Regime } from '@calculafiscal/motor-fiscal';
import type { ValoresFormulario } from '@/lib/calculadora/entrada';
import { rotuloReducao, type TratamentoInformado } from '@/lib/calculadora/avisos';
import { ROTULO_BASE_MARGEM, ROTULO_REGIME } from '@/lib/calculadora/rotulos';

export type Erros = Readonly<Record<string, string>>;

type CampoProps = {
  nome: string;
  rotulo: string;
  ajuda?: ReactNode;
  sufixo?: '%' | 'R$';
  obrigatorio?: boolean;
  iniciais: ValoresFormulario;
  erros: Erros;
};

/** Campo numérico em formato brasileiro (vírgula), com erro e ajuda ligados por aria. */
export function CampoNumero({
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
      {/* key: ao trocar de regime, o React não pode reaproveitar o valor de outro campo. */}
      <input
        key={nome}
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

/** Tratamento de CBS/IBS do produto (cClassTrib), entre os que estão na tabela de regras. */
export function CampoTratamento({
  iniciais,
  erros,
  tratamentos,
}: {
  iniciais: ValoresFormulario;
  erros: Erros;
  tratamentos: readonly TratamentoInformado[];
}) {
  const erro = erros['cClassTrib'];
  return (
    <div className="campo campo-largo">
      <label htmlFor="cClassTrib">Tratamento de CBS e IBS (cClassTrib)</label>
      <select
        id="cClassTrib"
        name="cClassTrib"
        defaultValue={iniciais['cClassTrib'] ?? '000001'}
        aria-invalid={erro ? true : undefined}
        aria-describedby="cClassTrib-ajuda"
      >
        <option value="000001">000001: tributação integral</option>
        {tratamentos.map((t) => (
          <option key={t.codigo} value={t.codigo}>
            {t.codigo}: {rotuloReducao(t.reducao)}, {t.descricao}
          </option>
        ))}
      </select>
      <p id="cClassTrib-ajuda" className="ajuda">
        Reduções da LC 214 de 2027 em diante, na compra e na venda. Confirme que o NCM consta no
        anexo do tratamento.
      </p>
      {erro && <p className="erro-campo">{erro}</p>}
    </div>
  );
}

export function CampoCenario({ iniciais }: { iniciais: ValoresFormulario }) {
  return (
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
  );
}

/** Como a empresa vende: regime, tributos da saída, despesas e margem. */
export function CamposVenda({ iniciais, erros }: { iniciais: ValoresFormulario; erros: Erros }) {
  const [regime, setRegime] = useState<Regime>((iniciais['regime'] as Regime) ?? 'SIMPLES_DAS');
  const simples = regime === 'SIMPLES_DAS' || regime === 'SIMPLES_REGULAR';
  const p = { iniciais, erros };
  return (
    <>
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
          {(Object.keys(ROTULO_BASE_MARGEM) as BaseMargem[]).map((b) => (
            <option key={b} value={b}>
              {ROTULO_BASE_MARGEM[b]}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
