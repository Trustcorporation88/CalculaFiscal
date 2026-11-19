'use client';

import { useState, type ReactNode } from 'react';
import { CENARIOS, DESCRICAO_CENARIOS } from '@calculafiscal/regras/cenarios';
import {
  classificarPorNbs,
  classificarPorNcm,
  criticarNbsNoAnexo,
  criticarNcmNoAnexo,
  formatarNbs,
  formatarNcm,
} from '@calculafiscal/regras/classificacao';
import type { NaturezaCalculo } from '@calculafiscal/regras/resolver';
import type { BaseMargem, ModoFornecedor, Regime } from '@calculafiscal/motor-fiscal';
import type { ValoresFormulario } from '@/lib/calculadora/entrada';
import { rotuloReducao, type TratamentoInformado } from '@/lib/calculadora/avisos';
import {
  ROTULO_BASE_MARGEM,
  ROTULO_MODO_FORNECEDOR,
  ROTULO_REGIME,
} from '@/lib/calculadora/rotulos';

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
      {/* key: ao trocar de regime ou importar XML, o React remonta o valor inicial sem misturar campos. */}
      <input
        key={`${nome}:${iniciais[nome] ?? ''}`}
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

/** Tratamento de CBS/IBS do produto ou serviço (cClassTrib), com sugestão e crítica por NCM ou NBS. */
export function CampoTratamento({
  iniciais,
  erros,
  tratamentos,
  ncm,
  nbs,
  natureza = 'MERCADORIA',
}: {
  iniciais: ValoresFormulario;
  erros: Erros;
  tratamentos: readonly TratamentoInformado[];
  ncm?: string;
  nbs?: string;
  natureza?: NaturezaCalculo;
}) {
  const [selecionado, setSelecionado] = useState(iniciais['cClassTrib'] ?? '000001');
  const erro = erros['cClassTrib'];
  const ehServico = natureza === 'SERVICO';

  let codigoLimpo: string | null = null;
  if (ehServico && nbs && nbs.trim() !== '') {
    try {
      codigoLimpo = formatarNbs(nbs);
    } catch {
      codigoLimpo = null;
    }
  } else if (!ehServico && ncm && ncm.trim() !== '') {
    try {
      codigoLimpo = formatarNcm(ncm);
    } catch {
      codigoLimpo = null;
    }
  }

  const sugestoes =
    codigoLimpo !== null
      ? (ehServico
          ? classificarPorNbs(codigoLimpo)
          : classificarPorNcm(codigoLimpo)
        ).sugestoes.filter((s) => s.cClassTrib !== '000001' && s.suportadoNaCalculadora)
      : [];
  const critica =
    codigoLimpo !== null && selecionado !== '000001'
      ? ehServico
        ? criticarNbsNoAnexo(codigoLimpo, selecionado)
        : criticarNcmNoAnexo(codigoLimpo, selecionado)
      : null;

  return (
    <div className="campo campo-largo">
      <label htmlFor="cClassTrib">Tratamento de CBS e IBS (cClassTrib)</label>
      <select
        id="cClassTrib"
        name="cClassTrib"
        value={selecionado}
        onChange={(e) => setSelecionado(e.target.value)}
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
        {ehServico
          ? 'Reduções de serviços da LC 214 (como 30% em profissões regulamentadas no 200052 ou 60% em educação e saúde).'
          : 'Reduções da LC 214 de 2027 em diante, na compra e na venda. Com o NCM preenchido, o anexo oficial da Receita Federal é conferido automaticamente.'}
      </p>
      {selecionado === '000001' && sugestoes.length > 0 && (
        <div className="aviso aviso-pendente" role="status">
          <p>
            Sugestão para {ehServico ? `a NBS ${codigoLimpo}` : `o NCM ${codigoLimpo}`}:{' '}
            {sugestoes.map((s, i) => (
              <span key={s.cClassTrib}>
                {i > 0 ? ' · ' : ''}
                <strong>{s.cClassTrib}</strong> ({rotuloReducao(s.reducao)}
                {s.anexo ? `, Anexo ${s.anexo}` : ''}, {s.artigo}){' '}
                <button
                  type="button"
                  className="secundario"
                  onClick={() => setSelecionado(s.cClassTrib)}
                >
                  Usar {s.cClassTrib}
                </button>
              </span>
            ))}
          </p>
        </div>
      )}
      {critica &&
        (critica.situacao === 'NAO_VINCULADO' ||
          (critica.situacao === 'SEM_ANEXO' && !critica.compativelComCodigo)) && (
          <p className="aviso aviso-erro" role="alert">
            {critica.mensagem}
          </p>
        )}
      {critica && critica.situacao === 'VINCULADO' && (
        <p className="ajuda" role="status">
          {critica.mensagem}
        </p>
      )}
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

export function CampoModoFornecedor({
  iniciais,
  rotulo = 'Como o fornecedor forma o preço de 2027 em diante',
}: {
  iniciais: ValoresFormulario;
  rotulo?: string;
}) {
  return (
    <div className="campo campo-largo">
      <label htmlFor="modoFornecedor">{rotulo}</label>
      <select
        id="modoFornecedor"
        name="modoFornecedor"
        defaultValue={iniciais['modoFornecedor'] ?? 'PRECO_LIQUIDO'}
      >
        {(Object.keys(ROTULO_MODO_FORNECEDOR) as ModoFornecedor[]).map((m) => (
          <option key={m} value={m}>
            {ROTULO_MODO_FORNECEDOR[m]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Como a empresa vende: regime, tributos da saída (ICMS ou ISS), despesas e margem. */
export function CamposVenda({
  iniciais,
  erros,
  natureza = 'MERCADORIA',
}: {
  iniciais: ValoresFormulario;
  erros: Erros;
  natureza?: NaturezaCalculo;
}) {
  const [regime, setRegime] = useState<Regime>((iniciais['regime'] as Regime) ?? 'SIMPLES_DAS');
  const simples = regime === 'SIMPLES_DAS' || regime === 'SIMPLES_REGULAR';
  const ehServico = natureza === 'SERVICO';
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
            ajuda="Em branco, o crédito ao cliente aparece como pendente e o Simples no regime regular aguarda definição do CGSN (ou informe a proporção estimada a partir de pCBSSN + pIBSSN)."
            {...p}
          />
        </>
      ) : ehServico ? (
        <>
          <CampoNumero
            nome="aliquotaIssSaida"
            rotulo="ISS na saída"
            sufixo="%"
            ajuda="Alíquota municipal do ISS (em geral de 2% a 5%). Reduz de 2029 a 2032 e acaba em 2033."
            {...p}
          />
          <CampoNumero
            nome="aliquotaPisCofinsSaida"
            rotulo="PIS e Cofins na venda"
            sufixo="%"
            ajuda="Em 2026 (ex.: 3,65% no Presumido, 9,25% no Real). Extintos a partir de 2027."
            {...p}
          />
          <CampoNumero
            nome="creditoPisCofinsEntrada"
            rotulo="Crédito de PIS e Cofins sobre insumos"
            sufixo="%"
            ajuda="Em 2026 sobre a parcela de insumos tributados (zero no Presumido)."
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
