import { Component, computed, input } from '@angular/core';
import { WorkflowState } from '../../core/models/api.models';
import { sessionStateInfo } from '../../shared/session-states';

const STATES = ['iniziale', 'configurata', 'candidati_scaricati', 'dispositivi_connessi', 'checkin_avviato', 'checkin_concluso', 'liste_generate', 'liste_inviate', 'lista_presenti_aggiornata_su_moodle', 'avvia_esame', 'esame_in_corso', 'esame_concluso'];
const PHASES = ['Preparazione', 'Check-in', 'Liste', 'Esame'];

@Component({
  selector: 'app-state-timeline',
  template: `
    <section class="app-timeline it-card shadow-sm p-3" aria-labelledby="timeline-title">
      <h2 id="timeline-title" class="h5">Avanzamento della sessione</h2>
      @for (phase of phases(); track phase.number) {
        <div class="app-tl-phase">
          <h3 class="h6">Fase {{ phase.number }} · {{ phase.label }}</h3>
          @if (phase.number === 4 && !faseEsameMia()) { <p class="small text-muted">A cura dell’esperto remoto</p> }
          <ol class="app-tl list-unstyled">
            @for (step of phase.steps; track step.state) {
              <li [class.is-done]="step.done" [class.is-current]="step.current" [attr.aria-current]="step.current ? 'step' : null">
                <span class="fw-semibold">{{ step.label }}</span>
                @if (step.current) { <span class="visually-hidden">, stato attuale</span> }
                @if (step.event) { <small class="d-block text-muted">{{ step.event.at }} · {{ step.event.actor_role }}</small> }
              </li>
            }
          </ol>
        </div>
      }
    </section>
  `,
})
export class StateTimelineComponent {
  readonly currentState = input('');
  readonly history = input<WorkflowState['history']>([]);
  readonly faseEsameMia = input(false);
  readonly phases = computed(() => {
    const currentIndex = STATES.indexOf(this.currentState());
    return PHASES.map((label, index) => ({
      number: index + 1,
      label,
      steps: STATES.filter((state) => sessionStateInfo(state).phase === index + 1).map((state) => {
        const stepIndex = STATES.indexOf(state);
        const event = this.history()?.find((item) => item.state === state);
        return { state, label: sessionStateInfo(state).label, done: stepIndex < currentIndex, current: state === this.currentState(), event };
      }),
    }));
  });
}
