import { Component, input } from '@angular/core';
import { ItIconComponent } from 'design-angular-kit';

/**
 * Pannello "Azioni · cosa fare adesso" (prototipo sessione-*.html): testata blu
 * fissa, fase in evidenza, titolo del passo, contenuto, avanzamento delle
 * operazioni lunghe e piè con nota e un solo pulsante principale.
 */
@Component({
  selector: 'app-actions-panel',
  imports: [ItIconComponent],
  template: `
    <section [class]="intestazione() ? 'card app-actions-card' : 'app-actions-nested'" [attr.aria-labelledby]="intestazione() ? 'az-title' : null">
      @if (intestazione()) {
        <div class="app-actions-head">
          <it-icon name="settings" color="white" />
          <h2 id="az-title" class="h5 mb-0">Azioni</h2>
          <span class="app-actions-sub">cosa fare adesso</span>
        </div>
      }
      <div [class.card-body]="intestazione()">
        @if (etichetta()) { <p class="app-eyebrow mb-1">{{ etichetta() }}</p> }
        <h3 class="h3 mb-3">{{ titolo() }}</h3>
        <ng-content />
        @if (inCorso()) {
          <div class="app-longop" role="status" aria-live="polite">
            <p class="fw-semibold mb-2">{{ messaggioInCorso() || 'Operazione in corso…' }}</p>
            <div class="progress mb-2">
              <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 100%" aria-label="Operazione in corso"></div>
            </div>
            <p class="small text-secondary mb-0">{{ notaInCorso() }}</p>
          </div>
        }
        <div class="app-next-footer">
          <p class="mb-0 text-secondary">{{ nota() }}<ng-content select="[nota]" /></p>
          <ng-content select="[azione]" />
        </div>
      </div>
    </section>
  `,
})
export class ActionsPanelComponent {
  /** Fase o passo, per esempio "Passo 2 di 3 · Preparazione". */
  readonly etichetta = input('');
  readonly titolo = input.required<string>();
  /** Testo accanto al pulsante: cosa succede dopo o perché è disabilitato. */
  readonly nota = input('');
  readonly inCorso = input(false);
  readonly messaggioInCorso = input('');
  readonly notaInCorso = input('Non chiudere la pagina.');
  /** false dentro un'altra sezione (es. "Azioni del segretario"): niente seconda testata "Azioni". */
  readonly intestazione = input(true);
}
