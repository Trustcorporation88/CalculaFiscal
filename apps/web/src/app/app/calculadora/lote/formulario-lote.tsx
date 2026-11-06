'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import type { ValoresFormulario } from '@/lib/calculadora/entrada';
import { AVISO_REDUCOES } from '@/lib/calculadora/avisos';
import { linhasDaTabela, lerCsv, type Celula, type LeituraTabela } from '@/lib/calculadora/lote';
import { abasDoLote, abasDoModeloLote } from '@/lib/calculadora/planilha';
import { CampoCenario, CamposVenda } from '@/components/calculadora/campos';
import { BotoesExportar, baixarPlanilha } from '@/components/calculadora/exportar';
import { reais } from '@/components/calculadora/formato';
import { SeloStatus } from '@/components/calculadora/selo-status';
import { calcularLoteAcao, type EstadoLote } from '../actions';

const INICIAL: EstadoLote = { situacao: 'vazio' };
const ANOS_NA_TELA = [2026, 2027, 2029, 2033];

async function lerArquivo(arquivo: File): Promise<LeituraTabela> {
  if (arquivo.size > 5 * 1024 * 1024) return { ok: false, erro: 'Arquivo maior que 5 MB.' };
  if (arquivo.name.toLowerCase().endsWith('.csv')) {
    return linhasDaTabela(lerCsv(await arquivo.text()));
  }
  const { readSheet } = await import('read-excel-file/browser');
  const tabela = (await readSheet(arquivo)) as unknown as Celula[][];
  return linhasDaTabela(tabela);
}

export function FormularioLote({ iniciais }: { iniciais: ValoresFormulario }) {
  const [estado, acao, pendente] = useActionState(calcularLoteAcao, INICIAL);
  const [leitura, setLeitura] = useState<LeituraTabela | null>(null);
  const [lendo, setLendo] = useState(false);
  const erros = estado.situacao === 'erro' ? estado.campos : {};

  async function escolherArquivo(arquivo: File | undefined) {
    setLeitura(null);
    if (!arquivo) return;
    setLendo(true);
    try {
      setLeitura(await lerArquivo(arquivo));
    } catch {
      setLeitura({ ok: false, erro: 'Não foi possível ler o arquivo. Use .xlsx ou .csv.' });
    } finally {
      setLendo(false);
    }
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    dados.delete('arquivo');
    dados.set('linhas', JSON.stringify(leitura?.ok ? leitura.linhas : []));
    startTransition(() => acao(dados));
  }

  return (
    <>
      <form onSubmit={enviar} className="calculadora" noValidate>
        <fieldset>
          <legend>Planilha de produtos</legend>
          <div className="campo">
            <label htmlFor="arquivo">Arquivo (.xlsx ou .csv)</label>
            <input
              id="arquivo"
              name="arquivo"
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => void escolherArquivo(e.target.files?.[0])}
              aria-describedby="arquivo-situacao"
            />
            <p id="arquivo-situacao" className="ajuda" role="status">
              {lendo
                ? 'Lendo...'
                : leitura === null
                  ? 'Nenhum arquivo escolhido.'
                  : leitura.ok
                    ? `${leitura.linhas.length} produto(s) lido(s).`
                    : ''}
            </p>
            {leitura && !leitura.ok && <p className="erro-campo">{leitura.erro}</p>}
          </div>
          <div className="campo">
            <span>Modelo</span>
            <button
              type="button"
              className="secundario"
              onClick={() =>
                void baixarPlanilha(abasDoModeloLote(), 'modelo-lote-calculafiscal.xlsx')
              }
            >
              Baixar modelo (.xlsx)
            </button>
            <p className="ajuda">Percentuais em número: 18 para 18%.</p>
          </div>
          <CampoCenario iniciais={iniciais} />
        </fieldset>

        <fieldset>
          <legend>Venda: como a sua empresa vende (vale para todo o lote)</legend>
          <CamposVenda iniciais={iniciais} erros={erros} />
        </fieldset>

        {estado.situacao === 'erro' && (
          <p role="alert" className="aviso aviso-erro">
            {estado.mensagem}
          </p>
        )}
        <button type="submit" disabled={pendente || lendo || !leitura?.ok}>
          {pendente ? 'Calculando...' : 'Calcular o lote'}
        </button>
      </form>

      {estado.situacao === 'ok' && <ResultadoLote estado={estado} />}
    </>
  );
}

function ResultadoLote({ estado }: { estado: Extract<EstadoLote, { situacao: 'ok' }> }) {
  const comErro = estado.linhas.filter((l) => !l.ok).length;
  return (
    <section className="resultado" aria-live="polite" aria-labelledby="titulo-lote">
      <div className="topo">
        <h2 id="titulo-lote">
          {estado.linhas.length} produto(s){comErro > 0 ? `, ${comErro} com erro` : ''}
        </h2>
        <BotoesExportar
          nome="lote"
          pdf={false}
          montarAbas={() => abasDoLote(estado.linhas, estado.cenario, estado.versaoRegras)}
        />
      </div>
      <p className="ajuda">
        Na tela: o que o cliente paga em alguns anos e o preço psicológico sugerido. A planilha traz
        todos os anos de 2026 a 2033, com o status de cada um.
      </p>
      <p className="aviso aviso-pendente">{AVISO_REDUCOES}</p>
      <div className="rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Linha</th>
              <th scope="col">Produto</th>
              <th scope="col">Nota de compra</th>
              {ANOS_NA_TELA.map((a) => (
                <th key={a} scope="col">
                  {a}: cliente paga (sugerido)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {estado.linhas.map((l) =>
              l.ok ? (
                <tr key={l.linha}>
                  <td>{l.linha}</td>
                  <th scope="row">{l.descricao}</th>
                  <td className="numero">{reais(l.notaCompra)}</td>
                  {ANOS_NA_TELA.map((ano) => {
                    const a = l.anos.find((x) => x.ano === ano);
                    return (
                      <td key={ano} className="numero">
                        {a?.precoComTributo ? (
                          <>
                            {reais(a.precoComTributo)}
                            {a.sugerido && <span className="ajuda"> ({reais(a.sugerido)})</span>}
                          </>
                        ) : (
                          'dado pendente'
                        )}
                        {a && (
                          <span className="bloco">
                            <SeloStatus status={a.status} />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ) : (
                <tr key={l.linha} className="linha-erro">
                  <td>{l.linha}</td>
                  <th scope="row">{l.descricao}</th>
                  <td colSpan={ANOS_NA_TELA.length + 1}>
                    <ul className="erros-linha">
                      {l.erros.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
