# Reduções e alíquota zero da LC 214/2025 (Onda 2)

## O que entra

O tratamento de CBS e IBS do produto é informado pela **classificação tributária (cClassTrib)**, o mesmo código que vai na NF-e. A redução vale na compra e na venda do mesmo produto, de 2027 em diante. Em 2026, o destaque de teste não tem efeito econômico, então nada muda.

São 16 tratamentos de mercadoria que dependem só do produto (além de 2 tratamentos exclusivos de serviço por NBS expostos em `GET /v1/classificacao`, `200028` Educação no Anexo II e `200029` Saúde no Anexo III):

| cClassTrib | Artigo (LC 214/2025) | Tratamento                                                                          | Anexo de NCM | Redução       |
| ---------- | -------------------- | ----------------------------------------------------------------------------------- | ------------ | ------------- |
| 200003     | Art. 125             | Cesta básica nacional                                                               | Anexo I      | alíquota zero |
| 200004     | Art. 144, I          | Dispositivos médicos                                                                | Anexo XII    | alíquota zero |
| 200007     | Art. 145, I          | Dispositivos de acessibilidade                                                      | Anexo XIII   | alíquota zero |
| 200009     | Art. 146             | Medicamentos registrados na Anvisa (indicações do caput)                            | sem anexo    | alíquota zero |
| 200013     | Art. 147             | Tampões, absorventes e coletores menstruais (`9619.00.00` na lei)                   | sem anexo    | alíquota zero |
| 200014     | Art. 148             | Hortícolas, frutas e ovos                                                           | Anexo XV     | alíquota zero |
| 200053     | Art. 146, § 1º, III  | Medicamentos registrados na Anvisa: soros e vacinas                                 | sem anexo    | alíquota zero |
| 200030     | Art. 131             | Dispositivos médicos                                                                | Anexo IV     | 60%           |
| 200031     | Art. 132             | Dispositivos de acessibilidade                                                      | Anexo V      | 60%           |
| 200032     | Art. 133             | Medicamentos registrados na Anvisa ou de manipulação                                | sem anexo    | 60%           |
| 200033     | Art. 133, § 1º       | Nutrição enteral e parenteral                                                       | Anexo VI     | 60%           |
| 200034     | Art. 135             | Alimentos destinados ao consumo humano                                              | Anexo VII    | 60%           |
| 200035     | Art. 136             | Higiene pessoal e limpeza                                                           | Anexo VIII   | 60%           |
| 200036     | Art. 137             | Produtos agropecuários, aquícolas, pesqueiros, florestais e extrativistas in natura | sem anexo    | 60%           |
| 200038     | Art. 138             | Insumos agropecuários e aquícolas                                                   | Anexo IX     | 60%           |
| 200039     | Art. 139             | Bens de produções artísticas, culturais, jornalísticas e audiovisuais               | Anexo X      | 60%           |

## Fontes oficiais

1. **Percentuais e classificações (`V0066`, 28/10/2026):** dados abertos da Calculadora de Tributos da Receita Federal (`GET /calculadora/dados-abertos/classificacoes-tributarias/cbs-ibs?data=2027-07-01`), em `packages/regras/fontes/rfb-cclasstrib-V0066.json` e `packages/regras/dados/reducoes-cclasstrib.yaml`.
2. **Anexos de NCM e NBS, exceções, artigos da LC 214/2025 e catálogo do Simples Nacional (`V0059` e `NT 2026.005 v1.00`):** extraídos diretamente das migrações SQL oficiais dos repositórios públicos [ReceitaFederal/calculadora-rtc-regime-regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular) e [ReceitaFederal/calculadora-rtc-simples-nacional](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional), consolidados em `packages/regras/fontes/rfb-rtc-anexos-V0059.json`.

## Modelo de cálculo e conferência por NCM

- **Cálculo:** alíquota efetiva = alíquota do ano × (1 − redução), para a CBS e para o IBS (`aliquotasCbsIbs` no motor). Na compra e na venda do regime regular, a redução diminui o destaque e o crédito; na alíquota zero não há destaque nem crédito. No Simples (DAS), a CBS e o IBS reduzidos da compra entram no custo.
- **Sugestão e crítica por NCM/NBS (`@calculafiscal/regras/classificacao` e `GET /v1/classificacao`):** usa exatamente a tabela-verdade de `NcmAplicavelService` e `NbsAplicavelService` da Receita Federal (`A && (!E || S)`), tratando prefixos genéricos e exceções específicas (`EXCECAO_NCM_APLICAVEL`, como lagostas `0306.11` excluídas do Anexo VII).
- **Grau de confiança:** `ALTA` quando o NCM consta em um único anexo geral de produto; `MEDIA` quando aparece em mais de um anexo geral (ex.: `9021.10.10` nos Anexos XII e IV), quando exige destinação específica (`200038` e `200039`) ou no caso legal do `9619.00.00` (`200013`, art. 147, que compartilha o código com fraldas); `PADRAO` (`000001`) quando não consta em anexo.

## Limitações conhecidas

1. **Descrição comercial dentro do NCM:** estar no anexo pelo código NCM é condição necessária, mas alguns itens do anexo trazem especificações de produto (como teor, embalagem ou finalidade); a tela e a API exibem o texto do item do anexo para conferência.
2. **Tratamentos sem anexo de NCM:** medicamentos registrados na Anvisa (`200009`, `200032`, `200053`) e produtos _in natura_ (`200036`) não têm lista de NCM na base da Receita Federal, pois dependem de registro sanitário ou de estado natural.
3. **Condicionados ao comprador ou a regime específico:** administração pública, produtor rural não contribuinte, cooperativa, Zona Franca de Manaus e regimes específicos ficam para as próximas ondas.
