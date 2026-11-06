import type { FonteUsada } from '@/lib/calculadora/calcular';
import { decimal, porcento } from './formato';
import { SeloStatus } from './selo-status';

/** Regras usadas no cálculo, com valor, vigência, fonte e status. */
export function Fontes({ fontes }: { fontes: readonly FonteUsada[] }) {
  return (
    <div className="rolagem">
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col">Regra</th>
            <th scope="col">Valor</th>
            <th scope="col">Vigência</th>
            <th scope="col">Fonte</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {fontes.map((f) => (
            <tr key={f.chave}>
              <td>
                {f.descricao}
                <br />
                <code className="ajuda">{f.chave}</code>
              </td>
              <td className="numero">
                {f.tributo === 'TRANSICAO' ? decimal(f.aliquota) : porcento(f.aliquota)}
              </td>
              <td>{f.vigencia}</td>
              <td>
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer">
                    {f.norma}
                  </a>
                ) : (
                  f.norma
                )}
                , {f.artigo}
                {f.conferencia === 'CONFERIR' && <span className="ajuda"> (a conferir)</span>}
                {f.observacao && <span className="ajuda bloco">{f.observacao}</span>}
              </td>
              <td>
                <SeloStatus status={f.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
