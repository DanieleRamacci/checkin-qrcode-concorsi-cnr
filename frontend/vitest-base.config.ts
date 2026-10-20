import { defineConfig } from 'vitest/config';

// design-angular-kit importa bootstrap-italia con import nominali; il pacchetto
// dichiara come main il bundle CommonJS, quindi Node rifiuta l'import. Facendo
// passare kit e bootstrap-italia da Vite si usa il bundle ESM (campo "module").
export default defineConfig({
  test: {
    server: { deps: { inline: ['design-angular-kit', 'bootstrap-italia'] } },
  },
});
