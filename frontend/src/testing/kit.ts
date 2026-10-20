import { Provider } from '@angular/core';
import { IT_ASSET_BASE_PATH } from 'design-angular-kit';

/**
 * Configurazione minima del kit per gli spec dei componenti che usano it-*.
 * provideDesignAngularKit() caricherebbe anche font e traduzioni via HTTP.
 */
export function provideKitForTests(): Provider[] {
  return [{ provide: IT_ASSET_BASE_PATH, useValue: './bootstrap-italia' }];
}
