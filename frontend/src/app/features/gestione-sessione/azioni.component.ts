import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient } from '../../core/api-client';
import { ListSummary } from '../../core/models/api.models';

interface MergedConfig {
  email_esperto_remoto?: string;
  email_segretario?: string;
  durata_prova_minuti?: number;
  nome_informatico_sede?: string;
  email_informatico_sede?: string;
  telefono_informatico_sede?: string;
}

/**
 * Riproduce 1:1 le card per-stato di templates/frammenti/azioni.html (vista segretario/non-esperto).
 * Le azioni qui gestite (configura_sessione, scarica_candidati, collega_dispositivo, genera_liste,
 * invia_liste) non passano dall'endpoint generico /actions/<action> — vedi DIRECT_ACTIONS in
 * utils/workflow_service.py — richiedono i rispettivi endpoint applicativi.
 */
@Component({
  selector: 'app-azioni',
  imports: [FormsModule, RouterLink, NgTemplateOutlet],
  template: `
    @if (busy()) {
      <div class="overlay" role="status" aria-live="polite" aria-busy="true">
        <div class="text-center">
          <div class="spinner-border" role="status"><span class="visually-hidden">Caricamento…</span></div>
          <p class="mt-3 mb-0">Operazione in corso… non chiudere la pagina.</p>
        </div>
      </div>
    }
    @if (viewMode() === 'esperto') {
      <div class="it-card-wrapper mb-3">
        <div class="it-card shadow-sm p-3 bg-light">
          <h5 class="mb-2">Scarica liste</h5>
          <p class="text-muted">Scarica i file generati dal segretario per la sessione.</p>
          @if (latestList(); as lista) {
            <div class="d-flex flex-wrap gap-2">
              <a class="btn btn-outline-primary" [href]="lista.downloads.xlsx">Lista presenti (XLSX)</a>
              <a class="btn btn-primary" [href]="lista.downloads.moodle_csv">Lista Moodle (CSV)</a>
            </div>
          } @else {
            <div class="alert alert-warning mb-0">Le liste non sono ancora disponibili.</div>
          }
        </div>
      </div>

      <div class="it-card-wrapper mb-3">
        <div class="it-card shadow-sm p-3 bg-light">
          <h5 class="mb-2">Gestione esame</h5>
          @switch (currentState()) {
            @case ('liste_inviate') {
              <p class="text-muted">Conferma di avere aggiornato su Moodle l'elenco dei candidati presenti.</p>
              <button class="btn btn-primary" type="button" [disabled]="busy()"
                (click)="runAction('aggiorna_presenti_moodle', 'Confermi di avere aggiornato la lista presenti su Moodle?')">
                Lista presenti aggiornata
              </button>
            }
            @case ('lista_presenti_aggiornata_su_moodle') {
              <p class="text-muted">Comunica al segretario che l'ambiente d'esame è pronto.</p>
              <button class="btn btn-primary" type="button" [disabled]="busy()"
                (click)="runAction('avvia_esame', 'Confermi di voler avviare la preparazione dell’esame?')">
                Avvia esame
              </button>
            }
            @case ('avvia_esame') {
              <p class="text-muted">Avvia formalmente la prova dopo l'autorizzazione.</p>
              <button class="btn btn-success" type="button" [disabled]="busy()"
                (click)="runAction('inizia_esame', 'Confermi di voler iniziare l’esame?')">
                Inizia esame
              </button>
            }
            @case ('esame_in_corso') {
              <p class="text-muted">Concludi la prova quando il tempo d'esame è terminato.</p>
              <button class="btn btn-success" type="button" [disabled]="busy()"
                (click)="runAction('concludi_esame', 'Confermi di voler concludere l’esame?')">
                Concludi esame
              </button>
            }
            @case ('esame_concluso') {
              <div class="alert alert-success mb-0">Esame concluso.</div>
            }
            @case ('liste_generate') {
              <div class="alert alert-info mb-0">Liste generate. In attesa che il segretario le invii all'esperto informatico.</div>
            }
            @default {
              <div class="alert alert-info mb-0">In attesa che il segretario generi e invii le liste.</div>
            }
          }
          @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
        </div>
      </div>
    } @else {
    @switch (currentState()) {
      @case ('iniziale') {
        <div class="it-card-wrapper mb-3">
          <div class="it-card shadow-sm p-3 bg-light">
            <h5 class="mb-1">Configura Informatico in Sede</h5>
            @if (!bandoConfigured()) {
              <div class="alert alert-warning mt-3 mb-3">
                I dati del bando non risultano ancora completi. Puoi comunque indicare qui sotto l'esperto informatico da remoto se manca, oppure attendere che il referente completi la configurazione.
              </div>
            } @else {
              <p class="mb-2 text-muted small">
                I dati del bando sono già configurati. Inserisci l'informatico in sede per questa sessione.
              </p>
            }
            <form (ngSubmit)="saveSessionConfig()">
              <div class="row g-2 mb-3">
                <div class="col-md-6">
                  <label class="form-label" for="email_esperto_remoto">Esperto informatico da remoto</label>
                  @if (expertOptions().length) {
                    <select class="form-select" id="email_esperto_remoto" name="email_esperto_remoto"
                            [(ngModel)]="bandoConfigModel.email_esperto_remoto">
                      <option value="">— nessuno —</option>
                      @for (email of expertOptions(); track email) {
                        <option [value]="email">{{ email }}</option>
                      }
                    </select>
                  } @else {
                    <input type="email" class="form-control" id="email_esperto_remoto" placeholder="es. nome.cognome@cnr.it"
                           [(ngModel)]="bandoConfigModel.email_esperto_remoto" name="email_esperto_remoto" />
                  }
                  <div class="form-text">Compila qui solo se non è già stato assegnato in Configura Bando.</div>
                </div>
              </div>
              <div class="row g-2 mb-3">
                <div class="col-md-4">
                  <label class="form-label" for="nome_informatico_sede">Nome informatico in sede</label>
                  <input type="text" class="form-control" id="nome_informatico_sede" placeholder="es. Mario Rossi" [(ngModel)]="sessionConfigModel.nome_informatico_sede" name="nome_informatico_sede" />
                </div>
                <div class="col-md-4">
                  <label class="form-label" for="email_informatico_sede">Email</label>
                  <input type="email" class="form-control" id="email_informatico_sede" placeholder="es. nome.cognome@cnr.it" [(ngModel)]="sessionConfigModel.email_informatico_sede" name="email_informatico_sede" />
                </div>
                <div class="col-md-4">
                  <label class="form-label" for="telefono_informatico_sede">Telefono</label>
                  <input type="tel" class="form-control" id="telefono_informatico_sede" placeholder="es. +39 06 1234567" [(ngModel)]="sessionConfigModel.telefono_informatico_sede" name="telefono_informatico_sede" />
                </div>
              </div>
              <div class="d-flex justify-content-end border-top pt-3">
                <button type="submit" class="btn btn-primary">Salva e prosegui</button>
              </div>
            </form>
            @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
          </div>
        </div>
        @if (!bandoConfigured()) {
          <div class="alert alert-info mb-3">
            Se mancano i componenti della commissione su Selezioni Online, la configurazione del bando non potrà precompilare segretario e componenti.
          </div>
        }
      }
      @case ('configurata') {
        @if (!bandoConfigured()) {
          <div class="alert alert-warning mb-3">
            Attenzione: il bando non risulta configurato. L'invio delle liste richiede un esperto informatico remoto.
          </div>
        }
        <div class="it-card-wrapper mb-3">
          <div class="it-card shadow-sm p-3 bg-light">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="mb-2">Scarica Lista Candidati</h5>
                <p class="mb-2 text-muted">Scarica i candidati registrati per questa sessione.</p>
                @if (mergedConfig(); as cfg) {
                  <ul class="small text-muted mb-0">
                    @if (cfg.email_esperto_remoto) { <li><strong>Esperto remoto:</strong> {{ cfg.email_esperto_remoto }}</li> }
                    @if (cfg.nome_informatico_sede || cfg.email_informatico_sede) {
                      <li><strong>Informatico sede:</strong> {{ cfg.nome_informatico_sede }} @if (cfg.email_informatico_sede) { ({{ cfg.email_informatico_sede }}) }</li>
                    }
                    @if (cfg.email_segretario) { <li><strong>Segretario:</strong> {{ cfg.email_segretario }}</li> }
                    @if (cfg.durata_prova_minuti) { <li><strong>Durata prova:</strong> {{ cfg.durata_prova_minuti }} min</li> }
                  </ul>
                }
                @if (adminOnly()) {
                  <div class="alert alert-warning mt-3 mb-0">
                    Stai aprendo questa sessione solo come amministratore locale: lo scarico candidati richiede una relazione operativa con la commissione.
                  </div>
                }
              </div>
              <button class="btn btn-primary" type="button" [disabled]="busy() || adminOnly()" (click)="importCandidati()">Scarica Candidati</button>
            </div>
            @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
          </div>
        </div>
      }
      @case ('candidati_scaricati') {
        <div class="it-card-wrapper mb-3">
          <div class="it-card shadow-sm p-3 bg-light">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="mb-2">Collega un Dispositivo</h5>
                <p class="mb-3 text-muted">Per proseguire è necessario collegare almeno un dispositivo alla sessione.</p>
              </div>
              <a class="btn btn-primary" [routerLink]="['/sessioni', sessionId(), 'dispositivi']">Collega</a>
            </div>
          </div>
        </div>
      }
      @case ('dispositivi_connessi') {
        <div class="it-card-wrapper mb-3">
          <div class="it-card shadow-sm p-3 bg-light">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="mb-2">Collega altri Dispositivi</h5>
                <p class="mb-3 text-muted">Per aggiungere altri dispositivi premi il pulsante</p>
                <span class="badge bg-success ms-2">{{ deviceCount() }} dispositivi connessi</span>
              </div>
              <a class="btn btn-primary" [routerLink]="['/sessioni', sessionId(), 'dispositivi']">Collega Dispositivo</a>
            </div>
          </div>
        </div>
        <div class="it-card-wrapper mb-3">
          <div class="it-card shadow-sm p-3 bg-light">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="mb-2">Avvia il Check-in</h5>
                <p class="mb-3 text-muted">Avvia la fase di check-in per questa sessione.</p>
              </div>
              <button class="btn btn-success" type="button" [disabled]="busy()" (click)="runAction('avvia_checkin')">Avvia check-in</button>
            </div>
            @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
          </div>
        </div>
      }
      @case ('checkin_avviato') {
        <div class="it-card-wrapper mb-3">
          <div class="it-card shadow-sm p-3 bg-light">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="mb-2">Concludi Check-in</h5>
                <p class="mb-3 text-muted">Concludi la fase di check-in per procedere.</p>
              </div>
              <button class="btn btn-success" type="button" [disabled]="busy()" (click)="runAction('concludi_checkin')">Concludi Checkin</button>
            </div>
            @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
          </div>
        </div>
      }
      @case ('checkin_concluso') {
        <div class="it-card-wrapper mb-3">
          <div class="it-card shadow-sm p-3 bg-light">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="mb-2">Genera Liste</h5>
                <p class="mb-3 text-muted">Genera i file necessari (XLSX presenti + CSV Moodle aggiornato).</p>
              </div>
              <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="generaListe()">Genera Liste</button>
            </div>
            @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
          </div>
        </div>
      }
      @case ('liste_generate') { <ng-container *ngTemplateOutlet="listeGenerate" /> }
      @case ('liste_inviate') { <ng-container *ngTemplateOutlet="listeGenerate" /> }
    }
    @if (currentState() === 'liste_inviate') {
      <div class="alert alert-warning d-flex align-items-center" role="alert">
        <div>In attesa di caricamento candidati presenti e comunicazione avvio prova da parte dell'informatico.</div>
      </div>
    }
    @if (currentState() === 'lista_presenti_aggiornata_su_moodle') {
      <div class="alert alert-info d-flex align-items-center" role="alert">
        <div>Lista presenti aggiornata da parte dell'informatico.</div>
      </div>
    }
    @if (currentState() === 'esame_in_corso') {
      <div class="alert alert-primary d-flex align-items-center" role="alert">
        <div>Prova in corso. L'esame è stato avviato regolarmente.</div>
      </div>
    }
    }

    <ng-template #listeGenerate>
      <div class="it-card-wrapper mb-3">
        <div class="it-card shadow-sm p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div class="me-3">
              <h5 class="mb-2">Liste Generate</h5>
              <p class="mb-2 text-muted">I file sono pronti. Puoi scaricarli o inviarli all'esperto informatico.</p>
              @if (latestList(); as lista) {
                <ul class="mb-3">
                  <li><strong>Presenti:</strong> {{ lista.num_presenti }}</li>
                </ul>
                <div class="d-flex flex-column gap-2 mb-3">
                  <a class="btn btn-outline-primary" [href]="lista.downloads.xlsx">Scarica lista presenti (XLSX)</a>
                  <a class="btn btn-primary" [href]="lista.downloads.moodle_csv">Scarica lista per Moodle (CSV)</a>
                </div>
              } @else {
                <div class="alert alert-warning">Nessuna lista trovata.</div>
              }
            </div>
            <button class="btn btn-success" type="button" [disabled]="busy()" (click)="inviaListe()">Invia lista ad esperto informatico</button>
          </div>
          @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
        </div>
      </div>
    </ng-template>
  `,
  styles: `
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.75);
    }
  `,
})
export class AzioniComponent {
  readonly sessionId = input.required<string>();
  readonly commissionId = input.required<string>();
  readonly currentState = input<string | null>(null);
  readonly viewMode = input<'segretario' | 'sede' | 'esperto' | 'admin'>('segretario');
  readonly adminOnly = input(false);
  readonly bandoConfigured = input(false);
  readonly deviceCount = input(0);
  readonly changed = output<void>();

  private readonly api = inject(ApiClient);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly mergedConfig = signal<MergedConfig | null>(null);
  readonly latestList = signal<ListSummary | null>(null);
  readonly expertOptions = signal<string[]>([]);

  sessionConfigModel = {
    nome_informatico_sede: '',
    email_informatico_sede: '',
    telefono_informatico_sede: '',
  };
  bandoConfigModel = {
    email_esperto_remoto: '',
  };

  ngOnInit(): void {
    this.loadContextData();
  }

  ngOnChanges(): void {
    this.loadContextData();
  }

  private loadContextData(): void {
    const modeParam = encodeURIComponent(this.viewMode());
    if (this.currentState() === 'iniziale') {
      this.api.get<Record<string, string>>(`/sessioni/${this.sessionId()}/config?mode=${modeParam}`).subscribe((data) => {
        this.sessionConfigModel = {
          nome_informatico_sede: data['nome_informatico_sede'] ?? '',
          email_informatico_sede: data['email_informatico_sede'] ?? '',
          telefono_informatico_sede: data['telefono_informatico_sede'] ?? '',
        };
      });
      this.api.get<Record<string, any>>(`/bandi/${this.commissionId()}/config?mode=${modeParam}`).subscribe((data) => {
        this.bandoConfigModel = {
          email_esperto_remoto: data['email_esperto_remoto'] ?? '',
        };
        this.expertOptions.set(data['expert_options'] ?? []);
      });
    }
    if (this.currentState() === 'configurata') {
      this.api.get<MergedConfig>(`/bandi/${this.commissionId()}/config?mode=${modeParam}`).subscribe((bando) => {
        this.api.get<MergedConfig>(`/sessioni/${this.sessionId()}/config?mode=${modeParam}`).subscribe((sessione) => {
          this.mergedConfig.set({ ...bando, ...Object.fromEntries(Object.entries(sessione).filter(([, v]) => v)) });
        });
      });
    }
    if ([
      'liste_generate',
      'liste_inviate',
      'lista_presenti_aggiornata_su_moodle',
      'avvia_esame',
      'esame_in_corso',
      'esame_concluso',
    ].includes(this.currentState() ?? '')) {
      this.api.get<ListSummary>(`/sessioni/${this.sessionId()}/lists/latest?mode=${modeParam}`).subscribe({
        next: (item) => this.latestList.set(item),
        error: () => this.latestList.set(null),
      });
    }
  }

  saveSessionConfig(): void {
    this.error.set('');
    this.busy.set(true);
    const modeParam = encodeURIComponent(this.viewMode());
    this.api.put(`/bandi/${this.commissionId()}/config?mode=${modeParam}`, this.bandoConfigModel).subscribe({
      next: () => {
        this.api.put(`/sessioni/${this.sessionId()}/config?mode=${modeParam}`, this.sessionConfigModel).subscribe({
          next: () => { this.busy.set(false); this.changed.emit(); },
          error: (err) => { this.busy.set(false); this.error.set(this.extractError(err)); },
        });
      },
      error: (err) => { this.busy.set(false); this.error.set(this.extractError(err)); },
    });
  }

  importCandidati(): void {
    if (this.adminOnly()) {
      this.error.set('Scarica candidati richiede che il tuo utente sia segretario abilitato su Selezioni Online per questo bando.');
      return;
    }
    this.error.set('');
    this.busy.set(true);
    this.api.post(`/sessioni/${this.sessionId()}/candidati/import?mode=${encodeURIComponent(this.viewMode())}`).subscribe({
      next: () => { this.busy.set(false); this.changed.emit(); },
      error: (err) => { this.busy.set(false); this.error.set(this.extractError(err)); },
    });
  }

  runAction(action: string, confirmation?: string): void {
    if (confirmation && !window.confirm(confirmation)) return;
    this.error.set('');
    this.busy.set(true);
    this.api.post(`/sessioni/${this.sessionId()}/actions/${action}?mode=${encodeURIComponent(this.viewMode())}`).subscribe({
      next: () => { this.busy.set(false); this.changed.emit(); },
      error: (err) => { this.busy.set(false); this.error.set(this.extractError(err)); },
    });
  }

  generaListe(): void {
    this.error.set('');
    this.busy.set(true);
    this.api.post<ListSummary>(`/sessioni/${this.sessionId()}/lists/generate?mode=${encodeURIComponent(this.viewMode())}`).subscribe({
      next: (item) => { this.busy.set(false); this.latestList.set(item); this.changed.emit(); },
      error: (err) => { this.busy.set(false); this.error.set(this.extractError(err)); },
    });
  }

  inviaListe(): void {
    this.error.set('');
    this.busy.set(true);
    this.api.post(`/sessioni/${this.sessionId()}/lists/send?mode=${encodeURIComponent(this.viewMode())}`).subscribe({
      next: () => { this.busy.set(false); this.changed.emit(); },
      error: (err) => { this.busy.set(false); this.error.set(this.extractError(err)); },
    });
  }

  private extractError(err: unknown): string {
    const body = (err as { error?: { error?: { message?: string; details?: Record<string, string> } } })?.error?.error;
    if (!body) return 'Operazione non riuscita.';
    const details = body.details ? Object.entries(body.details).map(([field, msg]) => `${field}: ${msg}`).join('; ') : '';
    return details ? `${body.message} (${details})` : body.message || 'Operazione non riuscita.';
  }
}
