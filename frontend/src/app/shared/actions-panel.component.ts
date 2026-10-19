import { Component, input } from '@angular/core';

@Component({
  selector: 'app-actions-panel',
  template: `
    <section class="app-actions-card" aria-labelledby="actions-title">
      <header class="app-actions-head">
        <p class="app-eyebrow mb-1">{{ etichetta() }}</p>
        <h2 id="actions-title" class="h4 mb-1">{{ titolo() }}</h2>
        @if (nota()) { <p class="app-actions-sub mb-0">{{ nota() }}</p> }
      </header>
      <div class="app-actions-content"><ng-content /></div>
      @if (inCorso()) {
        <div class="app-longop" role="status">
          <div class="progress" role="progressbar" aria-label="Operazione in corso" aria-valuetext="In corso">
            <div class="progress-bar progress-bar-striped progress-bar-animated" style="width:100%"></div>
          </div>
          <p class="mt-2 mb-0">{{ messaggioInCorso() || 'Non chiudere la pagina' }}</p>
        </div>
      }
      <footer class="app-next-footer"><ng-content select="[azione]" /></footer>
    </section>
  `,
})
export class ActionsPanelComponent {
  readonly etichetta = input('Prossimo passo');
  readonly titolo = input.required<string>();
  readonly nota = input('');
  readonly inCorso = input(false);
  readonly messaggioInCorso = input('');
}
