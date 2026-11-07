# App Android: Calculadora Fiscal

App interno e simplificado: você digita o **custo** e a **margem**, escolhe o ano (2026 a 2033) e vê o **preço de venda** com os **impostos destacados**. Funciona sem internet. Não tem login, analytics nem coleta de dados, e nada do que é digitado sai do celular.

## Como calcula

O app não tem fórmula própria: usa os pacotes `motor-fiscal` e `regras` do monorepo, os mesmos do site e da API. As tabelas de regras vão embutidas no APK, e o rodapé da linha do tempo mostra a versão delas e a do motor.

- **Custo:** é o custo líquido do produto, já sem o imposto que a empresa recupera na compra.
  - No regime regular, a CBS e o IBS da compra viram crédito.
  - No Simples (DAS), o custo informado já inclui o que veio destacado na nota.
- **Configuração da empresa:** é feita uma vez e guardada no aparelho. Inclui o regime (Simples, Presumido ou Real), o DAS ou o ICMS e o PIS/Cofins da venda, as despesas variáveis, a base da margem, o tratamento de CBS/IBS (integral, cesta básica ou redução de 60%) e o cenário.
- **Resultado do ano:**
  - o preço de venda (o que o cliente paga) e o preço psicológico sugerido;
  - a barra de composição (custo, cada imposto, despesas e lucro);
  - o total de impostos no preço e as duas margens;
  - o status das premissas do ano.

Ficam de fora desta versão simplificada: o Imposto Seletivo (que depende do NCM), o Simples no regime regular, o ICMS-ST e a nota completa. Para esses casos, use a calculadora do site.

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

Pelo prompt original, o próximo passo é publicar cada versão como release privada no GitHub e atualizar as tabelas sem reinstalar (pacote de regras assinado, `GET /v1/regras/pacote`).
