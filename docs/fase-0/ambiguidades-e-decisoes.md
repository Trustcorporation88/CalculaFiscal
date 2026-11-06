# Ambiguidades, divergências e decisões pendentes (Fase 0)

Precisam da sua resposta antes da Fase 1.

## A. Dados que faltam no prompt

1. Nome do produto e marca ([NOME DO PRODUTO], [MARCA]).
2. Domínio ([dominio.com.br]).
3. Nome do repositório em github.com/Trustcorporation88/.
4. Nome do contador responsável pela conferência humana (seção 12.6).
5. Esta pasta (`C:\Calculadora Fiscal`) não é um repositório git. Crio o repositório aqui e ligo ao GitHub quando você informar o nome?
6. Contas: os projetos do Supabase (staging e produção) e do Railway já existem ou eu crio? A criação gera custo.

## B. Divergências entre fontes (vou mostrar as duas versões, como o prompt pede)

1. **Prazo do Senado para a CBS de 2027:** 15/12/2026 (maioria das fontes) x 22/12/2026 (Agência Senado).
2. **Cancelamento da opção do Simples / regime regular:** 03/11 a 20/12/2026 (Res. CGSN 194, segundo ICBR e Reformatributaria.com) x até 30/11/2026 (redação anterior). O prompt diz que o prazo "diverge entre as fontes", e a versão mais recente indica 20/12.
3. **Pequenos produtores de bebidas (MP art. 6):** o inciso IV diz "não exceda 250 mil litros" e o §1º, III diz "inferior a". Também não está claro se a medida é em litros de álcool ou em volume de bebida. Isso muda o enquadramento exatamente em 250.000.
4. **R$ 3,50 dos cigarros:** a unidade (vintena, ou seja, maço com 20) não aparece de forma explícita na tabela do Anexo IV.
5. **"Fator de ajuste cumulativo":** no texto da MP, o fator de ajuste (art. 8) vale só na importação (1,45 para bebidas). O prompt dá a entender que ele também se aplica à produção nacional. Proponho modelar o fator só na importação.
6. **Alíquotas específicas zeradas em 2027:** parte da imprensa leu o art. 6, II como zeragem do IS sobre bebidas. O texto zera apenas a parcela específica (R$ por unidade) e mantém a ad valorem dos Anexos IV e V. Vou seguir o texto.
7. **Número dos artigos da LC 214:** o prompt cita o art. 347 para a redução de 0,1 p.p. A LC 214 foi alterada pela LC 227/2026 e não consegui ler a parte das disposições transitórias na versão compilada. Todos os números de artigo da transição ficam como CONFERIR até a leitura completa.

## C. Pontos de modelagem que precisam da sua decisão

1. **Margem padrão:** sobre o preço com tributo ou sobre a receita líquida? O site mostra as duas, mas uma precisa ser o padrão.
2. **Caso Coca-Cola:** preciso de uma nota de compra real (XML) da distribuidora, ou de dados de referência (preço de fábrica, MVA de SP, regime da distribuidora), para calcular o "correto". Sem isso, o exemplo da página inicial mostra os campos como dado pendente. Você tem um XML?
3. **Oráculo da Receita:** não confirmei se a calculadora (piloto-cbs.tributos.gov.br) tem API pública e quais são os termos de uso. Se não tiver, o critério 12.1 vira conferência manual com amostras.
4. **Janeiro de 2027 sem IS e sem IPI (sem a PEC):** confirmar que o cenário padrão é "sem PEC" (direito vigente) e que "com PEC" fica como cenário alternativo.
5. **IBS de 2029 a 2033:** quais níveis você quer como cenários de ESTIMATIVA? Proposta: baixo 26,5%, central 28,0% e alto 29,5% de IVA total, a validar.

## D. Conflitos de prioridade

1. O prompt pede a Onda 1 antes de 02/02/2027, o que dá cerca de 12 semanas. Isso cobre fundação, motor, API, SDK, integração no contador-saas, telas e validação. É muito apertado com o padrão de qualidade pedido. Proponho que a entrega até 02/02 seja motor, API e telas essenciais da Onda 1, com o app Android e o painel completo logo depois.
2. Se a adequação da NFS-e nacional no ProContador estiver em andamento, a integração (fase 4) concorre pelo mesmo time. Qual tem prioridade?
