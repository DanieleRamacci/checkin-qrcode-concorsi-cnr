import { Component, computed, input } from '@angular/core';

interface TimelineStep {
  label: string;
  stepLabel: string;
  validStates: string[];
}

const STEPS: TimelineStep[] = [
  { label: 'Candidati Importati', stepLabel: 'Step 1', validStates: ['candidati_scaricati', 'dispositivi_connessi', 'checkin_avviato', 'checkin_concluso', 'liste_generate', 'liste_inviate', 'lista_presenti_aggiornata_su_moodle', 'avvia_esame', 'esame_in_corso', 'esame_concluso'] },
  { label: 'Check-in Iniziato', stepLabel: 'Step 2', validStates: ['checkin_avviato', 'checkin_concluso', 'liste_generate', 'liste_inviate', 'lista_presenti_aggiornata_su_moodle', 'avvia_esame', 'esame_in_corso', 'esame_concluso'] },
  { label: 'Check-in Concluso', stepLabel: 'Step 3', validStates: ['checkin_concluso', 'liste_generate', 'liste_inviate', 'lista_presenti_aggiornata_su_moodle', 'avvia_esame', 'esame_in_corso', 'esame_concluso'] },
  { label: 'Liste Generate', stepLabel: 'Step 4', validStates: ['liste_generate', 'liste_inviate', 'lista_presenti_aggiornata_su_moodle', 'avvia_esame', 'esame_in_corso', 'esame_concluso'] },
  { label: 'Lista Inviata', stepLabel: 'Step 5', validStates: ['liste_inviate', 'lista_presenti_aggiornata_su_moodle', 'avvia_esame', 'esame_in_corso', 'esame_concluso'] },
  { label: 'Presenti Importati', stepLabel: 'Step 6', validStates: ['lista_presenti_aggiornata_su_moodle', 'avvia_esame', 'esame_in_corso', 'esame_concluso'] },
  { label: 'Esame Avviato', stepLabel: 'Step 7', validStates: ['avvia_esame', 'esame_in_corso', 'esame_concluso'] },
  { label: 'Esame in Corso', stepLabel: 'Step 8', validStates: ['esame_in_corso', 'esame_concluso'] },
  { label: 'Esame Concluso', stepLabel: 'Step 9', validStates: ['esame_concluso'] },
];

@Component({
  selector: 'app-exam-timeline',
  template: `
    <div class="card timeline-card overflow-auto">
      <h5 class="mb-3">Timeline Esame</h5>
      <ul class="exam-timeline list-unstyled ps-0">
        @for (step of rows(); track step.stepLabel) {
          <li class="timeline-step mb-3" [class.current-step]="step.current" [attr.aria-current]="step.current ? 'step' : null">
            <div class="d-flex justify-content-between align-items-center w-100">
              <div class="d-flex align-items-center gap-2">
                <span class="timeline-dot"
                  [class.bg-primary]="step.current"
                  [class.bg-success]="step.reached && !step.current"
                  [class.bg-secondary]="!step.reached"></span>
                <strong>{{ step.label }}</strong>
              </div>
              <span class="text-muted small step-label">{{ step.stepLabel }}</span>
            </div>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .timeline-dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; }
    .timeline-card { max-height: 440px; padding: 0.85rem; }
    .timeline-step { font-size: 0.92rem; }
    .step-label { white-space: nowrap; margin-left: auto; }
    .current-step { color: var(--bs-primary); }
  `,
})
export class ExamTimelineComponent {
  readonly currentState = input<string | null>(null);

  readonly rows = computed(() => {
    const state = this.currentState() ?? '';
    const currentIndex = STEPS.reduce(
      (latest, step, index) => step.validStates.includes(state) ? index : latest,
      -1,
    );
    return STEPS.map((step, index) => ({
      ...step,
      reached: step.validStates.includes(state),
      current: index === currentIndex,
    }));
  });
}
