# Reduções e alíquota zero da LC 214/2025 (Onda 2, parte 1)

## O que entra

O tratamento de CBS e IBS do produto é informado pela **classificação tributária (cClassTrib)**, o mesmo código que vai na NF-e. A redução vale na compra e na venda do mesmo produto, de 2027 em diante. Em 2026, o destaque de teste não tem efeito econômico, então nada muda.

São 16 tratamentos de mercadoria que dependem só do produto:

| cClassTrib | Tratamento                                                                          | Redução       |
| ---------- | ----------------------------------------------------------------------------------- | ------------- |
| 200003     | Cesta básica nacional (Anexo I)                                                     | alíquota zero |
| 200004     | Dispositivos médicos (Anexo XII)                                                    | alíquota zero |
| 200007     | Dispositivos de acessibilidade (Anexo XIII)                                         | alíquota zero |
| 200009     | Medicamentos registrados na Anvisa (Anexo XIV)                                      | alíquota zero |
| 200013     | Tampões e absorventes higiênicos                                                    | alíquota zero |
| 200014     | Hortícolas, frutas e ovos (Anexo XV)                                                | alíquota zero |
| 200053     | Medicamentos: soros e vacinas                                                       | alíquota zero |
| 200030     | Dispositivos médicos (Anexo IV)                                                     | 60%           |
| 200031     | Dispositivos de acessibilidade (Anexo V)                                            | 60%           |
| 200032     | Medicamentos registrados na Anvisa ou de manipulação                                | 60%           |
| 200033     | Nutrição enteral e parenteral (Anexo VI)                                            | 60%           |
| 200034     | Alimentos (Anexo VII)                                                               | 60%           |
| 200035     | Higiene pessoal e limpeza (Anexo VIII)                                              | 60%           |
| 200036     | Produtos agropecuários, aquícolas, pesqueiros, florestais e extrativistas in natura | 60%           |
| 200038     | Insumos agropecuários e aquícolas (Anexo IX)                                        | 60%           |
| 200039     | Bens de produções artísticas, culturais, jornalísticas e audiovisuais (Anexo X)     | 60%           |

## Fonte

Os percentuais vêm da tabela oficial de classificações tributárias da Calculadora de Tributos da Receita Federal, nos dados abertos (`GET /calculadora/dados-abertos/classificacoes-tributarias/cbs-ibs?data=2027-07-01`). A base é a V0066, de 28/10/2026, e a consulta foi feita em 06/11/2026. A cópia integral da resposta está em `packages/regras/fontes/rfb-cclasstrib-V0066.json`, e as regras estão em `packages/regras/dados/reducoes-cclasstrib.yaml`.

Os números de artigo da LC 214 foram anotados de memória e estão como **CONFERIR** em cada regra.

## Modelo de cálculo

- Alíquota efetiva = alíquota do ano × (1 − redução), para a CBS e para o IBS (`aliquotasCbsIbs` no motor).
- Na compra, o fornecedor destaca a CBS e o IBS reduzidos. Na alíquota zero, não há destaque nem crédito.
- Na venda, a CBS e o IBS por fora também são reduzidos. Na alíquota zero, o preço com tributo é igual ao preço, e o crédito ao cliente é zero.
- No Simples (DAS), a CBS e o IBS da compra, já reduzidos, entram no custo.

## Limitações

1. **Não há sugestão automática pelo NCM.** As listas de NCM dos anexos estão no texto oficial da LC 214, em PDF ou imagem nas páginas do Planalto e da Câmara. Elas não puderam ser extraídas com segurança: o Planalto bloqueia o download automatizado, e um resumo automático de centenas de códigos não serve para regra fiscal. A API da Receita só valida NCM e cClassTrib um par por vez, e o firewall dela barra consultas em série. Enquanto isso, o enquadramento é informado por quem usa, e a tela pede a conferência do NCM no anexo.
2. **Ficam de fora os tratamentos condicionados ao comprador ou à situação:** administração pública, produtor rural, cooperativa, Zona Franca de Manaus e emergência de saúde. Também ficam de fora os serviços (redução de 30% e serviços da Onda 3) e os regimes específicos.
3. **2027 e 2028:** a redução também é aplicada ao IBS de teste (0,1%), como faz a calculadora oficial pelos percentuais de redução do IBS estadual e municipal. O valor é irrelevante.

## Próximo passo

Carregar as listas de NCM dos anexos (I, IV a X, XII a XV) a partir do texto oficial, para sugerir o cClassTrib pelo NCM e acusar quando o NCM informado não constar no anexo. A forma mais segura é baixar manualmente o PDF ou DOCX oficial dos anexos e extraí-los localmente, com conferência.
