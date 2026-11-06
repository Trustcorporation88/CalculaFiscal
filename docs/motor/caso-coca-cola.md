# Motor da Onda 1: modelo de cálculo e caso Coca-Cola

Motor `@calculafiscal/motor-fiscal` 0.2.0, tabelas de `packages/regras/dados` em 06/11/2026. Os números deste documento são reproduzidos pelos testes `packages/regras/test/resolver.test.ts` e `packages/motor-fiscal/test/preco.test.ts`.

## Modelo

**Compra (reconstruída a cada ano).** O fornecedor mantém a receita líquida, sem tributos. Sobre ela o motor remonta a nota do ano:

1. **IS** = preço líquido × alíquota do IS. Base sem ICMS, CBS e IBS (MP 1.399, art. 6, I, b). Monofásico, sem crédito.
2. **Valor da operação** = (preço líquido + IS) ÷ (1 − ICMS × fator − PIS/Cofins). ICMS e PIS/Cofins são por dentro.
3. **IPI** = valor da operação × TIPI, só enquanto vigente.
4. **CBS e IBS** = (valor da operação − ICMS − PIS/Cofins) × alíquota, por fora (LC 214, art. 12, §2º, V). Em 2026 não têm efeito econômico.
5. **ICMS-ST** = (valor da operação + IPI + frete) × (1 + MVA) × alíquota interna × fator − ICMS próprio, nunca negativo.

**Créditos do comprador.** Entram o ICMS próprio (sem ST), o PIS/Cofins (quando há crédito) e a CBS e o IBS destacados. A CBS e o IBS só geram crédito fora do Simples no DAS. **IS, IPI (no comércio) e ICMS-ST nunca viram crédito.**

**Venda.**

- O preço P inclui o ICMS e o PIS/Cofins (ou o DAS) por dentro. A CBS e o IBS são por fora, sobre P − ICMS − PIS/Cofins.
- O cliente paga **P × k**, com k = 1 + (CBS + IBS) × (1 − ICMS − PIS/Cofins).
- Margem sobre o preço com tributo: P = custo ÷ (1 − tributos por dentro − despesas − margem × k).
- Margem sobre a receita líquida: P = custo ÷ ((1 − tributos por dentro) × (1 − margem) − despesas).
- O resultado sempre traz **as duas margens**.

**Simples Nacional.**

- **DAS:** a CBS e o IBS da compra viram custo. O crédito que o cliente recebe depende da parcela de CBS/IBS do DAS por anexo, que ainda é **PENDENTE**. Sem ela, o motor devolve "PENDENTE" em vez de um número.
- **Regime regular:** sem essa partilha, o motor devolve **DADO_PENDENTE** e não calcula o ano.

**Status de cada ano.** É o status menos firme entre as regras usadas, na ordem EM VIGOR, PUBLICADO COM EFEITO FUTURO, PROPOSTO, PENDENTE e ESTIMATIVA.

## Premissas do caso Coca-Cola 600 ml (todas ESTIMATIVA até chegar um XML real)

| Item                                                                                          | Valor                           | Origem                                                  |
| --------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------- |
| ICMS do fabricante e alíquota interna SP                                                      | 18%                             | premissa, a conferir no RICMS/SP                        |
| IPI (TIPI 2026, NCM 2202.10.00)                                                               | 2,6%                            | coerente com a alíquota inicial do IS na MP 1.399       |
| PIS/Cofins monofásico do fabricante                                                           | 13% (2,32% + 10,68%)            | Lei 13.097/2015, a conferir                             |
| MVA do ICMS-ST                                                                                | 42%                             | calibrada para a nota de 2026 fechar em R$ 4,89         |
| Preço líquido do fabricante                                                                   | R$ 3,04                         | calibrado (nota de 2026 = R$ 4,89)                      |
| Fabricante mantém o preço líquido de 2026 em diante                                           | sim                             | **premissa forte**: repassa a queda de PIS/Cofins e IPI |
| Distribuidora: despesas 6%, margem 25% sobre o preço com tributo, revenda com ST e monofásica | sim                             | caso do vídeo                                           |
| IS 2028+                                                                                      | repete 2027                     | sem lei ainda                                           |
| CBS 2028+ e IBS 2029+                                                                         | cenário central (IVA total 28%) | ESTIMATIVA                                              |

Nota de 2026: valor da operação R$ 4,41 (com ICMS de R$ 0,79 e PIS/Cofins de R$ 0,57 dentro), IPI de R$ 0,11 e ICMS-ST de R$ 0,37, total de **R$ 4,89**.

## Resultado: distribuidora no regime regular (Lucro Real)

| Ano  | Status     | Nota de compra | Custo líquido | Preço | CBS+IBS | Cliente paga | Margem s/ preço c/ tributo | Margem s/ receita líquida |
| ---- | ---------- | -------------- | ------------- | ----- | ------- | ------------ | -------------------------- | ------------------------- |
| 2026 | EM VIGOR   | 4,89           | 4,89          | 7,09  | 0,00    | **7,09**     | 25,0%                      | 25,0%                     |
| 2027 | PENDENTE   | 4,44           | 4,09          | 6,18  | 0,70    | **6,88**     | 25,0%                      | 27,8%                     |
| 2028 | ESTIMATIVA | 4,44           | 4,09          | 6,18  | 0,70    | 6,88         | 25,0%                      | 27,8%                     |
| 2029 | ESTIMATIVA | 4,38           | 3,98          | 6,05  | 0,78    | 6,83         | 25,0%                      | 28,3%                     |
| 2030 | ESTIMATIVA | 4,31           | 3,86          | 5,91  | 0,87    | 6,78         | 25,1%                      | 28,8%                     |
| 2031 | ESTIMATIVA | 4,27           | 3,76          | 5,79  | 0,94    | 6,73         | 25,0%                      | 29,0%                     |
| 2032 | ESTIMATIVA | 4,22           | 3,66          | 5,67  | 1,02    | 6,69         | 25,0%                      | 29,5%                     |
| 2033 | ESTIMATIVA | 3,99           | 3,12          | 5,03  | 1,41    | 6,44         | 25,0%                      | 32,0%                     |

## Resultado: distribuidora no Simples, IBS/CBS no DAS, alíquota efetiva de 8%

| Ano  | Status     | Nota de compra | Custo líquido | Cliente paga | Crédito ao cliente |
| ---- | ---------- | -------------- | ------------- | ------------ | ------------------ |
| 2026 | EM VIGOR   | 4,89           | 4,89          | **8,02**     | 0,00               |
| 2027 | PENDENTE   | 4,44           | 4,44          | 7,28         | PENDENTE           |
| 2030 | ESTIMATIVA | 4,31           | 4,31          | 7,07         | PENDENTE           |
| 2033 | ESTIMATIVA | 3,99           | 3,99          | 6,54         | PENDENTE           |

## Leitura contra o cálculo simplificado (R$ 8,02 → R$ 11,51)

1. **R$ 8,02 hoje** só se reproduz com os 8% do Simples sobre o preço. No regime regular, a revenda de um produto com ST e monofásico não paga ICMS nem PIS/Cofins, e o preço que mantém 25% é R$ 7,09.
2. **Os 26,5% não valem em 2027.** São 11,2% de CBS mais 0,1% de IBS, por fora e com crédito.
3. **Por fora, não por dentro.** Aplicar 26,5% por dentro sobre o preço inteiro infla o preço. A CBS e o IBS incidem sobre o valor sem ICMS e PIS/Cofins, e o crédito da compra desconta o que já foi pago.
4. **O IS entra no custo** (R$ 0,08 por unidade em 2027) e nunca vira crédito.
5. **O custo muda:** saem PIS/Cofins e IPI do fabricante e o ICMS-ST vai caindo até 2033. Em nenhum ano o preço chega perto de R$ 11,51.

## Limitações conhecidas

- **Nota em centavos não fixa o preço líquido.** A calculadora parte do total da nota (R$ 4,89) e acha o preço líquido do fabricante; qualquer valor entre R$ 3,040 e R$ 3,053 fecha a mesma nota. As tabelas acima usam R$ 3,040; a tela usa o centavo inteiro mais ao meio da faixa (R$ 3,050) e por isso mostra, por exemplo, R$ 7,31 em 2027 no Simples (R$ 7,28 aqui). A tela informa a faixa junto da premissa.

- A premissa de preço líquido constante do fabricante pesa muito no resultado. Falta um cenário em que o fabricante **mantém o preço bruto**.
- No Simples, o DAS de produtos com ST ou monofásicos não inclui as parcelas de ICMS e de PIS/Cofins. Os 8% vieram do vídeo e precisam ser recalculados por anexo.
- Granularidade anual, com data de referência em 1º de julho. Janeiro de 2027, que fica sem IS e, sem a PEC, sem IPI, ainda não é tratado mês a mês.
- O IS de fumígenos com preço tabelado (base de 15% do varejo) e as reduções para pequenos produtores ainda não estão no motor.
