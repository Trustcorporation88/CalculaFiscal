import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'CalculaFiscal: preço e margem na Reforma Tributária',
  description:
    'Custo, preço e margem por produto e serviço de 2026 a 2033, com CBS, IBS, Imposto Seletivo e memória de cálculo.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
