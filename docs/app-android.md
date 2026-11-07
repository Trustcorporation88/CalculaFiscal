# App Android: Calculadora Fiscal

App interno e simplificado: você digita o **custo** e a **margem**, escolhe o ano (2026 a 2033) e vê o **preço de venda** com os **impostos destacados**. Funciona sem internet. Não tem login, analytics nem coleta de dados, e nada do que é digitado sai do celular. A única conexão do app é a consulta às tabelas de alíquotas no site, que não envia nenhum dado.

## Como calcula

O app não tem fórmula própria: usa os pacotes `motor-fiscal` e `regras` do monorepo, os mesmos do site e da API. As tabelas de regras vão embutidas no APK e podem ser atualizadas pelo site (veja abaixo). O rodapé da linha do tempo mostra a versão delas e a do motor.

- **Custo:** é o custo líquido do produto, já sem o imposto que a empresa recupera na compra.
  - No regime regular, a CBS e o IBS da compra viram crédito.
  - No Simples (DAS), o custo informado já inclui o que veio destacado na nota.
- **Configuração da empresa:** é feita uma vez e guardada no aparelho. Inclui o regime (Simples, Presumido ou Real), o DAS ou o ICMS e o PIS/Cofins da venda, as despesas variáveis, a base da margem, o tratamento de CBS/IBS (integral, cesta básica ou redução de 60%) e o cenário.
- **Resultado do ano:**
  - o preço de venda (o que o cliente paga) e o preço psicológico sugerido;
  - a barra de composição (custo, cada imposto, despesas e lucro);
  - o total de impostos no preço e as duas margens;
  - o status das premissas do ano.
- **Imposto Seletivo (NCM opcional):** com o NCM de bebida açucarada (2202.10.00, 2,6%), cerveja (22.03, 4,2%) ou fumo, o IS entra a partir de fevereiro de 2027. Ele é cobrado do fabricante ou importador sobre o preço líquido dele e chega embutido no custo da compra, sem crédito. O app mostra o IS em linha própria. De 2028 em diante ainda não há lei: repete 2027 como estimativa. No cenário "MP caducada" não há IS.
- **Compartilhar:** o botão verde tira uma foto do cartão do resultado (com custo, margem, regime e NCM) e abre o menu do Android: WhatsApp, e-mail e outros.

Ficam de fora desta versão simplificada: o Simples no regime regular, o ICMS-ST, o IS de quem fabrica (o app considera quem revende) e a nota completa. Para esses casos, use a calculadora do site.

## Tabelas atualizadas sem reinstalar

Ao abrir, o app pergunta ao site qual é a versão das tabelas (`GET /v1/regras/versao`). Se for outra, baixa o pacote (`GET /v1/regras/pacote`) e só passa a usá-lo depois de três conferências:

1. **Assinatura Ed25519:** o pacote é assinado com uma chave privada que fica só no computador de quem publica, nunca no servidor. A chave pública vai embutida no app. Quem invadisse o servidor não conseguiria publicar alíquotas que o app aceitasse.
2. **Validação:** as regras passam no mesmo schema do site e o motor resolve 2026 a 2033 com elas.
3. **Sem volta:** um pacote mais antigo que o que está no celular é recusado.

Sem internet, ou se algo falhar, o app segue com as tabelas que já tem. O cartão "Tabelas de alíquotas", no fim da tela, mostra a versão, a data de publicação e a última conferência, e tem o botão **Procurar atualização**. Depois de 30 dias sem conseguir conferir, o app avisa no topo da tela.

As rotas são públicas, sem token, com limite de 30 requisições por minuto por endereço.

### Publicar tabelas novas

Depois de mudar qualquer arquivo em `packages/regras/dados/`, assine o pacote **neste computador** e versione o resultado:

```bash
pnpm --filter @calculafiscal/regras assinar
```

- O comando grava `packages/regras/src/pacote-assinado.ts` e `chave-publica.ts`. Os dois entram no commit.
- O teste `assinatura.test.ts` falha no CI enquanto o pacote não for assinado de novo.
- O app recebe as tabelas novas quando a versão do site com esse commit for publicada.
- A chave privada fica em `%USERPROFILE%\.calculafiscal
egras\ed25519-privada.pem` (ou na variável `CF_REGRAS_CHAVE_PRIVADA`). Guarde uma cópia em local seguro.
  - Sem ela, os apps instalados não aceitam tabelas novas até receberem uma versão com outra chave pública.
  - Se ela vazar, gere outra (`node scripts/assinar-pacote.mjs --nova-chave`, depois de apagar a antiga) e distribua um APK novo.

## Instalar no celular

1. Copie o arquivo `CalculadoraFiscal-<versão>.apk` para o celular (WhatsApp, Google Drive, cabo USB ou e-mail).
2. No celular, toque no arquivo. Na primeira vez, o Android pede para permitir a instalação desse aplicativo de origem (o app que abriu o arquivo, por exemplo o Arquivos ou o Drive). Permita só para ele.
3. Toque em **Instalar**. Na abertura, preencha a configuração da empresa.

O APK é assinado com a chave da empresa. Atualizações precisam ser assinadas com a mesma chave para instalar por cima sem perder a configuração.

## Gerar uma nova versão

Pré-requisitos neste computador: JDK 17 e o Android SDK em `%LOCALAPPDATA%\Android\Sdk`.

A chave de assinatura e a senha ficam **fora do repositório**, em `%USERPROFILE%\.calculafiscal\android\`:

- `calculadora-fiscal.keystore`
- `assinatura.properties`

Guarde uma cópia em lugar seguro. Sem ela, não é possível atualizar o app instalado.

> **Caminho sem espaços.** O build do Android quebra quando o projeto está numa pasta com espaço no nome (como `C:\Calculadora Fiscal`): o compilador Hermes é chamado sem aspas. Compile a partir de um worktree num caminho sem espaços:
>
> ```bash
> git worktree add --detach C:/cf-apk HEAD
> cd C:/cf-apk && pnpm install --frozen-lockfile
> pnpm turbo run build --filter=@calculafiscal/regras --filter=@calculafiscal/motor-fiscal
> ```
>
> e rode os passos abaixo dentro de `C:\cf-apk\apps\mobile`.

1. Suba `expo.version` e `expo.android.versionCode` em `apps/mobile/app.json`.
2. Gere a pasta nativa, que não é versionada: `cd apps/mobile` e `npx expo prebuild -p android --clean --no-install`.
3. Compile com as propriedades de assinatura (o plugin `plugins/assinatura-release.js` as lê do Gradle):

```powershell
$p = @{}; Get-Content "$HOME\.calculafiscal\android\assinatura.properties" | ? { $_ -match '^[A-Z_]+=' } | % { $k,$v = $_ -split '=',2; $p[$k] = $v }
foreach ($k in $p.Keys) { Set-Item "Env:ORG_GRADLE_PROJECT_$k" $p[$k] }
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"; $env:NODE_ENV = 'production'
cd apps\mobile\android; .\gradlew.bat assembleRelease
```

4. O APK sai em `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

Pelo prompt original, ainda falta publicar cada versão como release privada no GitHub.
