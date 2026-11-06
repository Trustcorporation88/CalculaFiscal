/** Códigos de erro e aviso passados pela URL. Nunca refletimos texto livre vindo da query. */
export const MENSAGENS = {
  credenciais: 'E-mail ou senha incorretos.',
  dados: 'Confira os dados informados.',
  senha_fraca: 'A senha precisa ter pelo menos 10 caracteres.',
  limite: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  email_indisponivel:
    'O envio de e-mails está temporariamente no limite. Nenhum e-mail foi enviado agora. Tente de novo em alguns minutos.',
  falha: 'Não foi possível concluir. Tente de novo em instantes.',
  link_invalido: 'O link expirou ou já foi usado. Peça um novo.',
  codigo: 'Código inválido. Confira o aplicativo autenticador e tente de novo.',
  link_enviado: 'Enviamos um link de acesso para o seu e-mail.',
  cadastro_enviado: 'Enviamos um e-mail de confirmação. Abra o link para ativar a conta.',
  mfa_obrigatorio:
    'Administradores precisam ativar a verificação em duas etapas antes de continuar.',
  mfa_ativado: 'Verificação em duas etapas ativada.',
  recuperacao_enviada:
    'Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha.',
  senha_alterada: 'Senha alterada. Use a nova senha no próximo acesso.',
  conta_existente: 'Este e-mail já tem conta. Entre com a sua senha ou use "Esqueci a senha".',
  senhas_diferentes: 'As duas senhas não são iguais.',
  reautenticar: 'Por segurança, confirme que é você: peça um link de troca de senha pelo e-mail.',
} as const;

export type CodigoMensagem = keyof typeof MENSAGENS;

export function mensagem(codigo: string | string[] | undefined): string | null {
  if (typeof codigo !== 'string') return null;
  // Object.hasOwn, e não `in`: `in` aceita chaves do protótipo como "toString".
  return Object.hasOwn(MENSAGENS, codigo) ? MENSAGENS[codigo as CodigoMensagem] : null;
}
