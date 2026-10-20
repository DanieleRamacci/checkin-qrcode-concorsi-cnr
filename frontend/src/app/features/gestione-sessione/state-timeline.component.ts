import { Component, computed, input } from '@angular/core';
import { ItIconComponent } from 'design-angular-kit';
import { WorkflowState } from '../../core/models/api.models';
import { roleLabel, sessionStateInfo } from '../../shared/session-states';

const STATES = ['iniziale', 'configurata', 'candidati_scaricati', 'dispositivi_connessi', 'checkin_avviato', 'checkin_concluso', 'liste_generate', 'liste_inviate', 'lista_presenti_aggiornata_su_moodle', 'avvia_esame', 'esame_in_corso', 'esame_concluso'];
const PHASES = ['Preparazione', 'Check-in', 'Liste', 'Esame'];
const BY: Record<string, string> = {
  Segretario: 'dal segretario', 'Informatico in sede': 'dall’informatico in sede',
  'Esperto remoto': 'dall’esperto remoto', Amministratore: 'dall’amministratore',
};

/**
 * Timeline della sessione (prototipo, `app-tl-card`): 12 stati in 4 fasi, con
 * l'ora di ogni passaggio. Il ruolo di chi l'ha eseguito è sempre letto dai
 * lettori di schermo e si vede quando non è quello atteso per la fase (FR-031).
 * La fase 4 è "a cura dell'esperto remoto" tranne che per l'esperto stesso.
 */
@Component({
  selector: 'app-state-timeline',
  imports: [ItIconComponent],
  template: `
    <section class="card card-bg no-after app-tl-card" aria-labelledby="tl-title">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-baseline gap-2 mb-1">
          <h2 id="tl-title" class="h5 mb-0">Timeline della sessione</h2>
          @if (position()) { <span class="small text-secondary text-nowrap">{{ position() }} di {{ total }}</span> }
        </div>
        <p class="small text-secondary mb-3">Si aggiorna ogni 5 secondi.</p>
        @for (phase of phases(); track phase.number) {
          <div class="app-tl-phase" [class.is-other]="phase.number === 4 && !faseEsameMia()">
            <p class="app-tl-phase-name">{{ phase.number }} · {{ phase.label }}@if (phase.number === 4 && !faseEsameMia()) { · a cura dell’esperto remoto }</p>
            <ol class="app-tl">
              @for (step of phase.steps; track step.state) {
                <li [class.is-done]="step.done" [class.is-current]="step.current" [attr.aria-current]="step.current ? 'step' : null">
                  <span class="app-tl-mark">@if (step.done) { <it-icon name="check" size="xs" color="white" /> }</span>
                  <span class="app-tl-text">{{ step.label }}
                    @if (step.done && step.role) {
                      @if (step.unexpected) { <span class="d-block small fw-normal text-secondary">{{ by(step.role) }}</span> }
                      @else { <span class="visually-hidden">, {{ step.role }}</span> }
                    }
                  </span>
                  @if (step.current) { <span class="app-tl-now">stato attuale</span> }
                  @else if (step.done) {
                    @if (step.time) { <span class="app-tl-time">{{ step.time }}</span> }
                    <span class="visually-hidden"> completato</span>
                  }
                </li>
              }
            </ol>
          </div>
        }
      </div>
    </section>
  `,
})
export class StateTimelineComponent {
  readonly currentState = input('');
  readonly history = input<WorkflowState['history']>([]);
  readonly faseEsameMia = input(false);
  readonly total = STATES.length;
  by(role: string): string { return BY[role] ?? role; }
  readonly position = computed(() => STATES.indexOf(this.currentState()) + 1);
  readonly phases = computed(() => {
    const currentIndex = STATES.indexOf(this.currentState());
    return PHASES.map((label, index) => ({
      number: index + 1,
      label,
      steps: STATES.filter((state) => sessionStateInfo(state).phase === index + 1).map((state) => {
        const event = this.history()?.find((item) => item.state === state);
        return {
          state,
          label: sessionStateInfo(state).label,
          done: STATES.indexOf(state) < currentIndex,
          current: state === this.currentState(),
          time: event ? hourOf(event.at) : '',
          role: event?.actor_role ? roleLabel(event.actor_role) : '',
          // Il ruolo si vede quando non è quello atteso per la fase (es. l'informatico al posto del segretario).
          unexpected: !!event?.actor_role && roleLabel(event.actor_role) !== (index === 3 ? 'Esperto remoto' : 'Segretario') && event.actor_role !== 'Sistema',
        };
      }),
    }));
  });
}

function hourOf(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
