import { Component, input } from '@angular/core';
import { ItIconComponent } from 'design-angular-kit';
import { ListSummary } from '../../core/models/api.models';

/** File della sessione (prototipo sessione-liste-invia.html): restano scaricabili dallo stato 7 in poi. */
@Component({
  selector: 'app-list-files',
  imports: [ItIconComponent],
  template: `
    @if (list(); as item) {
      @if (titolo()) { <h4 class="h6">{{ titolo() }}</h4> }
      <ul class="list-unstyled app-files mb-0">
        <li>
          <it-icon name="files" size="sm" color="primary" />
          <span class="flex-grow-1"><strong>Presenti</strong> · Excel (XLSX)<br><span class="small text-secondary">per la commissione</span></span>
          <a class="btn btn-outline-primary btn-sm btn-icon gap-1" [href]="item.downloads.xlsx" download>
            <it-icon name="download" size="xs" color="primary" /><span>Scarica</span><span class="visually-hidden"> l’elenco dei presenti in Excel</span>
          </a>
        </li>
        <li>
          <it-icon name="files" size="sm" color="primary" />
          <span class="flex-grow-1"><strong>Utenti Moodle</strong> · CSV<br><span class="small text-secondary">per l’esperto remoto</span></span>
          <a class="btn btn-outline-primary btn-sm btn-icon gap-1" [href]="item.downloads.moodle_csv" download>
            <it-icon name="download" size="xs" color="primary" /><span>Scarica</span><span class="visually-hidden"> il CSV per Moodle</span>
          </a>
        </li>
      </ul>
      @if (esitoEmail() && item.email_status === 'failed') {
        <div class="alert alert-warning mt-3 mb-0" role="status">
          L’email all’esperto remoto non è partita{{ item.email_error ? ': ' + item.email_error : '.' }}
          Le liste restano disponibili nella sua area: può aprirle da “Le mie sessioni”.
        </div>
      }
    }
  `,
})
export class ListFilesComponent {
  readonly list = input<ListSummary | null>(null);
  readonly titolo = input('');
  /** Mostra l'esito stabile dell'email di invio (vista segretario dopo l'invio). */
  readonly esitoEmail = input(false);
}
