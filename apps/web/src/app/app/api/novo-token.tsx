'use client';

import { useActionState } from 'react';
import { criarToken, type EstadoToken } from './actions';

const INICIAL: EstadoToken = { situacao: 'vazio' };

export function NovoToken({ organizacoes }: { organizacoes: { id: string; nome: string }[] }) {
  const [estado, acao, pendente] = useActionState(criarToken, INICIAL);
  return (
    <>
      {estado.situacao === 'criado' && (
        <div role="status" className="aviso aviso-ok token-criado">
          <p>
            Token <strong>{estado.nome}</strong> criado. Copie agora: ele não será mostrado de novo.
            Guarde no cofre de segredos do sistema que vai usar a API.
          </p>
          <code className="token">{estado.token}</code>
        </div>
      )}
      <form action={acao} className="calculadora">
        <fieldset>
          <legend>Novo token</legend>
          <div className="campo">
            <label htmlFor="org">Organização</label>
            <select id="org" name="org" required>
              {organizacoes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="nome">Nome</label>
            <input
              id="nome"
              name="nome"
              required
              minLength={3}
              maxLength={80}
              placeholder="ProContador"
            />
          </div>
          <fieldset className="campo">
            <legend className="ajuda">Escopos</legend>
            <label className="campo-caixa">
              <input type="checkbox" name="escopos" value="simular" defaultChecked /> simular
            </label>
            <label className="campo-caixa">
              <input type="checkbox" name="escopos" value="regras:ler" defaultChecked /> regras:ler
            </label>
          </fieldset>
        </fieldset>
        {estado.situacao === 'erro' && (
          <p role="alert" className="aviso aviso-erro">
            {estado.mensagem}
          </p>
        )}
        <button type="submit" disabled={pendente}>
          {pendente ? 'Criando...' : 'Criar token'}
        </button>
      </form>
    </>
  );
}
