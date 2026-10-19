import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionSummary } from '../../core/models/api.models';
import { AppProfile } from '../../core/profile.service';
import { sessionStateLabel } from '../../shared/session-states';

@Component({
  selector: 'app-session-header',
  imports: [RouterLink],
  template: `
    <section class="app-session-head mb-4">
      <nav aria-label="Percorso"><ol class="breadcrumb mb-2">
        <li class="breadcrumb-item"><a routerLink="/bandi">I miei concorsi</a></li>
        <li class="breadcrumb-item"><a [routerLink]="['/bandi', session().commission_id, 'sessioni']">Concorso {{ session().commission_id }}</a></li>
        <li class="breadcrumb-item active" aria-current="page">Sessione</li>
      </ol></nav>
      <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
        <div><p class="app-eyebrow mb-1">{{ session().bando_title || session().commission_id }}</p>
          <h1 class="h2 mb-1">{{ session().name }}</h1>
          <p class="mb-0 text-muted">{{ session().date }} · {{ session().time }} · {{ session().location }}</p>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <span class="app-state-pill">Stato: {{ sessionStateLabel(state()) }}</span>
          @if (profile() !== 'segretario') { <span class="app-state-pill app-state-pill--role">Stai lavorando come {{ profileLabel() }}</span> }
        </div>
      </div>
      @if (adminView()) { <div class="alert alert-warning mt-3 mb-0"><strong>Vista di supporto amministratore.</strong> Stai consultando una sessione per cui non risulti assegnato al profilo operativo.</div> }
    </section>
  `,
})
export class SessionHeaderComponent {
  readonly session = input.required<SessionSummary>();
  readonly state = input('');
  readonly profile = input<AppProfile>('segretario');
  readonly adminView = input(false);
  readonly sessionStateLabel = sessionStateLabel;
  profileLabel(): string { return ({ segretario: 'Segretario', referente: 'Referente', sede: 'Informatico in sede', esperto: 'Esperto remoto', admin: 'Amministratore' } as const)[this.profile()]; }
}
