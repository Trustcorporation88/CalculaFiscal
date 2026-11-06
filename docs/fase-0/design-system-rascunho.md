# Design system: rascunho da Fase 0

O nome e a marca ainda não foram definidos ([MARCA]). Esta é uma direção visual para você aprovar ou trocar, não a identidade final.

## Conceito

"Livro-razão preciso": a interface lembra um documento contábil confiável, com números em destaque, memória de cálculo legível como um demonstrativo e status das regras sempre visíveis. Fica longe do visual de "dashboard de startup" com gradiente.

## Tipografia

- Texto: **Inter** (variável), 16 px de base, altura de linha 1,5.
- Números: **IBM Plex Mono** ou Inter com `font-variant-numeric: tabular-nums`, para os valores alinharem por vírgula nas tabelas.
- Escala (rem): 0,75 · 0,875 · 1 · 1,125 · 1,375 · 1,75 · 2,25 · 3.

## Cores (tokens)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--cor-tinta` | #14213D | #E8ECF4 | texto principal |
| `--cor-papel` | #FBFAF7 | #0E1524 | fundo |
| `--cor-primaria` | #1F4E79 | #7FB0E0 | ações e links |
| `--cor-acento` | #C28A2C | #E0B25E | destaques de preço |
| `--status-vigor` | #1E7A4C | #5CC48E | EM VIGOR |
| `--status-futuro` | #1F4E79 | #7FB0E0 | EFEITO FUTURO |
| `--status-proposto` | #6B4FA3 | #B49AE6 | PROPOSTO |
| `--status-pendente` | #B45309 | #F2A65A | PENDENTE |
| `--status-estimativa` | #8A6D1F | #D9BF6A | ESTIMATIVA |
| `--cor-erro` | #B42318 | #F97066 | erro |

Todos os pares de texto e fundo precisam passar 4,5:1 (WCAG AA), e isso será validado por script no CI. O status nunca depende só da cor: cada um tem ícone e rótulo.

## Espaçamento, raio e elevação

- Grade de 4 px: 4, 8, 12, 16, 24, 32, 48, 64.
- Raio: 6 px nos controles e 10 px nos cartões. Sombras discretas, com uso preferencial de borda de 1 px.

## Componentes próprios (além do shadcn/ui)

- **SeloStatus:** pílula com ícone, rótulo e tooltip com a fonte e a vigência.
- **ValorMonetario:** R$ formatado com `Intl.NumberFormat('pt-BR')`, alinhado e com variação (+/−) opcional.
- **MemoriaCalculo:** lista numerada de passos (fórmula, valores e regra aplicada com link para a fonte), recolhível e igual na tela, no PDF e na API.
- **LinhaDoTempo2026a2033:** tabela e gráfico por ano com o preço que mantém a margem, a carga e o status das premissas daquele ano.
- **ComparadorSimplificadoCorreto:** duas colunas com as diferenças numeradas, ligadas aos seis erros da seção 2 do prompt.
- **CampoNCM / CampoCNPJ / CampoMoeda / CampoPercentual:** máscara, validação e mensagens em português.
- **EstadoVazio / EstadoErro / EstadoSemPermissao / EstadoDadoPendente.**

## Tom de texto

Português do Brasil, direto e sem travessão. Sempre "valor estimado" ou "aguardando o Senado" em vez de esconder a incerteza.
