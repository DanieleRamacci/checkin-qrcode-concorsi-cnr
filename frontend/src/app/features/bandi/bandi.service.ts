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

  list() {
    return this.api.get<BandiResponse>('/bandi');
  }

  sync() {
    return this.api.post<BandiResponse>('/bandi/sync');
  }

  syncReferente() {
    return this.api.post<ReferenteBandiResponse>('/referenti/bandi/sync');
  }

  detail(commissionId: string) {
    return this.api.get<BandoDetail>(`/bandi/${commissionId}`);
  }

  syncMetadata(commissionId: string) {
    return this.api.post<BandoMetadata>(`/bandi/${commissionId}/sync-meta`);
  }
}
