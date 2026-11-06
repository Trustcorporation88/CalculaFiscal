import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSessao } from '@/lib/sessao';
import { NovoToken } from './novo-token';
import { RevogarToken } from './revogar';

export const metadata: Metadata = { title: 'API | Calculadora Fiscal' };

type Token = {
  id: string;
  organization_id: string;
  nome: string;
  prefixo: string;
  escopos: string[];
  ambiente: string;
  criado_em: string;
  ultimo_uso_em: string | null;
  revogado_em: string | null;
};

const data = (v: string | null) =>
  v ? new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'nunca';

export default async function PaginaApi() {
  // exigirSessao já obriga dono e administrador a estarem com MFA (AAL2).
  const { supabase, vinculos } = await exigirSessao();
  const admin = vinculos.filter((v) => v.papel === 'dono' || v.papel === 'administrador');
  const { data: tokens, error: erroLista } = await supabase
    .from('api_tokens')
    .select(
      'id, organization_id, nome, prefixo, escopos, ambiente, criado_em, ultimo_uso_em, revogado_em',
    )
    .order('criado_em', { ascending: false });
  const nomeOrg = new Map(admin.map((v) => [v.organization_id, v.organizations?.nome ?? '']));

  return (
    <main className="conteudo">
      <header className="topo">
        <div>
          <p className="ajuda">
            <Link href="/app">Painel</Link>
          </p>
          <h1>API e tokens</h1>
        </div>
      </header>
      <p>
        Tokens de serviço para integrar outro sistema (por exemplo, o ProContador) à API{' '}
        <code>/v1</code>. O contrato está em{' '}
        <a href="/v1/openapi.json" target="_blank" rel="noreferrer">
          /v1/openapi.json
        </a>
        . Use no cabeçalho <code>Authorization: Bearer cf_...</code>.
      </p>
      {admin.length === 0 ? (
        <p className="aviso aviso-erro">Só dono ou administrador da organização gerencia tokens.</p>
      ) : (
        <>
          <NovoToken
            organizacoes={admin.map((v) => ({
              id: v.organization_id,
              nome: v.organizations?.nome ?? 'Organização',
            }))}
          />
          <h2>Tokens</h2>
          {erroLista ? (
            // Falha de leitura não pode parecer lista vazia: tokens ativos continuariam valendo.
            <p role="alert" className="aviso aviso-erro">
              Não foi possível carregar os tokens agora. Eles continuam valendo como estavam; tente
              de novo em instantes.
            </p>
          ) : (tokens ?? []).length === 0 ? (
            <p className="ajuda">Nenhum token criado.</p>
          ) : (
            <div className="rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">Início do token</th>
                    <th scope="col">Organização</th>
                    <th scope="col">Escopos</th>
                    <th scope="col">Criado</th>
                    <th scope="col">Último uso</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {((tokens ?? []) as Token[]).map((t) => (
                    <tr key={t.id}>
                      <th scope="row">{t.nome}</th>
                      <td>
                        <code>{t.prefixo}…</code>
                      </td>
                      <td>{nomeOrg.get(t.organization_id)}</td>
                      <td>{t.escopos.join(', ')}</td>
                      <td>{data(t.criado_em)}</td>
                      <td>{data(t.ultimo_uso_em)}</td>
                      <td>
                        {t.revogado_em ? (
                          `Revogado em ${data(t.revogado_em)}`
                        ) : (
                          <RevogarToken id={t.id} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
