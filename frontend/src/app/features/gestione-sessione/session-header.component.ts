import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionSummary } from '../../core/models/api.models';
import { AppProfile } from '../../core/profile.service';
import { sessionStateLabel } from '../../shared/session-states';
import { competitionLabel } from '../../shared/competition-label';
import { sessionWhen } from '../../shared/session-date';

const ROLE_LABELS: Record<AppProfile, string> = {
  segretario: 'Segretario', referente: 'Referente', sede: 'Informatico in sede', esperto: 'Esperto remoto', admin: 'Amministratore',
};

/** Testata a tutta larghezza della pagina sessione (prototipo sessione-*.html, `app-session-head`). */
@Component({
  selector: 'app-session-header',
  imports: [RouterLink],
  template: `
    <section class="app-session-head" aria-label="Sessione">
      <div class="container py-3">
        <nav class="breadcrumb-container" aria-label="Percorso di navigazione">
          <ol class="breadcrumb p-0 mb-2">
            @if (technical()) {
              <li class="breadcrumb-item"><a routerLink="/le-mie-sessioni" [queryParams]="{ mode: profile() === 'sede' ? 'sede' : 'expert' }">Le mie sessioni</a><span class="separator">/</span></li>
              <li class="breadcrumb-item">{{ competition() }}<span class="separator">/</span></li>
            } @else {
              <li class="breadcrumb-item">
                @if (profile() === 'admin') { <a routerLink="/bandi" [queryParams]="{ mode: 'admin' }">Tutti i bandi</a> }
                @else { <a routerLink="/bandi" [queryParams]="{ mode: 'segretario' }">I miei concorsi</a> }
                <span class="separator">/</span>
              </li>
              <li class="breadcrumb-item"><a [routerLink]="['/bandi', session().commission_id, 'sessioni']" [queryParams]="{ mode: profile() }">{{ competition() }}</a><span class="separator">/</span></li>
            }
            <li class="breadcrumb-item active" aria-current="page">Sessione</li>
          </ol>
        </nav>
        <div class="app-minw">
          <h1 class="h2 mb-1">{{ session().name }}</h1>
          <p class="mb-2 text-secondary">{{ meta() }}</p>
          <p class="mb-0 d-flex flex-wrap gap-2">
            <span class="app-state-pill">Stato: <strong>{{ sessionStateLabel(state()) }}</strong></span>
            @if (profile() !== 'segretario') { <span class="app-state-pill app-state-pill--role">Stai lavorando come <strong>{{ roleLabel() }}</strong></span> }
          </p>
        </div>
        @if (adminView()) {
          <div class="alert alert-warning mt-3 mb-0" role="status"><strong>Vista di supporto amministratore.</strong> Non risulti assegnato a questa sessione con il profilo operativo.</div>
        }
      </div>
    </section>
  `,
})
export class SessionHeaderComponent {
  readonly session = input.required<SessionSummary>();
  readonly state = input('');
  readonly profile = input<AppProfile>('segretario');
  readonly adminView = input(false);
  readonly sessionStateLabel = sessionStateLabel;
  readonly technical = computed(() => this.profile() === 'sede' || this.profile() === 'esperto');
  readonly competition = computed(() => competitionLabel(this.session().bando_title, this.session().commission_id));
  readonly roleLabel = computed(() => ROLE_LABELS[this.profile()]);
  readonly meta = computed(() => [sessionWhen(this.session().date, this.session().time), this.session().location, this.competition()].filter(Boolean).join(' · '));
}
