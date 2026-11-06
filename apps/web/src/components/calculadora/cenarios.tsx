import { DESCRICAO_CENARIOS, type Cenario } from '@calculafiscal/regras/cenarios';
import type { ResumoAno } from '@/lib/calculadora/calcular';
import { reais } from './formato';
import { SeloStatus } from './selo-status';

/** O que o cliente paga em cada ano, em todos os cenários, para mostrar quanto a premissa pesa. */
export function CenariosLadoALado({
  cenarios,
  escolhido,
}: {
  cenarios: readonly { readonly cenario: Cenario; readonly anos: readonly ResumoAno[] }[];
  escolhido: Cenario;
}) {
  const anos = cenarios[0]?.anos.map((a) => a.ano) ?? [];
  return (
    <div className="rolagem">
      <table className="tabela">
        <caption className="ajuda">
          O que o cliente paga em cada cenário, mantendo a mesma margem. O cenário escolhido no
          formulário está destacado.
        </caption>
        <thead>
          <tr>
            <th scope="col">Ano</th>
            {cenarios.map((c) => (
              <th
                key={c.cenario}
                scope="col"
                className={c.cenario === escolhido ? 'coluna-escolhida' : undefined}
              >
                {DESCRICAO_CENARIOS[c.cenario]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {anos.map((ano) => (
            <tr key={ano}>
              <th scope="row">{ano}</th>
              {cenarios.map((c) => {
                const a = c.anos.find((x) => x.ano === ano);
                return (
                  <td
                    key={c.cenario}
                    className={`numero${c.cenario === escolhido ? ' coluna-escolhida' : ''}`}
                  >
                    {a?.precoComTributo ? reais(a.precoComTributo) : 'dado pendente'}
                    {a && (
                      <span className="bloco">
                        <SeloStatus status={a.status} />
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
