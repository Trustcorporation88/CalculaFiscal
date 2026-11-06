# API /v1

A API faz o mesmo cálculo da tela, porque usa as mesmas funções. O contrato é o documento OpenAPI 3.1 em `GET /v1/openapi.json`, gerado dos schemas Zod em `apps/web/src/lib/api/contrato.ts`. Os testes de contrato conferem que as respostas reais batem com ele.

| Ambiente          | Endereço                                | Token         |
| ----------------- | --------------------------------------- | ------------- |
| Sandbox (staging) | https://web-staging-50d4.up.railway.app | `cf_test_...` |
| Produção          | a definir                               | `cf_live_...` |

## Autenticação

1. No site, entre como dono ou administrador da organização, com verificação em duas etapas, e abra **Painel > API e tokens de integração**.
2. Crie um token com os escopos necessários: `simular` e/ou `regras:ler`. O texto completo aparece **uma única vez**. Guarde-o no cofre de segredos do sistema integrador.
3. Envie o token em toda requisição: `Authorization: Bearer cf_test_...`.

A revogação vale na hora: a próxima requisição com o token já é recusada. Para trocar um token sem parar a integração, crie o novo, troque no integrador e só então revogue o antigo.

## Rotas

| Método e caminho       | Escopo     | O que faz                                                                                                                        |
| ---------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/simulacoes`  | simular    | Simulação síncrona de até 20 itens: linha do tempo de 2026 a 2033, preço psicológico, cenários, comparativo e memória de cálculo |
| `GET /v1/regras`       | regras:ler | Regras vigentes numa data, com fonte e status. Filtros: `data`, `tributo`, `ncm`, `cClassTrib`                                   |
| `GET /v1/cenarios`     | regras:ler | Cenários e premissas                                                                                                             |
| `GET /v1/openapi.json` | sem token  | O contrato                                                                                                                       |

## Convenções

- **Números:** valores monetários e alíquotas vão como texto decimal com ponto: `"8.02"` e `"0.18"` (18%). Nunca como número de ponto flutuante.
- **Reprodutibilidade:** toda resposta traz `request_id`, `versao_motor` e `versao_regras`, para reproduzir o resultado depois. O cabeçalho `X-Request-Id` repete o identificador.
- **Itens com erro:** um item com combinação impossível (por exemplo, nota menor que o frete) volta com `situacao: "erro"` e um `problema`. Os outros itens são calculados normalmente.
- **Dado pendente:** o que depende de dado ainda não publicado (por exemplo, a partilha do DAS) volta como `DADO_PENDENTE`, com o motivo. A API nunca devolve um número inventado.

## Erros

Os erros seguem a RFC 9457 (`application/problem+json`), com `codigo` estável e mensagem em português:

| Código                | HTTP | Quando                                                              |
| --------------------- | ---- | ------------------------------------------------------------------- |
| `token-ausente`       | 401  | Sem `Authorization: Bearer`                                         |
| `token-invalido`      | 401  | Token inexistente, revogado ou expirado                             |
| `escopo-insuficiente` | 403  | O token não tem o escopo da rota                                    |
| `corpo-invalido`      | 400  | JSON malformado ou fora do contrato; `erros` lista campo e mensagem |
| `corpo-grande`        | 413  | Corpo acima de 256 KB                                               |
| `tipo-de-conteudo`    | 415  | Corpo sem `Content-Type: application/json`                          |
| `entrada-impossivel`  | 422  | Por item, dentro da resposta 200                                    |
| `limite-excedido`     | 429  | Mais de 60 requisições no minuto; respeite o `Retry-After`          |
| `erro-interno`        | 500  | Registrado no Sentry; informe o `request_id`                        |

## Limites

- **Requisições:** 60 por minuto por token. Os cabeçalhos `RateLimit-Limit`, `RateLimit-Remaining` e `RateLimit-Reset` (em segundos) informam o uso.
- **Itens:** até 20 por simulação síncrona. O lote assíncrono, com webhook, vem numa próxima entrega.

## Ainda não disponível

`POST /v1/simulacoes/lote`, `GET /v1/jobs/{id}`, webhooks, `POST/PUT /v1/empresas`, `GET /v1/classificacao` (depende das listas de NCM dos anexos da LC 214), `Idempotency-Key` persistida e o SDK TypeScript publicado.

Exemplos prontos para o VS Code (extensão REST Client) ou JetBrains estão em [exemplos.http](exemplos.http).
