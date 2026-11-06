import type { PassoMemoria } from '@calculafiscal/motor-fiscal';

export function MemoriaCalculo({ passos }: { passos: readonly PassoMemoria[] }) {
  return (
    <ol className="memoria">
      {passos.map((p) => (
        <li key={p.id}>
          <p className="memoria-titulo">
            <strong>{p.descricao}</strong>: <span className="numero">{p.resultado}</span>
          </p>
          <p className="ajuda">{p.formula}</p>
          <dl className="memoria-entradas">
            {Object.entries(p.entradas).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd className="numero">{v}</dd>
              </div>
            ))}
          </dl>
          {p.regras.length > 0 && <p className="ajuda">Regras: {p.regras.join(', ')}</p>}
        </li>
      ))}
    </ol>
  );
}
