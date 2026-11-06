# Decisões aprovadas na Fase 0 (06/11/2026)

| # | Tema | Decisão |
|---|---|---|
| 1 | Repositório | github.com/Trustcorporation88/CalculaFiscal. Nome de trabalho do produto: CalculaFiscal |
| 2 | Margem | As duas bases são calculadas e exibidas sempre. A margem sobre o preço com tributo vem selecionada por padrão, e a margem sobre a receita líquida aparece ao lado. A API devolve as duas |
| 3 | Caso Coca-Cola | O lado "correto" usa dados de referência públicos (preço de fábrica, MVA de SP e alíquotas), todos marcados como ESTIMATIVA até chegar um XML real |
| 4 | Infraestrutura | Eu crio os projetos Supabase (staging e produção) e Railway (staging e produção) |
| 5 | Escopo até 02/02/2027 | Núcleo da Onda 1: fundação, motor, regras, API com SDK e telas essenciais (calculadora, linha do tempo, fontes). Integração no ProContador, app Android e painel completo ficam logo depois |

## Ainda em aberto

- Domínio.
- Nome do contador responsável pela conferência humana.
- Divergências da seção B de [ambiguidades-e-decisoes.md](ambiguidades-e-decisoes.md): o modelo segue o texto normativo e mostra as duas versões quando houver divergência.
- O repositório está **público**. Para um SaaS pago, o recomendado é torná-lo privado (os segredos nunca vão para o repositório de qualquer forma).
