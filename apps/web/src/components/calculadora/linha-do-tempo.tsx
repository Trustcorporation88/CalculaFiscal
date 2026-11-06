import { D, type ResultadoAno } from '@calculafiscal/motor-fiscal';
import { porcento, reais } from './formato';
import { SeloStatus } from './selo-status';

const soma = (...v: string[]) => v.reduce((t, x) => t.plus(x), new D(0)).toFixed(2);

/** Tabela de 2026 a 2033: preço que mantém a margem, tributos e status das premissas de cada ano. */
export function LinhaDoTempo({
  anos,
  simples,
}: {
  anos: readonly ResultadoAno[];
  simples: boolean;
}) {
  return (
    <div className="rolagem">
      <table className="tabela">
        <caption className="ajuda">
          Valores por unidade. &quot;Cliente paga&quot; inclui a CBS e o IBS destacados por fora.
        </caption>
        <thead>
          <tr>
            <th scope="col">Ano</th>
            <th scope="col">Premissas</th>
            <th scope="col">Nota de compra</th>
            <th scope="col">Custo líquido</th>
            <th scope="col">Preço de venda</th>
            <th scope="col">Cliente paga</th>
            <th scope="col">{simples ? 'DAS' : 'ICMS + PIS/Cofins'}</th>
            <th scope="col">CBS + IBS</th>
            <th scope="col">Crédito ao cliente</th>
            <th scope="col">Lucro</th>
            <th scope="col">Margem sobre preço com tributo</th>
            <th scope="col">Margem sobre receita líquida</th>
          </tr>
        </thead>
        <tbody>
          {anos.map((a) =>
            a.situacao === 'CALCULADO' ? (
              <tr key={a.ano}>
                <th scope="row">{a.ano}</th>
                <td>
                  <SeloStatus status={a.status} />
                </td>
                <td className="numero">{reais(a.valores.totalNotaCompra)}</td>
                <td className="numero">{reais(a.valores.custoLiquido)}</td>
                <td className="numero">{reais(a.valores.preco)}</td>
                <td className="numero destaque">{reais(a.valores.precoComTributo)}</td>
                <td className="numero">
                  {reais(simples ? a.valores.das : soma(a.valores.icms, a.valores.pisCofins))}
                </td>
                <td className="numero">{reais(soma(a.valores.cbs, a.valores.ibs))}</td>
                <td className="numero">
                  {a.valores.creditoTransferido === null ? (
                    <SeloStatus status="PENDENTE" />
                  ) : (
                    reais(a.valores.creditoTransferido)
                  )}
                </td>
                <td className="numero">{reais(a.valores.lucro)}</td>
                <td className="numero">{porcento(a.valores.margemSobrePrecoComTributo)}</td>
                <td className="numero">{porcento(a.valores.margemSobreReceitaLiquida)}</td>
              </tr>
            ) : (
              <tr key={a.ano} className="linha-pendente">
                <th scope="row">{a.ano}</th>
                <td>
                  <SeloStatus status={a.status} />
                </td>
                <td colSpan={10}>Dado pendente: {a.motivo}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
