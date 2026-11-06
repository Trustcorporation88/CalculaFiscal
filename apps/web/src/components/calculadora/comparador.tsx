import type { ResultadoAno, ResultadoSimplificado } from '@calculafiscal/motor-fiscal';
import { porcento, reais } from './formato';
import { MemoriaCalculo } from './memoria-calculo';

/** O "cálculo simplificado" (markup com o imposto por dentro) ao lado do correto. */
export function Comparador({
  simplificado,
  impostoSimplificado,
  anos,
}: {
  simplificado:
    | { readonly ok: true; readonly resultado: ResultadoSimplificado }
    | { readonly ok: false; readonly motivo: string };
  impostoSimplificado: string;
  anos: readonly ResultadoAno[];
}) {
  const destaque = anos.filter((a) => [2026, 2027, 2033].includes(a.ano));
  return (
    <div className="comparador">
      <div className="cartao">
        <h3>Cálculo simplificado</h3>
        {simplificado.ok ? (
          <p className="valor-grande numero">{reais(simplificado.resultado.preco)}</p>
        ) : (
          <p className="aviso aviso-pendente">Indisponível: {simplificado.motivo}</p>
        )}
        <p className="ajuda">
          Nota de compra dividida por (1 − despesas − {porcento(impostoSimplificado)} de imposto por
          dentro − margem). Não considera crédito, imposto por fora nem a transição.
        </p>
        {simplificado.ok && (
          <details>
            <summary>Memória do cálculo simplificado</summary>
            <MemoriaCalculo passos={simplificado.resultado.memoria} />
          </details>
        )}
      </div>
      <div className="cartao">
        <h3>Cálculo correto (cliente paga)</h3>
        <ul className="lista-anos">
          {destaque.map((a) => (
            <li key={a.ano}>
              <span>{a.ano}</span>
              <span className="numero">
                {a.situacao === 'CALCULADO' ? reais(a.valores.precoComTributo) : 'dado pendente'}
              </span>
            </li>
          ))}
        </ul>
        <p className="ajuda">
          Mantém a margem pedida em cada ano, com CBS e IBS por fora, crédito da compra, Imposto
          Seletivo no custo e a redução gradual do ICMS.
        </p>
      </div>
    </div>
  );
}
