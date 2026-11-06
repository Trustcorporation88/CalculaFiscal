'use client';

import { useState } from 'react';
import type { Aba } from '@/lib/calculadora/planilha';

/** Baixa um .xlsx montado no navegador a partir do resultado (a biblioteca só carrega no clique). */
export async function baixarPlanilha(abas: Aba[], nomeArquivo: string) {
  const { default: escrever } = await import('write-excel-file/browser');
  await escrever(
    abas.map((a) => ({ ...a })),
    { fontFamily: 'Calibri', fontSize: 11 },
  ).toFile(nomeArquivo);
}

/**
 * PDF pela impressão do navegador ("Salvar como PDF"): o mesmo conteúdo da tela, com a memória
 * de cálculo aberta e o estilo de impressão (formulário e botões ficam de fora).
 */
export function imprimirComoPdf() {
  const fechados = [...document.querySelectorAll<HTMLDetailsElement>('.resultado details')].filter(
    (d) => !d.open,
  );
  for (const d of fechados) d.open = true;
  const restaurar = () => {
    for (const d of fechados) d.open = false;
    window.removeEventListener('afterprint', restaurar);
  };
  window.addEventListener('afterprint', restaurar);
  window.print();
}

export const nomeDeArquivo = (base: string) =>
  `${(base || 'simulacao')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60)}-${new Date().toISOString().slice(0, 10)}.xlsx`;

export function BotoesExportar({
  montarAbas,
  nome,
  pdf = true,
}: {
  montarAbas: () => Aba[];
  nome: string;
  pdf?: boolean;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excel() {
    setGerando(true);
    setErro(null);
    try {
      await baixarPlanilha(montarAbas(), nomeDeArquivo(nome));
    } catch {
      setErro('Não foi possível gerar a planilha.');
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="botoes-exportar nao-imprimir">
      <button type="button" className="secundario" onClick={excel} disabled={gerando}>
        {gerando ? 'Gerando...' : 'Baixar Excel'}
      </button>
      {pdf && (
        <button type="button" className="secundario" onClick={imprimirComoPdf}>
          Exportar PDF
        </button>
      )}
      {pdf && (
        <span className="ajuda">
          O PDF abre a janela de impressão: escolha &quot;Salvar como PDF&quot;.
        </span>
      )}
      {erro && (
        <p role="alert" className="erro-campo">
          {erro}
        </p>
      )}
    </div>
  );
}
