import { Component, computed, input } from '@angular/core';

export interface SessionReferences {
  email_segretario?: string; telefono_segretario?: string;
  email_referente?: string; telefono_referente?: string;
  email_esperto_remoto?: string; telefono_esperto_remoto?: string;
  nome_informatico_sede?: string; email_informatico_sede?: string; telefono_informatico_sede?: string;
}

/** Riferimenti della sessione (prototipo, `app-refs`): chi contattare per ruolo. */
@Component({
  selector: 'app-session-references',
  template: `
    <section class="card card-bg no-after app-refs" aria-labelledby="rif">
      <div class="card-body">
        <h2 id="rif" class="h5 mb-3">Riferimenti</h2>
        <dl class="mb-0">
          @for (contact of contacts(); track contact.role) {
            <dt>{{ contact.role }}</dt>
            <dd>
              @if (contact.email || contact.phone) {
                @if (contact.name) { {{ contact.name }}<br> }
                @if (contact.email) { <a [href]="'mailto:' + contact.email">{{ contact.email }}</a> }
                @if (contact.phone) { @if (contact.email) { <br> } <a [href]="'tel:' + contact.phone">{{ contact.phone }}</a> }
              } @else {
                <span class="text-warning-emphasis fw-semibold">Da indicare</span>
              }
            </dd>
          }
        </dl>
      </div>
    </section>
  `,
})
export class SessionReferencesComponent {
  readonly references = input<SessionReferences>({});
  readonly contacts = computed(() => {
    const value = this.references();
    return [
      { role: 'Segretario', name: '', email: value.email_segretario, phone: value.telefono_segretario },
      { role: 'Referente', name: '', email: value.email_referente, phone: value.telefono_referente },
      { role: 'Esperto remoto', name: '', email: value.email_esperto_remoto, phone: value.telefono_esperto_remoto },
      { role: 'Informatico in sede', name: value.nome_informatico_sede, email: value.email_informatico_sede, phone: value.telefono_informatico_sede },
    ];
  });
}
