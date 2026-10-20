import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../../core/api-client';
import {
  BandiResponse,
  BandoDetail,
  BandoMetadata,
  ReferenteBandiResponse,
} from '../../core/models/api.models';

/** Intervallo minimo fra due aggiornamenti automatici dei concorsi del segretario. */
const SECRETARY_SYNC_INTERVAL_MS = 10 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class BandiService {
  private readonly api = inject(ApiClient);
  private lastSecretarySync = 0;

  /** Home segretario e "I miei concorsi" aggiornano da Selezioni Online all'apertura, non a ogni ritorno sulla pagina. */
  secretarySyncDue(): boolean {
    return Date.now() - this.lastSecretarySync > SECRETARY_SYNC_INTERVAL_MS;
  }

  list(mode = 'segretario') {
    return this.api.get<BandiResponse>(`/bandi?mode=${encodeURIComponent(mode)}`);
  }

  sync(mode = 'segretario') {
    if (mode === 'segretario') this.lastSecretarySync = Date.now();
    return this.api.post<BandiResponse>(`/bandi/sync?mode=${encodeURIComponent(mode)}`);
  }

  syncReferente() {
    return this.api.post<ReferenteBandiResponse>('/referenti/bandi/sync');
  }

  listReferente() {
    return this.api.get<ReferenteBandiResponse>('/referenti/bandi');
  }

  detail(commissionId: string, mode = 'segretario') {
    return this.api.get<BandoDetail>(
      `/bandi/${commissionId}?mode=${encodeURIComponent(mode)}`,
    );
  }

  syncMetadata(commissionId: string) {
    return this.api.post<BandoMetadata>(`/bandi/${commissionId}/sync-meta`);
  }
}
