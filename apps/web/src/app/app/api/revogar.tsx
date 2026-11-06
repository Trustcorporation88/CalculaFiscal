'use client';

import { useActionState } from 'react';
import { BotaoEnviar } from '@/components/botao-enviar';
import { revogarToken, type EstadoRevogacao } from './actions';

const INICIAL: EstadoRevogacao = { erro: null };

export function RevogarToken({ id }: { id: string }) {
  const [estado, acao] = useActionState(revogarToken, INICIAL);
  return (
    <form action={acao}>
      <input type="hidden" name="id" value={id} />
      <BotaoEnviar className="secundario">Revogar</BotaoEnviar>
      {estado.erro && (
        <p role="alert" className="erro-campo">
          {estado.erro}
        </p>
      )}
    </form>
  );
}
