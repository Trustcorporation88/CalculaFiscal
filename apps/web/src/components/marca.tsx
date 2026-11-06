import Link from 'next/link';

/** Símbolo da Calculadora Fiscal: uma folha de razão com a seta do preço ao longo dos anos. */
export function SimboloMarca({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className="marca-simbolo"
    >
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--cor-primaria)" />
      <path
        d="M8 11h16M8 16h10M8 21h6"
        stroke="var(--cor-papel)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M17 23l4-4 2.5 2.5L27 17"
        stroke="var(--cor-acento)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Marca({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="marca" aria-label="Calculadora Fiscal, página inicial">
      <SimboloMarca />
      <span>
        Calculadora <strong>Fiscal</strong>
      </span>
    </Link>
  );
}
