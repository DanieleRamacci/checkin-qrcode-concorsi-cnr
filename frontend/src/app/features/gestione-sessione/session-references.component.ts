import { Component, input } from '@angular/core';

export interface SessionReferences {
  email_segretario?: string; telefono_segretario?: string;
  email_referente?: string; telefono_referente?: string;
  email_esperto_remoto?: string; telefono_esperto_remoto?: string;
  nome_informatico_sede?: string; email_informatico_sede?: string; telefono_informatico_sede?: string;
}

@Component({
  selector: 'app-session-references',
  template: `
    <section class="it-card shadow-sm p-3" aria-labelledby="references-title">
      <h2 id="references-title" class="h5">Contatti della sessione</h2>
      @for (contact of contacts(); track contact.role) {
        <div class="mb-3"><span class="app-eyebrow d-block">{{ contact.role }}</span>
          @if (contact.name) { <span class="d-block">{{ contact.name }}</span> }
          @if (contact.email) { <a class="d-block text-break" [href]="'mailto:' + contact.email">{{ contact.email }}</a> }
          @if (contact.phone) { <a class="d-block" [href]="'tel:' + contact.phone">{{ contact.phone }}</a> }
          @if (!contact.email && !contact.phone) { <span class="text-muted">Da indicare</span> }
        </div>
      }
    </section>
  `,
})
export class SessionReferencesComponent {
  readonly references = input<SessionReferences>({});
  contacts() {
    const value = this.references();
    return [
      { role: 'Segretario', email: value.email_segretario, phone: value.telefono_segretario },
      { role: 'Referente', email: value.email_referente, phone: value.telefono_referente },
      { role: 'Esperto remoto', email: value.email_esperto_remoto, phone: value.telefono_esperto_remoto },
      { role: 'Informatico in sede', name: value.nome_informatico_sede, email: value.email_informatico_sede, phone: value.telefono_informatico_sede },
    ];
  }
}
