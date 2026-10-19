import { Component, input } from '@angular/core';
import { ListSummary } from '../../core/models/api.models';

@Component({
  selector: 'app-list-files',
  template: `
    @if (list(); as item) {
      <section class="app-list-files" aria-label="File della sessione">
        <div class="d-flex flex-wrap gap-2">
          <a class="btn btn-outline-primary" [href]="item.downloads.xlsx">Presenti · Excel (XLSX) per la commissione</a>
          <a class="btn btn-outline-primary" [href]="item.downloads.moodle_csv">Utenti Moodle · CSV per l’esperto remoto</a>
        </div>
        @if (item.email_status === 'failed') { <p class="alert alert-warning mt-2 mb-0" role="status">Le liste sono disponibili. L’invio dell’email non è riuscito{{ item.email_error ? ': ' + item.email_error : '.' }}</p> }
        @else if (item.email_status === 'sent') { <p class="small text-success mt-2 mb-0">Notifica inviata all’esperto remoto.</p> }
      </section>
    }
  `,
})
export class ListFilesComponent { readonly list = input<ListSummary | null>(null); }
