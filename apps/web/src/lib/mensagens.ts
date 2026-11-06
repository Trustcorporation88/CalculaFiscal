/** Códigos de erro e aviso passados pela URL. Nunca refletimos texto livre vindo da query. */
export const MENSAGENS = {
  credenciais: 'E-mail ou senha incorretos.',
  dados: 'Confira os dados informados.',
  senha_fraca: 'A senha precisa ter pelo menos 10 caracteres.',
  limite: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  falha: 'Não foi possível concluir. Tente de novo em instantes.',
  link_invalido: 'O link expirou ou já foi usado. Peça um novo.',
  codigo: 'Código inválido. Confira o aplicativo autenticador e tente de novo.',
  link_enviado: 'Enviamos um link de acesso para o seu e-mail.',
  cadastro_enviado: 'Enviamos um e-mail de confirmação. Abra o link para ativar a conta.',
  mfa_obrigatorio:
    'Administradores precisam ativar a verificação em duas etapas antes de continuar.',
  mfa_ativado: 'Verificação em duas etapas ativada.',
} as const;

export type CodigoMensagem = keyof typeof MENSAGENS;

export function mensagem(codigo: string | string[] | undefined): string | null {
  if (typeof codigo !== 'string') return null;
  // Object.hasOwn, e não `in`: `in` aceita chaves do protótipo como "toString".
  return Object.hasOwn(MENSAGENS, codigo) ? MENSAGENS[codigo as CodigoMensagem] : null;
}
