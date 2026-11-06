# Prompt: site profissional de precificação na Reforma Tributária

Prompt para construir o site do zero com o Claude Code. Fatos legais verificados em 06/11/2026: antes de usar, confira se algum item marcado como PENDENTE já mudou. Os trechos entre colchetes são para você preencher.

---

## 1. Papel, produto e padrão de qualidade

Você é o engenheiro principal deste produto e trabalha comigo como se fosse um time sênior: arquitetura, código, testes, segurança, design e operação. O padrão é de produto SaaS profissional, que eu possa vender para empresas e escritórios de contabilidade. Nada de protótipo, tela de demonstração, dado fictício em produção ou funcionalidade de vitrine.

**Produto:** [NOME DO PRODUTO], site de custo, preço e margem por produto e por serviço na transição da Reforma Tributária. Ele mostra, ano a ano de 2026 a 2033, o efeito da CBS, do IBS e do Imposto Seletivo (IS) junto com os tributos que continuam ou acabam (ICMS, ICMS-ST, ISS, PIS/Cofins, IPI, Simples Nacional), e diz quanto cobrar para manter a margem.

**Público:** empresas (indústria, distribuidor, varejo, prestador de serviço) e escritórios contábeis que atendem carteiras de clientes.

**Domínio:** [dominio.com.br]. **Repositório:** github.com/Trustcorporation88/[nome-do-repo].

**Primeiro cliente da API:** o ProContador (repositório Trustcorporation88/contador-saas), que vai consumir o motor por API para precificar os produtos e serviços das empresas das carteiras dele. O site e a API são o mesmo produto, e a API é tratada como produto de primeira classe desde o primeiro dia, não como algo para depois.

**Regra principal:** o site não pode dar um número errado com aparência de certo. Toda alíquota tem fonte, vigência e status. Todo resultado mostra a memória de cálculo. Quando um dado for estimativa ou estiver pendente, isso aparece na tela.

## 2. O erro de mercado que o produto corrige

Um app concorrente ("Hub Precifica Pro") divulga esta conta para uma distribuidora que revende Coca-Cola 600 ml:

- Hoje: custo R$ 4,89, despesas variáveis 6%, imposto 8%, margem 25%. Preço = 4,89 ÷ (1 − 0,06 − 0,08 − 0,25) = R$ 8,02.
- "Reforma": troca os 8% por 26,5% de IBS+CBS. Preço = 4,89 ÷ (1 − 0,06 − 0,265 − 0,25) = R$ 11,51.

O que está errado e o nosso site precisa tratar e explicar:

1. IBS/CBS tratados como imposto por dentro sobre o preço inteiro. Na verdade, os dois são não cumulativos, calculados por fora, e quem está no regime regular recupera como crédito o que pagou na compra.
2. 26,5% aplicados como se valessem já. Em 2027 a CBS é a alíquota de referência menos 0,1 p.p., o IBS é 0,1% e o ICMS continua integral.
3. O Imposto Seletivo é ignorado. Ele é monofásico, cobrado na indústria ou na importação, não gera crédito e chega embutido no custo de quem revende.
4. Os 8% provavelmente são uma alíquota efetiva do Simples Nacional, cuja escolha entre IBS/CBS no DAS e regime regular muda o crédito do comprador.
5. O custo de hoje já carrega ICMS-ST, PIS/Cofins monofásico e IPI, que mudam ou acabam. O custo futuro precisa ser reconstruído.
6. Mistura de bases de margem: sobre o preço com tributo ou sobre a receita líquida. O site mostra as duas.

Esse caso é o primeiro teste de aceite e o exemplo da página inicial: o cálculo simplificado e o correto, lado a lado, com a memória de cada diferença.

## 3. Fatos legais de partida (status em 06/11/2026)

Cada item vira dado versionado no banco (valor, vigência, fonte, artigo, status), nunca fixo no código. Status: EM VIGOR, PUBLICADO COM EFEITO FUTURO, PROPOSTO, PENDENTE, ESTIMATIVA.

**Imposto Seletivo**
- Medida Provisória nº 1.399, de 4/11/2026 (DOU, edição extra nº 207-B): PUBLICADO COM EFEITO FUTURO. Produz efeitos a partir de 2/2/2027 (noventena), com regime temporário até 31/12/2027 e novas alíquotas a partir de 2028. Ainda depende de conversão em lei, então o site precisa de cenários para caducidade ou alteração.
- Bebidas alcoólicas, bebidas açucaradas e fumígenos: alíquota do IS = alíquota inicial × fator de conversão (Anexos IV e V). Em regra, a alíquota inicial é a do IPI na TIPI de 2026 (Decreto nº 11.158/2022). O fator compensa a diferença de base (a base do IPI inclui ICMS e PIS/Cofins, a do IS não). Um decreto pode reduzir o fator até 1,00, e há um fator de ajuste cumulativo. Confirmar ambos no texto.
- Tabela recebida, a conferir contra o anexo oficial antes de cadastrar: bebidas açucaradas 2202.10.00: 2,6 × 1,00 = 2,6%. Cervejas 22.03: 3,9 × 1,07 = 4,2%. Vinhos e fermentadas 22.04/22.06, com exceções: 6,5 × 1,23 = 8,0%. Vermutes 22.05: 9,75 × 1,23 = 12,0%. Vinhos do Porto, Madeira e Xerez e fermentadas acima de 14%: 13 × 1,23 = 16,0%. Refrescantes abaixo de 8% (2208.90.00): 13 × 1,23 = 16,0%. Aguardentes de cana 2208.40.00, exceto de melaço: 16,25 × 1,23 = 20,0%. Demais da posição 22.08: 19,5 × 1,23 = 24,0%. Cigarros e cigarrilhas: 66,7 × 1,00 = 66,7% mais R$ 3,50 específico. Demais fumígenos 24.01 a 24.04: 30 × 1,25 = 37,5%.
- Fumígenos com preço tabelado têm base própria. A MP também prevê faixas para pequenos produtores de bebidas alcoólicas e trata de veículos, embarcações, aeronaves, bens minerais e loterias. Modelar tudo.
- PEC nº 22/2026, que prorroga o IPI desses produtos até o início do IS (cobre janeiro de 2027): PROPOSTO. Mostrar o cenário com PEC e o sem PEC.
- Natureza do IS: monofásico, sem crédito, não integra a própria base. Confirmar na Constituição (art. 153, §6º) e na LC 214/2025 como ele entra nas bases de ICMS, IBS e CBS.

**CBS e IBS**
- 2026: ano de teste, CBS 0,9% e IBS 0,1%, com dispensa ou compensação conforme as regras.
- 2027 e 2028: CBS = alíquota de referência menos 0,1 p.p. (LC 214/2025, art. 347), e IBS de 0,1% (confirmar a divisão estadual e municipal).
- Referência da CBS para 2027: 11,3%, calculada pelo TCU em 28/10/2026, PENDENTE de resolução do Senado até 15/12/2026. Sem resolução, vale o percentual do TCU. Se confirmada, a CBS aplicada é 11,2%.
- Referências do IBS de 2029 a 2033: PENDENTE. Usar cenários marcados como ESTIMATIVA.
- PIS/Cofins extintos em 1/1/2027. IPI zerado em 2027, exceto na Zona Franca de Manaus e no tratamento da PEC.
- ICMS e ISS integrais até 2028, depois 90%, 80%, 70% e 60% de 2029 a 2032, e extintos em 2033. Confirmar no ADCT e na LC 214/2025.
- Reduções e tratamentos diferenciados da LC 214/2025: cesta básica nacional com alíquota zero, reduções de 60% e de 30%, isenções, devolução personalizada (cashback) e regimes específicos (combustíveis, serviços financeiros, imóveis, bares e restaurantes, hotelaria, agências de turismo, entre outros). A classificação sai de NCM/NBS + CST + cClassTrib, conforme as tabelas do Portal NF-e.

**Simples Nacional**
- A empresa escolhe por semestre entre IBS/CBS dentro do DAS ou pelo regime regular (regime híbrido), mantendo os demais tributos no DAS.
- Dentro do DAS, o crédito do comprador fica limitado ao valor de IBS/CBS efetivamente recolhido. No regime regular, o comprador se credita do valor destacado e a empresa passa a ter crédito nas próprias compras.
- Opção para o 1º semestre de 2027 encerrada em 30/10/2026 (Resolução CGSN nº 194/2026). O prazo de cancelamento diverge entre as fontes, então confirmar. Nova janela em março de 2027, valendo para o 2º semestre.
- Confirmar na LC 123/2006 alterada e nas Resoluções CGSN 186, 190 e 194/2026 a partilha do IBS/CBS no DAS por anexo.

**Tributos de hoje que compõem o custo**
- PIS/Cofins monofásico (bebidas frias, perfumaria, cosméticos e higiene, medicamentos, autopeças, combustíveis), ICMS-ST com MVA por produto e estado (começar por SP), IPI pela TIPI e DIFAL. Reconstruir o custo a partir de notas reais.

## 4. Escopo por ondas

O motor e o modelo de dados são genéricos desde o início: qualquer NCM ou NBS, qualquer regime, qualquer UF. A liberação para o usuário é feita por ondas, e cada onda só é aberta depois de cumprir os critérios da seção 12.

- **Onda 1 (prioridade, antes de 2/2/2027):** regra geral de CBS/IBS para qualquer mercadoria, ICMS e ICMS-ST de SP, Simples Nacional nas duas formas e Imposto Seletivo completo (bebidas e fumígenos).
- **Onda 2:** reduções de 60% e 30%, cesta básica, isenções e os monofásicos atuais (incluindo perfumaria e cosméticos), além de ICMS-ST dos demais estados.
- **Onda 3:** serviços (transição do ISS para o IBS, classificação NBS, profissões regulamentadas).
- **Onda 4:** regimes específicos (combustíveis, bares e restaurantes, hotelaria, imóveis e os demais), mais os outros produtos do IS (veículos, embarcações, aeronaves, bens minerais).

## 5. Arquitetura e stack

- **Monorepo** com pnpm workspaces e Turborepo, TypeScript em modo strict em todos os pacotes, sem `any` implícito.
  - `apps/web`: Next.js (App Router) com o site público e a aplicação logada.
  - `apps/worker`: processamento assíncrono (importação de XML e planilhas, chamadas à calculadora oficial, simulações em lote e Monte Carlo, relatórios).
  - `packages/motor-fiscal`: motor de cálculo puro, sem I/O, com aritmética decimal (decimal.js ou equivalente) e 100% testado. É reutilizável: o ProContador deve poder consumir este pacote ou a API, para que exista uma só verdade fiscal entre os dois sistemas.
  - `packages/regras`: esquema e carga das tabelas versionadas de alíquotas e regras, com validação (Zod).
  - `packages/db`: migrations do Supabase, tipos gerados e funções de acesso.
  - `packages/ui`: design system (Tailwind + shadcn/ui), tokens e componentes.
- **Supabase:** Postgres, Auth, Storage e RLS.
  - Dois projetos: staging e produção.
  - Migrations versionadas no repositório com a Supabase CLI. Nenhuma alteração de schema é feita pelo painel.
  - Modelo multi-tenant por organização, com RLS em todas as tabelas de dados de cliente e testes automatizados de isolamento entre organizações.
  - Auth com e-mail e senha, link mágico e MFA (TOTP), obrigatório para administradores.
  - Storage privado para XMLs e planilhas, com URLs assinadas de curta duração.
- **Railway:** serviços `web` e `worker`, ambientes de staging e produção, health check, deploy automático a partir do GitHub e ambiente temporário por PR.
- **Fila de jobs:** pg-boss ou equivalente sobre o Postgres, para não colocar trabalho pesado dentro da requisição HTTP. Jobs com lock por organização para não haver execução duplicada.
- **API pública:** REST documentada em OpenAPI, com tokens de serviço por organização, escopos, rate limit e versionamento (/v1). Contrato testado no CI.

## 5.1 API e integração com o ProContador

A API é a mesma que o site usa internamente: nenhuma regra de cálculo existe só na tela. O ProContador é o primeiro integrador e o caso de referência.

**Contrato**
- OpenAPI 3.1 como fonte da verdade, publicado em /v1/openapi.json, com documentação navegável e exemplos reais (incluindo o caso da Coca-Cola).
- SDK TypeScript gerado a partir do contrato e publicado como pacote privado no GitHub Packages, para o contador-saas usar com tipos.
- Versionamento por caminho (/v1). Mudança incompatível só em nova versão, com prazo de convivência e aviso de descontinuação nos cabeçalhos.
- Valores monetários e alíquotas trafegam como string decimal (por exemplo, "8.02"), nunca como número de ponto flutuante.

**Autenticação e isolamento**
- Token de serviço por organização, com escopos (simular, ler regras, importar, administrar), rotação sem parada e revogação imediata. Nunca login com e-mail e senha de usuário (é o problema que a auditoria do ProContador apontou na integração entre o Office e o SaaS).
- Organização = escritório no ProContador. Empresa cliente = CNPJ da carteira, identificada também por um `external_id` do ProContador, para não duplicar cadastro.
- Rate limit por token, com cabeçalhos de limite restante, e cotas por plano.

**Endpoints mínimos**
- `POST /v1/simulacoes`: simulação síncrona de um item ou de poucos itens, com a resposta trazendo valores por ano, cenário e a memória de cálculo completa.
- `POST /v1/simulacoes/lote`: lote assíncrono (mix de produtos ou arquivo de XMLs). Retorna um ID de job, e o resultado chega por webhook ou consulta.
- `GET /v1/jobs/{id}`: situação e resultado do lote.
- `GET /v1/regras`: alíquotas e regras vigentes numa data, com fonte e status, filtráveis por tributo, NCM/NBS, UF e regime.
- `GET /v1/classificacao`: sugestão de CST e cClassTrib a partir de NCM/NBS, com o grau de confiança e a regra usada.
- `POST /v1/empresas` e `PUT /v1/empresas/{external_id}`: cadastro idempotente das empresas da carteira (regime, UF, município, opção do Simples por semestre).
- `GET /v1/cenarios`: cenários disponíveis e suas premissas.

**Confiabilidade**
- Toda requisição de escrita aceita `Idempotency-Key`. Repetir a chamada nunca duplica empresa, job ou simulação.
- Toda resposta traz `request_id`, a versão do motor e a versão das tabelas de regras usadas, para que o resultado seja reproduzível depois.
- Erros no formato RFC 9457 (problem+json), com códigos estáveis e mensagens em português.
- Limites de tamanho de lote documentados. Acima deles, a API exige o modo assíncrono.

**Webhooks**
- Eventos: `simulacao.lote.concluida`, `simulacao.lote.falhou`, `regra.status_alterado` (por exemplo, quando o Senado fixar a CBS ou a MP for convertida) e `simulacao.desatualizada` (quando uma regra mudar e afetar simulações salvas).
- Assinatura HMAC com segredo por organização e carimbo de tempo contra replay, retentativa com backoff, registro de entregas e reenvio manual pelo painel.

**Do lado do ProContador (contador-saas)**
- Usar o SDK gerado, guardar o token de serviço no cofre de segredos do serviço e consumir os webhooks para atualizar as telas e fechar etapas da fila de trabalho.
- Enviar os XMLs já capturados pelo ProContador para `simulacoes/lote`, sem pedir upload de novo ao usuário.
- Mostrar a memória de cálculo que a API devolve, sem recalcular nada localmente.
- Teste de contrato nos dois repositórios: o CI do contador-saas falha se o uso do SDK não bater com o contrato publicado.

**Ambiente para integrar**
- Ambiente sandbox (staging) com tokens de teste e dados fictícios, para o ProContador desenvolver sem tocar em produção.
- Coleção de exemplos (arquivo .http ou Postman) mantida no repositório.

## 6. Modelo de dados (mínimo)

Organização, membro e papel (dono, administrador, analista, leitor, com o papel restringindo a escrita no servidor e não só na tela), empresa cliente (CNPJ, regime, UF, município, opção do Simples por semestre), produto ou serviço (NCM ou NBS, cClassTrib, CST, unidade), composição de custo, cenário (nome, premissas e data), regra tributária versionada (tributo, vigência, abrangência, valor, fonte, artigo, status), simulação com o resultado e a memória de cálculo congelados, importação e log de auditoria (quem fez o quê e quando).

## 7. Motor de cálculo

- Funções puras: entrada (operação, data do fato gerador, cenário) e saída (valores e memória de cálculo). Sem acesso a banco.
- Arredondamento igual ao das Notas Técnicas, por item e por tributo.
- Para cada elo da cadeia: custo líquido de aquisição (separando tributo recuperável e não recuperável), tributos da venda com a base correta de cada um e a ordem de inclusão nas bases, crédito apropriado, tributo líquido, preço e margem.
- O IS entra no custo de quem não é contribuinte dele e nunca vira crédito.
- Simples Nacional nas duas formas, mostrando a carga da empresa e o crédito que o comprador recebe.
- Margem configurável (sobre o preço com tributo ou sobre a receita líquida), sempre identificada.
- Cenários com nome e premissas: MP convertida, fatores reduzidos a 1,00, MP caducada, com e sem PEC do IPI, CBS do TCU ou do Senado, IBS final em níveis diferentes. Monte Carlo opcional.
- Saídas para decisão: preço que mantém a margem, preço psicológico (terminação configurável), margem com repasse parcial e efeito de uma elasticidade-preço informada pelo usuário.
- A memória de cálculo é a mesma em todas as saídas: tela, PDF, planilha e API.

## 8. Experiência e design

- Site público: página inicial com o caso do vídeo (cálculo simplificado x correto), páginas de produto, de preços e de fontes legais, blog e central de ajuda, termos de uso e política de privacidade.
- Aplicação: painel por organização e empresa, calculadora unitária, linha do tempo de 2026 a 2033, comparador de cenários, simulação em lote (importação de XML e planilha), tela de fontes com status de cada alíquota e exportação em PDF e Excel com a memória de cálculo.
- Design system próprio com identidade visual de [MARCA]: tipografia, cores, espaçamentos e componentes documentados. Nada de layout genérico de template.
- Mobile first, responsivo e instalável como PWA.
- Acessibilidade WCAG 2.2 AA: contraste, foco visível, navegação por teclado e rótulos.
- Formatação brasileira em tudo: R$, vírgula decimal, datas dd/mm/aaaa, CNPJ e NCM com máscara e validação.
- Todos os estados desenhados: vazio, carregando, erro, sem permissão, dado pendente ou estimado.
- Textos em português do Brasil, tom profissional e direto, sem travessão.
- Performance: Lighthouse 90 ou mais em desempenho, acessibilidade, boas práticas e SEO nas páginas públicas. Core Web Vitals dentro do recomendado.
- SEO: metadados, sitemap, dados estruturados e páginas públicas renderizadas no servidor.

## 9. Segurança e LGPD

- Segredos só nas variáveis do Railway e no GitHub Secrets, nunca no repositório. Varredura de segredos no CI.
- Cabeçalhos de segurança: CSP, HSTS, X-Frame-Options e Referrer-Policy.
- Sessão com expiração e revogação, rate limit em login, cadastro e API, bloqueio por tentativas sem permitir que alguém tranque a conta de outro usuário.
- Validação de toda entrada no servidor (Zod), proteção contra IDOR em todas as rotas e RLS como segunda barreira.
- Importação de arquivos com limite de tamanho, validação do tipo e processamento isolado no worker.
- LGPD: base legal e finalidade documentadas, consentimento de cookies, exportação e exclusão de dados da organização, prazo de retenção e registro de acesso a dados.
- Dependências sem vulnerabilidade alta (npm audit e Dependabot) e CodeQL ativo.

## 10. Engenharia, CI/CD e operação

- GitHub: branch `main` protegida, merge só via PR com CI verde, Conventional Commits, template de PR, CODEOWNERS, Dependabot, CodeQL e changelog gerado.
- CI (GitHub Actions) como gate de deploy: typecheck (o build falha com qualquer erro de tipo), lint, testes unitários e de propriedade, testes de integração com Postgres real, testes de RLS, contrato OpenAPI, E2E com Playwright, Lighthouse CI nas páginas públicas, auditoria de dependências e build.
- Fluxo: PR → ambiente temporário no Railway → merge → staging (migrations aplicadas primeiro) → smoke test → produção com aprovação.
- Observabilidade: Sentry no web e no worker, logs estruturados com ID de requisição, monitor externo de disponibilidade, alerta de job com falha ou atrasado (meta: menos de 15 minutos até alguém saber) e painel com métricas de uso.
- Backup: backup diário fora do Supabase, teste de restauração documentado e repetido a cada trimestre.
- Documentação no repositório: README de setup em menos de 15 minutos, decisões de arquitetura (ADRs), runbook de incidentes e guia de atualização das tabelas de alíquotas.

## 11. Atualização das regras tributárias

- As tabelas de alíquotas e regras são dados versionados, alterados por PR com revisão, nunca editados direto em produção.
- Cada mudança registra a norma, a vigência e o status, e roda novamente toda a suíte de validação.
- Quando uma regra muda de status (por exemplo, a resolução do Senado sobre a CBS ou a conversão da MP), as simulações afetadas são sinalizadas para o usuário.
- Prever um job que verifique novidades nas fontes oficiais e abra uma tarefa para revisão humana. Ele nunca aplica a mudança sozinho.

## 12. Validação e critérios de aceite de cada onda

1. **Oráculo oficial:** para cada caso de teste, comparar CBS, IBS e IS com a Calculadora de Tributos da Receita Federal (piloto-cbs.tributos.gov.br, via API). Diferença acima de R$ 0,01 por item reprova o teste até ser explicada.
2. **Casos de referência:** os exemplos numéricos da MP, da exposição de motivos, do relatório do TCU (TC 006.529/2026-7) e das cartilhas oficiais viram testes de regressão.
3. **Testes de propriedade:** o preço nunca cai quando uma alíquota sobe, o crédito nunca é maior que o tributo destacado, o IS nunca vira crédito e a soma dos componentes sempre fecha com o preço.
4. **Caso do vídeo:** reproduzir R$ 8,02 e R$ 11,51 no modo "cálculo simplificado" e explicar a diferença em cada ano.
5. **Dados reais:** reconstruir o custo de uma amostra de produtos a partir de XMLs reais (via ProContador) e conferir a classificação com as notas de 2026, que já trazem os campos de teste de CBS e IBS.
6. **Conferência humana:** amostra de 20 produtos ou serviços por onda, com a memória de cálculo completa, aprovada pelo contador responsável ([NOME]).
7. **Integração:** o mesmo caso de teste dá resultado idêntico, centavo a centavo, pelo site, pela API, dentro do ProContador e no app Android, e o teste de contrato passa nos dois repositórios.
8. **Qualidade técnica:** CI verde, cobertura de 100% no motor fiscal e de pelo menos 80% no restante, nenhuma vulnerabilidade alta, Lighthouse dentro da meta e testes de isolamento entre organizações passando.
9. **Pós-vigência:** relatório que compara a margem prevista com a margem real dos XMLs a partir de fevereiro de 2027.

## 13. Como trabalhar comigo

- **Fase 0, antes de qualquer código:**
  - Leia as fontes primárias da seção 3.
  - Entregue a matriz de regras (uma linha por tributo, vigência, NCM/NBS, regime, UF, elo e destino, com base de cálculo, forma de cálculo, crédito, artigo e status).
  - Proponha a arquitetura em ADRs e o design system em rascunho.
  - Liste o que ficou ambíguo.
  - Pare e espere minha aprovação.
- **Depois, nesta ordem, cada fase em PRs pequenos e revisáveis:**
  1. Fundação: monorepo, CI, Supabase, Railway, auth, multi-tenant e observabilidade.
  2. Motor e regras da Onda 1, com testes.
  3. API completa da seção 5.1, com SDK, sandbox e webhooks.
  4. Integração no contador-saas (PR separado naquele repositório, com teste de contrato).
  5. Telas do site, consumindo a mesma API, e, em paralelo, o app Android interno da seção 15.
  6. Validação da Onda 1, pelo site e pelo ProContador.
  7. Lançamento.
  8. Ondas seguintes.
- **Regras para os PRs e as decisões:**
  - Cada PR explica o que mudou, como foi testado e o que ficou pendente.
  - Nunca invente alíquota, base ou data. Sem fonte, registre como PENDENTE e me avise.
  - Quando duas fontes divergirem, mostre as duas e pergunte.
  - Mudanças de schema vão primeiro para staging, e nada é aplicado em produção sem meu aceite.
  - Se este trabalho conflitar com a adequação da NFS-e nacional antes de 2027 ou com o ProContador, me avise e proponha a prioridade.

## 14. Fora de escopo nesta versão

- Emissão de nota fiscal: o site simula e quem emite é o ProContador.
- Cobrança de assinatura: deixar o modelo de planos preparado, com integração de pagamento (Pix e cartão) numa fase posterior.

## 15. App Android interno: calculadora de custo e preço

Um app simples para uso interno da minha empresa. Não será vendido, não vai para a Play Store e não tem login. Ele calcula o preço de venda a partir do custo e da margem informada, com os tributos corretos, inclusive sem internet.

**Regra principal:** o app não tem nenhuma fórmula própria. Ele usa os pacotes `motor-fiscal` e `regras` do monorepo, então o resultado é idêntico, centavo a centavo, ao do site, da API e do ProContador.

**Stack e local no repositório**
- `apps/mobile`, com Expo (React Native) e TypeScript strict, importando os pacotes do monorepo e os tokens do design system.
- Distribuição por APK assinado, instalado diretamente nos celulares da empresa. A chave de assinatura fica fora do repositório, nos segredos do GitHub e do EAS.
- Build pelo EAS Build com perfil interno. Cada versão é publicada como release privada no GitHub, com changelog.
- Atualizações de código JavaScript (motor e telas) por EAS Update, sem reinstalar o app. Mudanças nativas exigem um APK novo.

**Funcionamento sem internet**
- O app já sai com uma cópia das tabelas de regras embutida no build.
- Ao abrir com internet, ele consulta a versão das tabelas num endpoint público e somente de leitura (`GET /v1/regras/versao` e `GET /v1/regras/pacote`). São dados de lei, sem dado de cliente, então não exigem token, mas têm rate limit.
- O pacote de regras é assinado (Ed25519) e o app verifica a assinatura antes de usar, para que ninguém consiga injetar alíquotas falsas.
- A tela sempre mostra a data e a versão da tabela em uso. Se a tabela tiver mais de 30 dias ou se houver uma regra PENDENTE que já mudou de status, o app avisa.

**Tela de cálculo**
- Entrada:
  - Descrição do produto e NCM (opcional, mas necessário para Imposto Seletivo, reduções e monofásicos).
  - Custo de compra e como ele veio: com tributo recuperável destacado ou sem.
  - Regime da empresa: Simples no DAS, Simples no regime regular, Presumido ou Real.
  - UF.
  - Despesas variáveis (%), margem desejada (%) e base da margem (sobre o preço ou sobre a receita líquida).
  - Ano ou cenário.
- Resultado:
  - Preço de venda e preço psicológico sugerido.
  - Tributos da venda e crédito da compra.
  - Margem efetiva.
  - Linha do tempo resumida de 2026 a 2033.
  - Memória de cálculo expansível.
- Modo comparativo: o "cálculo simplificado" (o do vídeo) ao lado do correto.
- Compartilhar o resultado como imagem ou PDF, inclusive pelo WhatsApp.

**Simplicidade e privacidade**
- Padrões da empresa (regime, UF, despesas, base da margem) configurados uma vez e salvos no aparelho.
- Histórico e produtos favoritos salvos só no aparelho.
- Sem login, sem analytics e sem coleta de dados: nada digitado sai do celular.
- Interface com poucos campos, números grandes, formatação brasileira e uso com uma mão.

**Validação**
- O CI do app roda a mesma suíte de casos de referência do motor (incluindo o caso da Coca-Cola), usando a tabela embutida, e exige o mesmo resultado do site e da API.
- Testes E2E básicos com Maestro: abrir sem internet, calcular, atualizar a tabela com internet e rejeitar um pacote de regras com assinatura inválida.

**Quando construir**
- Começa depois que o motor e a API da Onda 1 estiverem estáveis (fases 2 e 3 da seção 13).
- A partir daí, pode correr em paralelo com a integração no ProContador e com as telas do site.

**Fora de escopo do app**
- Play Store, iOS, login, sincronização em nuvem e simulação em lote (isso fica no site e no ProContador).
