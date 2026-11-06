import { DESCRICAO_CENARIOS } from '@calculafiscal/regras/cenarios';
import type { EntradaCalculadora } from '@/lib/calculadora/entrada';
import { linhasDaEntrada } from '@/lib/calculadora/planilha';

/** Os dados informados, para o PDF e para conferência: o resultado não se separa da entrada. */
export function ResumoEntrada({ entrada }: { entrada: EntradaCalculadora }) {
  return (
    <details className="resumo-entrada">
      <summary>Dados informados ({DESCRICAO_CENARIOS[entrada.cenario]})</summary>
      <dl className="memoria-entradas">
        {linhasDaEntrada(entrada).map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
