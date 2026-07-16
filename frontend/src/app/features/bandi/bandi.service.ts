import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../../core/api-client';
import {
  BandiResponse,
  BandoDetail,
  BandoMetadata,
  ReferenteBandiResponse,
} from '../../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class BandiService {
  private readonly api = inject(ApiClient);

  list(mode = 'segretario') {
    return this.api.get<BandiResponse>(`/bandi?mode=${encodeURIComponent(mode)}`);
  }

  sync(mode = 'segretario') {
    return this.api.post<BandiResponse>(`/bandi/sync?mode=${encodeURIComponent(mode)}`);
  }

  syncReferente() {
    return this.api.post<ReferenteBandiResponse>('/referenti/bandi/sync');
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
