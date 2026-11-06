import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

// Inter hospedada pelo próprio site no build (sem chamada ao Google no navegador).
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--fonte-inter' });

export const metadata: Metadata = {
  title: 'Calculadora Fiscal: preço e margem na Reforma Tributária',
  description:
    'Custo, preço e margem por produto de 2026 a 2033, com CBS, IBS, Imposto Seletivo, a transição do ICMS e memória de cálculo.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
