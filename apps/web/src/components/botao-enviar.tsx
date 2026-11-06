'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

/**
 * Botão de envio que trava enquanto o formulário está sendo processado.
 * Evita o envio duplo (duplo clique ou clique de novo durante a espera).
 */
export function BotaoEnviar({
  children,
  enviando = 'Aguarde...',
  className,
}: {
  children: ReactNode;
  enviando?: string;
  className?: string | undefined;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? enviando : children}
    </button>
  );
}
