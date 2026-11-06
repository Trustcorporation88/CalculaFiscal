'use client';

import { useActionState } from 'react';
import { acaoMfa, type EstadoCadastroMfa } from './actions';

const INICIAL: EstadoCadastroMfa = { etapa: 'inicio' };

export function CadastroMfa() {
  const [estado, acao, pendente] = useActionState(acaoMfa, INICIAL);

  if (estado.etapa === 'inicio') {
    return (
      <form action={acao} className="formulario">
        {estado.erro && (
          <p role="alert" className="aviso aviso-erro">
            {estado.erro}
          </p>
        )}
        <button type="submit" disabled={pendente}>
          {pendente ? 'Gerando...' : 'Ativar verificação em duas etapas'}
        </button>
      </form>
    );
  }

  return (
    <form action={acao} className="formulario">
      <p>
        1. Abra o aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password
        ou similar) e leia o QR code.
      </p>
      {/* QR code em data URI SVG devolvido pelo Supabase. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={estado.qrCode}
        alt="QR code para o aplicativo autenticador"
        width={200}
        height={200}
      />
      <p className="ajuda">
        Sem câmera? Digite esta chave no aplicativo: <code>{estado.segredo}</code>
      </p>
      <label htmlFor="codigo">2. Digite o código de 6 números</label>
      <input
        id="codigo"
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
      />
      {estado.erro && (
        <p role="alert" className="aviso aviso-erro">
          {estado.erro}
        </p>
      )}
      <button type="submit" disabled={pendente}>
        {pendente ? 'Verificando...' : 'Confirmar'}
      </button>
    </form>
  );
}
