import { tabelaOficial } from '@calculafiscal/regras';
import readXlsxFile from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { describe, expect, it } from 'vitest';
import { RespostaSimulacaoV1, SimulacaoV1 } from '../src/lib/api/contrato';
import { simular } from '../src/lib/api/servicos';
import { avisoTratamento } from '../src/lib/calculadora/avisos';
import { calcularLinhaDoTempo, calcularLote } from '../src/lib/calculadora/calcular';
import { lerEntrada } from '../src/lib/calculadora/entrada';
import { EXEMPLO_COCA, EXEMPLO_SERVICO } from '../src/lib/calculadora/exemplos';
import { abasDoResultado } from '../src/lib/calculadora/planilha';
import { itensDeMultiplosXmls, lerXmlNfe } from '../src/lib/calculadora/xml-nfe';

const tabela = tabelaOficial();

const XML_NFE_COMPLETA = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35261112345678000199550010000012341000012345" versao="4.00">
      <ide><nNF>1234</nNF><serie>1</serie></ide>
      <emit><xNome>Indústria Exemplo Bebidas &amp; Alimentos Ltda</xNome></emit>
      <det nItem="1">
        <prod>
          <cProd>COCA600</cProd>
          <xProd>Refrigerante Cola 600ml</xProd>
          <NCM>22021000</NCM>
          <qCom>10.0000</qCom>
          <vProd>44.10</vProd>
          <vFrete>0.00</vFrete>
        </prod>
        <imposto>
          <ICMS>
            <ICMS10>
              <pICMS>18.00</pICMS>
              <vICMS>7.94</vICMS>
              <pMVAST>42.00</pMVAST>
              <pICMSST>18.00</pICMSST>
              <vICMSST>3.70</vICMSST>
            </ICMS10>
          </ICMS>
          <IPI>
            <IPITrib><pIPI>2.60</pIPI><vIPI>1.10</vIPI></IPITrib>
          </IPI>
          <PIS>
            <PISAliq><pPIS>2.32</pPIS></PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq><pCOFINS>10.68</pCOFINS></COFINSAliq>
          </COFINS>
        </imposto>
      </det>
      <det nItem="2">
        <prod>
          <cProd>ARR5KG</cProd>
          <xProd>Arroz Tipo 1 5kg</xProd>
          <NCM>10063021</NCM>
          <qCom>2.0000</qCom>
          <vProd>45.00</vProd>
        </prod>
        <imposto>
          <ICMS><ICMS60><vBCSTRet>45.00</vBCSTRet></ICMS60></ICMS>
          <PIS><PISNT><CST>04</CST></PISNT></PIS>
          <COFINS><COFINSNT><CST>04</CST></COFINSNT></COFINS>
          <IBSCBS><CST>200</CST><cClassTrib>200003</cClassTrib></IBSCBS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('importação segura de XML da NF-e', () => {
  it('extrai itens unitários com ST, IPI, PIS/Cofins, cClassTrib 2026 e observações honestas', () => {
    const r = lerXmlNfe(XML_NFE_COMPLETA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.chaveOuNumero).toBe('NF-e 1234/1');
    expect(r.emitente).toBe('Indústria Exemplo Bebidas & Alimentos Ltda');
    expect(r.itens).toHaveLength(2);

    // Item 1: (44,10 + 1,10 + 3,70) / 10 = R$ 4,89 por unidade, exatamente o caso Coca-Cola!
    const [coca, arroz] = r.itens;
    expect(coca?.valores).toMatchObject({
      descricao: 'Refrigerante Cola 600ml',
      ncm: '2202.10.00',
      notaCompra: '4,89',
      aliquotaIcms: '18',
      aliquotaIpi: '2,6',
      aliquotaPisCofins: '13',
      temSt: 'on',
      mva: '42',
      aliquotaInterna: '18',
    });

    // Item 2: lê cClassTrib=200003 do grupo IBSCBS de 2026 e avisa sobre ICMS60 e PISNT
    expect(arroz?.valores).toMatchObject({
      ncm: '1006.30.21',
      cClassTrib: '200003',
      notaCompra: '22,50',
      temSt: '',
    });
    expect(arroz?.observacoes.length).toBeGreaterThanOrEqual(2);

    // O lote calcula diretamente os itens vindos de múltiplos XMLs
    const loteXml = itensDeMultiplosXmls([{ nome: 'nota1.xml', conteudo: XML_NFE_COMPLETA }], 500);
    expect(loteXml.ok).toBe(true);
    if (!loteXml.ok) return;
    const calculado = calcularLote(
      loteXml.linhas,
      {
        cenario: 'base',
        modoFornecedor: 'PRECO_LIQUIDO',
        regime: 'SIMPLES_DAS',
        aliquotaDas: '8',
        despesasVariaveis: '6',
        margem: '25',
        baseMargem: 'PRECO_COM_TRIBUTO',
      },
      tabela,
    );
    expect(calculado).toHaveLength(2);
    expect(calculado[0]?.ok && calculado[0].anos[0]?.precoComTributo).toBe('8.02');
    expect(calculado[1]?.ok).toBe(true);
  });

  it('recusa XML vazio, com DOCTYPE/ENTITY (XXE) ou sem infNFe', () => {
    expect(lerXmlNfe('')).toMatchObject({ ok: false });
    expect(
      lerXmlNfe(
        '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><infNFe><det/></infNFe>',
      ),
    ).toMatchObject({ ok: false });
    expect(lerXmlNfe('<qualquerCoisa/>')).toMatchObject({ ok: false });
    expect(
      itensDeMultiplosXmls([{ nome: 'nota.xml', conteudo: XML_NFE_COMPLETA }], 1),
    ).toMatchObject({ ok: false });
  });
});

describe('fornecedor mantendo preço bruto e precificação de serviços na web e na API /v1', () => {
  it('mostra o preço bruto acima do preço líquido e traz o comparativo automático', () => {
    const eLiquido = lerEntrada(EXEMPLO_COCA);
    const eBruto = lerEntrada({ ...EXEMPLO_COCA, modoFornecedor: 'PRECO_BRUTO' });
    if (!eLiquido.ok || !eBruto.ok) throw new Error('entrada inválida');

    const rLiquido = calcularLinhaDoTempo(eLiquido.entrada, tabela);
    const rBruto = calcularLinhaDoTempo(eBruto.entrada, tabela);

    const p27Liq = rLiquido.anos.find((a) => a.ano === 2027);
    const p27Bru = rBruto.anos.find((a) => a.ano === 2027);
    if (p27Liq?.situacao !== 'CALCULADO' || p27Bru?.situacao !== 'CALCULADO') {
      throw new Error('esperava cálculo');
    }
    expect(Number(p27Bru.valores.precoComTributo)).toBeGreaterThan(
      Number(p27Liq.valores.precoComTributo),
    );
    // O comparativo cruzado bate exatamente nos dois sentidos
    expect(rLiquido.comparativoFornecedor.modoAlternativo).toBe('PRECO_BRUTO');
    expect(rLiquido.comparativoFornecedor.anos.find((a) => a.ano === 2027)?.precoComTributo).toBe(
      p27Bru.valores.precoComTributo,
    );
  });

  it('calcula serviços (EXEMPLO_SERVICO com 30% no 200052), exporta planilha e responde em /v1/simulacoes', async () => {
    const leitura = lerEntrada(EXEMPLO_SERVICO);
    if (!leitura.ok) throw new Error(JSON.stringify(leitura.erros));
    const r = calcularLinhaDoTempo(leitura.entrada, tabela);

    expect(r.tratamento).toMatchObject({ codigo: '200052', reducao: '0.3' });
    expect(avisoTratamento(r.tratamento, leitura.entrada.nbs, 'SERVICO')).toMatch(/redução de 30%/);
    const a2026 = r.anos[0];
    const a2033 = r.anos[7];
    expect(a2026?.situacao === 'CALCULADO' && Number(a2026.valores.iss)).toBeGreaterThan(0);
    expect(a2033?.situacao === 'CALCULADO' && a2033.valores.iss).toBe('0.00');

    // Exporta e lê de volta o Excel de serviço
    const buffer = await writeXlsxFile(
      abasDoResultado(r, new Date()).map((a) => ({ ...a })),
    ).toBuffer();
    const abas = await readXlsxFile(buffer);
    expect(abas[1]?.data[0]?.[6]).toBe('ISS');

    // API /v1/simulacoes aceita serviço e mercadoria com modoFornecedor na mesma chamada
    const requisicao = SimulacaoV1.parse({
      cenario: 'base',
      venda: {
        regime: 'PRESUMIDO',
        aliquotaIcmsSaida: '0',
        aliquotaIssSaida: '0.05',
        aliquotaPisCofinsSaida: '0.0365',
        despesasVariaveis: '0.08',
        margem: '0.25',
      },
      itens: [
        {
          natureza: 'SERVICO',
          idExterno: 'honorario-contabil',
          descricao: 'Assessoria contábil',
          nbs: '1.1302.21.00',
          cClassTrib: '200052',
          servico: {
            custoDireto: '500.00',
            parcelaInsumosTributados: '0.20',
            aliquotaPisCofinsInsumos: '0.0925',
          },
        },
        {
          idExterno: 'coca-bruto',
          descricao: 'Coca-Cola bruto',
          ncm: '2202.10.00',
          compra: {
            totalNota: '4.89',
            aliquotaIcms: '0.18',
            aliquotaIpi: '0.026',
            aliquotaPisCofins: '0.13',
            substituicaoTributaria: { mva: '0.42', aliquotaInterna: '0.18' },
            modoFornecedor: 'PRECO_BRUTO',
          },
        },
      ],
    });
    const resp = simular(requisicao, tabela, 'req-servico-1');
    expect(RespostaSimulacaoV1.safeParse(resp).success).toBe(true);
    expect(resp.itens.map((i) => i.situacao)).toEqual(['calculado', 'calculado']);
  });
});
