import { tabelaOficial } from '@calculafiscal/regras';
import readXlsxFile, { readSheet } from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { describe, expect, it } from 'vitest';
import { calcularLinhaDoTempo, calcularLote } from '../src/lib/calculadora/calcular';
import { lerEntrada } from '../src/lib/calculadora/entrada';
import { EXEMPLO_COCA } from '../src/lib/calculadora/exemplos';
import { linhasDaTabela, type Celula } from '../src/lib/calculadora/lote';
import {
  abasDoLote,
  abasDoModeloLote,
  abasDoResultado,
  type Aba,
} from '../src/lib/calculadora/planilha';

/** Escreve com a mesma biblioteca do navegador e lê de volta: o arquivo abre e os números batem. */
const escrever = (abas: Aba[]) => writeXlsxFile(abas.map((a) => ({ ...a }))).toBuffer();

describe('planilhas de verdade (.xlsx)', () => {
  const tabela = tabelaOficial();

  it('resultado: abre com as 6 abas e os valores numéricos da linha do tempo', async () => {
    const leitura = lerEntrada(EXEMPLO_COCA);
    if (!leitura.ok) throw new Error('entrada inválida');
    const r = calcularLinhaDoTempo(leitura.entrada, tabela);
    const arquivo = await escrever(abasDoResultado(r, new Date()));
    const abas = await readXlsxFile(arquivo);
    expect(abas.map((a) => a.sheet)).toEqual([
      'Resumo',
      'Linha do tempo',
      'Preço psicológico',
      'Cenários',
      'Memória de cálculo',
      'Fontes',
    ]);
    const linhaDoTempo = abas[1]?.data ?? [];
    expect(linhaDoTempo[1]?.[0]).toBe(2026);
    expect(linhaDoTempo[1]?.[5]).toBe(8.02);
  });

  it('modelo do lote: preenchido e lido de volta, calcula igual à calculadora', async () => {
    const modelo = await escrever(abasDoModeloLote());
    const tabelaLida = (await readSheet(modelo)) as unknown as Celula[][];
    const lida = linhasDaTabela(tabelaLida);
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    const [coca] = calcularLote(
      lida.linhas,
      {
        cenario: 'base',
        regime: 'SIMPLES_DAS',
        aliquotaDas: '8',
        despesasVariaveis: '6',
        margem: '25',
        baseMargem: 'PRECO_COM_TRIBUTO',
      },
      tabela,
    );
    expect(coca?.ok && coca.anos[0]?.precoComTributo).toBe('8.02');

    const resultado = await escrever(abasDoLote(coca ? [coca] : [], 'base', tabela.versao));
    const [lote] = await readXlsxFile(resultado);
    expect(lote?.data[1]?.[3]).toBe(8.02);
  });
});
