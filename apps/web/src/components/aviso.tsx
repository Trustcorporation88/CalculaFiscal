import { mensagem } from '@/lib/mensagens';

/** Mostra erro ou aviso vindo da URL, apenas a partir de códigos conhecidos. */
export function Aviso({
  erro,
  aviso,
}: {
  erro?: string | string[] | undefined;
  aviso?: string | string[] | undefined;
}) {
  const textoErro = mensagem(erro);
  const textoAviso = mensagem(aviso);
  if (textoErro) {
    return (
      <p role="alert" className="aviso aviso-erro">
        {textoErro}
      </p>
    );
  }
  if (textoAviso) {
    return (
      <p role="status" className="aviso aviso-ok">
        {textoAviso}
      </p>
    );
  }
  return null;
}
