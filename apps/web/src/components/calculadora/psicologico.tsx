import type { ResultadoAno } from '@calculafiscal/motor-fiscal';
import type { SugestaoAno } from '@/lib/calculadora/calcular';
import { porcento, reais } from './formato';

/** Preço calculado x preço psicológico sugerido, com a margem efetiva em cada um. */
export function PrecoPsicologico({
  anos,
  sugestoes,
}: {
  anos: readonly ResultadoAno[];
  sugestoes: readonly SugestaoAno[];
}) {
  return (
    <div className="rolagem">
      <table className="tabela">
        <caption className="ajuda">
          O preço sugerido é o próximo valor com final comercial (,49, ,90 ou ,99; acima de R$ 100,
          dezena terminada em 9,90). Sempre arredonda para cima, então a margem nunca cai.
        </caption>
        <thead>
          <tr>
            <th scope="col">Ano</th>
            <th scope="col">Cliente paga (calculado)</th>
            <th scope="col">Preço sugerido</th>
            <th scope="col">Lucro no sugerido</th>
            <th scope="col">Margem sobre preço com tributo</th>
            <th scope="col">Margem sobre receita líquida</th>
          </tr>
        </thead>
        <tbody>
          {anos.map((a) => {
            const s = sugestoes.find((x) => x.ano === a.ano);
            if (a.situacao !== 'CALCULADO' || !s || s.resultado.situacao !== 'CALCULADO') {
              return (
                <tr key={a.ano} className="linha-pendente">
                  <th scope="row">{a.ano}</th>
                  <td colSpan={5}>Dado pendente</td>
                </tr>
              );
            }
            const v = s.resultado.valores;
            return (
              <tr key={a.ano}>
                <th scope="row">{a.ano}</th>
                <td className="numero">{reais(a.valores.precoComTributo)}</td>
                <td className="numero destaque">{reais(v.precoComTributo)}</td>
                <td className="numero">{reais(v.lucro)}</td>
                <td className="numero">{porcento(v.margemSobrePrecoComTributo)}</td>
                <td className="numero">{porcento(v.margemSobreReceitaLiquida)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
