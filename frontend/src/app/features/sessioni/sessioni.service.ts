import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../../core/api-client';
import { SessionsResponse } from '../../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class SessioniService {
  private readonly api = inject(ApiClient);

  list(commissionId: string, mode = 'segretario') {
    return this.api.get<SessionsResponse>(
      `/bandi/${encodeURIComponent(commissionId)}/sessioni?mode=${encodeURIComponent(mode)}`,
    );
  }

  sync(commissionId: string, mode = 'segretario') {
    return this.api.post<{ success: boolean; inserted: number }>(
      `/bandi/${encodeURIComponent(commissionId)}/sessioni/sync?mode=${encodeURIComponent(mode)}`,
    );
  }
}
