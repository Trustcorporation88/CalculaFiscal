'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';

const CAMINHO = '/funcionalidades';

/**
 * Link para a página de funcionalidades que sempre mostra a lista completa. Já estando nela,
 * rola até o topo a cada clique: um link para o mesmo endereço (com ou sem #âncora) não faz
 * nada no segundo clique, porque o navegador não vê mudança de URL.
 */
export function LinkFuncionalidades({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  function aoClicar(e: MouseEvent<HTMLAnchorElement>) {
    // Clique com Ctrl/Cmd/Shift ou botão do meio: deixa o navegador abrir em outra aba.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (window.location.pathname !== CAMINHO) return;
    e.preventDefault();
    window.scrollTo({ top: 0 });
    if (window.location.hash) window.history.replaceState(null, '', CAMINHO);
  }

  return (
    <Link href={CAMINHO} className={className} onClick={aoClicar}>
      {children}
    </Link>
  );
}
