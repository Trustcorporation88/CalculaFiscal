import { precoSimplificado } from '@calculafiscal/motor-fiscal';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Inicio() {
  const hoje = precoSimplificado({
    custo: '4.89',
    despesasVariaveis: '0.06',
    imposto: '0.08',
    margem: '0.25',
  });
  const errado = precoSimplificado({
    custo: '4.89',
    despesasVariaveis: '0.06',
    imposto: '0.265',
    margem: '0.25',
  });

  return (
    <main>
      <h1>CalculaFiscal</h1>
      <p>Fundação em construção. O cálculo correto da Reforma entra na fase do motor.</p>
      <h2>Cálculo simplificado (o que o mercado divulga)</h2>
      <ul>
        <li>Hoje: {brl.format(Number(hoje.preco))}</li>
        <li>&quot;Reforma&quot; com 26,5% por dentro: {brl.format(Number(errado.preco))}</li>
      </ul>
    </main>
  );
}
