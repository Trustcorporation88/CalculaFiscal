// Assinatura do APK de release sem editar à mão a pasta android/ (gerada pelo prebuild).
// A chave fica fora do repositório; o build recebe o caminho e as senhas como propriedades
// do Gradle (CF_STORE_FILE, CF_STORE_PASSWORD, CF_KEY_ALIAS, CF_KEY_PASSWORD), por exemplo via
// variáveis ORG_GRADLE_PROJECT_*. Sem elas, o release usa a chave de depuração, como o padrão.
const { withAppBuildGradle } = require('expo/config-plugins');

const BLOCO = `
        release {
            if (project.hasProperty('CF_STORE_FILE')) {
                storeFile file(CF_STORE_FILE)
                storePassword CF_STORE_PASSWORD
                keyAlias CF_KEY_ALIAS
                keyPassword CF_KEY_PASSWORD
            }
        }`;

module.exports = function assinaturaRelease(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (!g.includes('CF_STORE_FILE')) {
      g = g.replace(/signingConfigs\s*\{/, (m) => `${m}${BLOCO}`);
      g = g.replace(
        /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig project.hasProperty('CF_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
      );
    }
    cfg.modResults.contents = g;
    return cfg;
  });
};
