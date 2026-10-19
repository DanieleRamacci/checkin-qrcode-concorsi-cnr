import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { ListSendResult, ListSummary } from '../../core/models/api.models';
import { ActionsPanelComponent } from '../../shared/actions-panel.component';
import { DevicesPanelComponent } from '../dispositivi/devices-panel.component';
import { ListFilesComponent } from './list-files.component';
import { sessionStateAction } from '../../shared/session-states';

interface MergedConfig {
  email_esperto_remoto?: string;
  email_segretario?: string;
  durata_prova_minuti?: number;
  nome_informatico_sede?: string;
  email_informatico_sede?: string;
  telefono_informatico_sede?: string;
  informatici_sede?: SedeTechnician[];
}

interface SedeTechnician {
  nome?: string;
  email?: string;
  telefono?: string;
  principale?: boolean;
}

/**
 * Riproduce 1:1 le card per-stato di templates/frammenti/azioni.html (vista segretario/non-esperto).
 * Le azioni qui gestite (configura_sessione, scarica_candidati, collega_dispositivo, genera_liste,
 * invia_liste) non passano dall'endpoint generico /actions/<action> — vedi DIRECT_ACTIONS in
 * utils/workflow_service.py — richiedono i rispettivi endpoint applicativi.
 */
@Component({
  selector: 'app-azioni',
  imports: [FormsModule, NgTemplateOutlet, ActionsPanelComponent, DevicesPanelComponent, ListFilesComponent],
  template: `
    @if (busy()) {
      <div class="overlay" role="status" aria-live="polite" aria-busy="true">
        <div class="text-center">
          <div class="spinner-border" role="status"><span class="visually-hidden">Caricamento…</span></div>
          <p class="mt-3 mb-0">{{ operationMessage() }}</p>
        </div>
      </div>
    }
    @if (currentState()) {
      <app-actions-panel [etichetta]="viewMode() === 'esperto' ? 'Il tuo prossimo passo' : 'Azioni · cosa fare adesso'" [titolo]="panelTitle()">
    @if (viewMode() === 'esperto') {
      <div class="it-card-wrapper mb-3">
        <div class="it-card shadow-sm p-3 bg-light">
          <h5 class="mb-2">Scarica liste</h5>
          <p class="text-muted">Scarica i file generati dal segretario per la sessione.</p>
          @if (latestList()) { <app-list-files [list]="latestList()" /> } @else {
            <div class="alert alert-warning mb-0">Le liste non sono ancora disponibili.</div>
          }
        </div>
      </div>

          <div class="it-card-wrapper mb-3">
        <div class="it-card shadow-sm p-3 bg-light">
          <h5 class="mb-2">Gestione esame</h5>
          <p class="mb-2"><span class="badge app-badge-warning">{{ openResetCount() }} reset password da fare</span> <a href="#candidates" class="ms-2">Vai ai candidati</a></p>
          <p class="small text-secondary">Per le nuove richieste arriva una notifica nel browser e un’email.</p>
          <div class="form-check mb-3"><input class="form-check-input" id="reset-sound" type="checkbox" [checked]="resetSoundEnabled()" (change)="setResetSoundEnabled($event)" /><label class="form-check-label" for="reset-sound">Avviso sonoro per le nuove richieste</label></div>
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
              <div class="alert alert-info mb-0">Liste generate. In attesa che il segretario le invii all'esperto remoto.</div>
            }
            @default {
              <div class="alert alert-info mb-0">In attesa che il segretario generi e invii le liste.</div>
            }
          }
          @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
        </div>
      </div>
    } @else if (viewMode() === 'sede') {
      @if (currentState() === 'iniziale' || currentState() === 'configurata') {
        <div class="alert alert-info mb-3" role="status">In attesa che il segretario prepari la sessione.</div>
      }
      @if (currentState() === 'candidati_scaricati' || currentState() === 'dispositivi_connessi') {
        <section class="it-card-wrapper mb-3"><div class="it-card shadow-sm p-3 bg-light">
          <h2 class="h5">Collegamento dispositivi</h2>
          <p class="text-muted">Collega i telefoni che useranno lo scanner in aula.</p>
          <app-devices-panel [sessionId]="sessionId()" [mode]="viewMode()" />
          @if (currentState() === 'candidati_scaricati') { <p class="small text-muted mb-0">Il check-in si avvierà quando il segretario collega almeno un dispositivo.</p> }
        </div></section>
      }
      @if (currentState() === 'checkin_avviato') {
        <section class="it-card-wrapper mb-3"><div class="it-card shadow-sm p-3 bg-light">
          <p class="mb-2">Il reset si chiede dalla riga del candidato.</p>
          <p class="mb-2"><span class="badge app-badge-warning">{{ openResetCount() }} richieste in attesa</span></p>
          <a class="btn btn-primary btn-sm me-2" href="#candidates">Vai ai candidati</a>
          <details class="mt-3"><summary class="btn btn-outline-secondary btn-sm">Collega un dispositivo</summary><div class="mt-3"><app-devices-panel [sessionId]="sessionId()" [mode]="viewMode()" /></div></details>
        </div></section>
      }
      @if (currentState() === 'liste_inviate' || currentState() === 'lista_presenti_aggiornata_su_moodle' || currentState() === 'avvia_esame' || currentState() === 'esame_in_corso' || currentState() === 'esame_concluso') {
        <div class="alert alert-info mb-3" role="status">{{ sedeStatus() }}</div>
      }
      @if (['candidati_scaricati', 'dispositivi_connessi', 'checkin_avviato', 'checkin_concluso', 'liste_generate'].includes(currentState() ?? '')) {
        <details class="it-card-wrapper mb-3">
          <summary class="it-card shadow-sm p-3 bg-light fw-semibold">Azioni del segretario</summary>
          <div class="it-card shadow-sm p-3 bg-light border-top-0">
            @switch (currentState()) {
              @case ('candidati_scaricati') { <p class="mb-0">Il segretario può proseguire dopo aver collegato i dispositivi necessari.</p> }
              @case ('dispositivi_connessi') { <p>Dispositivi collegati: {{ deviceCount() }}.</p><button class="btn btn-primary" type="button" [disabled]="busy()" (click)="runAction('avvia_checkin')">Avvia check-in</button> }
              @case ('checkin_avviato') { <p class="mb-0">Concludi check-in e altre azioni della sessione sono disponibili solo al segretario.</p> }
              @case ('checkin_concluso') { <p>Il check-in è concluso. Genera le liste dei presenti.</p><button class="btn btn-primary" type="button" [disabled]="busy()" (click)="generaListe()">Genera liste</button> }
              @case ('liste_generate') { @if (latestList()) { <app-list-files [list]="latestList()" /> }<button class="btn btn-primary mt-3" type="button" [disabled]="busy() || !latestList()" (click)="inviaListe()">Invia liste all’esperto remoto</button> }
            }
            @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
          </div>
        </details>
      }
    } @else {
    @switch (currentState()) {
      @case ('iniziale') {
        <div class="it-card-wrapper mb-3">
          <div class="it-card shadow-sm p-3 bg-light">
            <h5 class="mb-1">Configura l’informatico in sede</h5>
            @if (!bandoConfigured()) {
              <div class="alert alert-warning mt-3 mb-3">
                I dati del bando non risultano ancora completi. Puoi comunque indicare qui sotto l'esperto remoto se manca, oppure attendere che il referente completi la configurazione.
              </div>
            } @else {
              <p class="mb-2 text-muted small">
                I dati del bando sono già configurati. Inserisci l'informatico in sede per questa sessione.
              </p>
            }
            <form (ngSubmit)="saveSessionConfig()">
              <div class="row g-2 mb-3">
                <div class="col-md-6">
                  <label class="form-label" for="email_esperto_remoto">Esperto remoto</label>
                  @if (expertOptions().length) {
                    <select class="form-select" id="email_esperto_remoto" name="email_esperto_remoto"
                            [(ngModel)]="sessionConfigModel.email_esperto_remoto" required>
                      <option value="">Seleziona esperto remoto</option>
                      @for (email of expertOptions(); track email) {
                        <option [value]="email">{{ email }}</option>
                      }
                    </select>
                  } @else {
                    <input type="email" class="form-control" id="email_esperto_remoto" placeholder="es. nome.cognome@cnr.it"
                           [(ngModel)]="sessionConfigModel.email_esperto_remoto" name="email_esperto_remoto" required />
                  }
                  <div class="form-text">Assegnato a questa sessione. Può essere diverso da altre sessioni dello stesso bando.</div>
                </div>
              </div>
              <div class="row g-2 mb-3">
                <div class="col-md-4">
                  <label class="form-label" for="nome_informatico_sede">Nome informatico in sede</label>
                  <input type="text" class="form-control" id="nome_informatico_sede" placeholder="es. Mario Rossi" [(ngModel)]="sessionConfigModel.nome_informatico_sede" name="nome_informatico_sede" />
                </div>
                <div class="col-md-4">
                  <label class="form-label" for="email_informatico_sede">Email</label>
                  <input type="email" class="form-control" id="email_informatico_sede" placeholder="es. nome.cognome@cnr.it" [(ngModel)]="sessionConfigModel.email_informatico_sede" name="email_informatico_sede" required />
                </div>
                <div class="col-md-4">
                  <label class="form-label" for="telefono_informatico_sede">Telefono</label>
                  <input type="tel" class="form-control" id="telefono_informatico_sede" placeholder="es. +39 06 1234567" [(ngModel)]="sessionConfigModel.telefono_informatico_sede" name="telefono_informatico_sede" />
                </div>
              </div>
              <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center border-top pt-3">
                @if (!canSaveSessionConfig()) {
                  <div class="text-danger small">
                    Per proseguire devi selezionare l'esperto remoto e indicare l'email dell'informatico in sede.
                  </div>
                }
                <button type="submit" class="btn btn-primary ms-auto" [disabled]="busy() || !canSaveSessionConfig()">Salva e prosegui</button>
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
            Attenzione: il bando non risulta configurato. L'invio delle liste richiede un esperto remoto.
          </div>
        }
        <div class="it-card-wrapper mb-3">
          <div class="it-card shadow-sm p-3 bg-light">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="mb-2">Scarica candidati</h5>
                <p class="mb-2 text-muted">Scarica i candidati registrati per questa sessione.</p>
                @if (mergedConfig(); as cfg) {
                  <ul class="small text-muted mb-0">
                    @if (cfg.email_esperto_remoto) { <li><strong>Esperto remoto:</strong> {{ cfg.email_esperto_remoto }}</li> }
                    @if (cfg.nome_informatico_sede || cfg.email_informatico_sede) {
                      <li><strong>Informatico in sede:</strong> {{ cfg.nome_informatico_sede }} @if (cfg.email_informatico_sede) { ({{ cfg.email_informatico_sede }}) }</li>
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
              <button class="btn btn-primary" type="button" [disabled]="busy() || adminOnly()" (click)="importCandidati()">
                @if (busy()) { <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span> }
                Scarica Candidati
              </button>
            </div>
            @if (success()) { <div class="alert alert-success mt-3 mb-0" role="status">{{ success() }}</div> }
            @if (warning()) { <div class="alert alert-warning mt-3 mb-0" role="status">{{ warning() }}</div> }
            @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
          </div>
        </div>
      }
      @case ('candidati_scaricati') {
        <div class="it-card-wrapper mb-3">
          <div class="it-card shadow-sm p-3 bg-light">
            <h5 class="mb-2">Collega gli smartphone che useranno come scanner</h5>
            <app-devices-panel [sessionId]="sessionId()" [mode]="viewMode()" />
            <button class="btn btn-primary mt-3" type="button" disabled>Avvia check-in</button>
            @if (deviceCount() === 0) { <p class="small text-muted mt-2 mb-0">Collega almeno un dispositivo per proseguire.</p> }
          </div>
        </div>
      }
      @case ('dispositivi_connessi') {
        <div class="it-card-wrapper mb-3">
          <div class="it-card shadow-sm p-3 bg-light">
            <h5 class="mb-2">Tutto pronto: {{ deviceCount() }} dispositivi, candidati da registrare</h5>
            <app-devices-panel [sessionId]="sessionId()" [mode]="viewMode()" />
            <button class="btn btn-success mt-3" type="button" [disabled]="busy()" (click)="runAction('avvia_checkin')">Avvia check-in</button>
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
              <button class="btn btn-outline-primary" type="button" [disabled]="busy()" (click)="concludeModalOpen.set(true)">Concludi check-in…</button>
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
                <h5 class="mb-2">Genera liste</h5>
                <p class="mb-3 text-muted">Genera i file necessari (XLSX presenti + CSV Moodle aggiornato).</p>
              </div>
              <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="generaListe()">
                @if (busy()) { <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span> }
                Genera liste
              </button>
            </div>
            @if (success()) { <div class="alert alert-success mt-3 mb-0" role="status">{{ success() }}</div> }
            @if (warning()) { <div class="alert alert-warning mt-3 mb-0" role="status">{{ warning() }}</div> }
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
              <p class="mb-2 text-muted">I file sono pronti. Puoi scaricarli o inviarli all'esperto remoto.</p>
              @if (latestList(); as lista) {
                <ul class="mb-3">
                  <li><strong>Presenti:</strong> {{ lista.num_presenti }}</li>
                </ul>
                <app-list-files [list]="latestList()" />
              } @else {
                <div class="alert alert-warning">Nessuna lista trovata.</div>
              }
            </div>
            <div class="send-list-actions">
              @if (currentState() === 'liste_generate') {
                <button class="btn btn-success" type="button" [disabled]="busy() || !latestList()" (click)="inviaListe()">
                  @if (busy()) { <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span> }
                  Invia lista all'esperto remoto
                </button>
              } @else if (latestList()?.email_status === 'failed') {
                <div class="alert alert-warning mb-0" role="status">
                  Liste disponibili: l'esperto remoto può vederle e scaricarle dalla propria area personale.
                  L'invio della notifica email non è riuscito{{ latestList()?.email_error ? (' (' + latestList()?.email_error + ')') : '' }}.
                </div>
              } @else {
                <div class="alert alert-success mb-0" role="status">
                  Liste candidati inviate correttamente.
                  L'esperto remoto vede ora la fase successiva.
                </div>
              }
            </div>
          </div>
          @if (success()) { <div class="alert alert-success mt-3 mb-0" role="status">{{ success() }}</div> }
          @if (warning()) { <div class="alert alert-warning mt-3 mb-0" role="status">{{ warning() }}</div> }
          @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
        </div>
      </div>
    </ng-template>
    @if (concludeModalOpen()) {
      <div class="modal d-block" role="dialog" aria-modal="true" aria-labelledby="conclude-title" style="background:rgba(0,0,0,.45)">
        <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
          <div class="modal-header"><h2 class="modal-title h5" id="conclude-title">Concludere il check-in?</h2></div>
          <div class="modal-body"><p>{{ checkedInCount() }} presenti su {{ candidateCount() }}.</p><p class="mb-0">Gli altri risulteranno assenti. Dopo la conclusione non sarà più possibile registrare presenze.</p></div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary" type="button" (click)="concludeModalOpen.set(false)">Continua il check-in</button>
            <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="confirmConcludeCheckin()">Concludi check-in</button>
          </div>
        </div></div>
      </div>
    }
      </app-actions-panel>
    }
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
  readonly candidateCount = input(0);
  readonly checkedInCount = input(0);
  readonly openResetCount = input(0);
  readonly changed = output<void>();

  private readonly api = inject(ApiClient);
  readonly error = signal('');
  readonly success = signal('');
  readonly warning = signal('');
  readonly busy = signal(false);
  readonly operationMessage = signal('Operazione in corso... non chiudere la pagina.');
  readonly mergedConfig = signal<MergedConfig | null>(null);
  readonly latestList = signal<ListSummary | null>(null);
  readonly expertOptions = signal<string[]>([]);
  readonly concludeModalOpen = signal(false);
  readonly resetSoundEnabled = signal(loadResetSoundPreference());
  private readonly originalDocumentTitle = typeof document === 'undefined' ? '' : document.title;
  private lastOpenResetCount = 0;

  panelTitle(): string {
    const state = this.currentState() ?? '';
    const profile = this.viewMode() === 'esperto' ? 'esperto' : 'segretario';
    return sessionStateAction(state, profile)?.title ?? 'Stato non riconosciuto';
  }

  sedeStatus(): string {
    return sessionStateAction(this.currentState() ?? '', 'sede')?.title ?? 'Stato non riconosciuto';
  }

  confirmConcludeCheckin(): void {
    this.concludeModalOpen.set(false);
    this.runAction('concludi_checkin');
  }

  sessionConfigModel = {
    email_esperto_remoto: '',
    nome_informatico_sede: '',
    email_informatico_sede: '',
    telefono_informatico_sede: '',
    informatici_sede: [] as SedeTechnician[],
  };

  ngOnInit(): void {
    this.loadContextData();
  }

  ngOnChanges(): void {
    this.loadContextData();
    if (this.viewMode() === 'esperto') {
      const count = this.openResetCount();
      if (typeof document !== 'undefined') document.title = count > 0 ? `(${count}) ${this.originalDocumentTitle}` : this.originalDocumentTitle;
      if (count > this.lastOpenResetCount && this.lastOpenResetCount >= 0 && this.resetSoundEnabled()) this.playResetSound();
      this.lastOpenResetCount = count;
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined' && this.viewMode() === 'esperto') document.title = this.originalDocumentTitle;
  }

  setResetSoundEnabled(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.resetSoundEnabled.set(enabled);
    try { localStorage.setItem('checkin.resetSoundEnabled', String(enabled)); } catch { /* Storage can be disabled by the browser. */ }
  }

  private playResetSound(): void {
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.04;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.16);
      oscillator.onended = () => void context.close();
    } catch { /* Audio is optional and can be unavailable until a user gesture. */ }
  }

  private loadContextData(): void {
    const modeParam = encodeURIComponent(this.viewMode());
    const commissionId = this.commissionId();
    if (this.currentState() === 'iniziale') {
      this.api.get<Record<string, any>>(`/sessioni/${this.sessionId()}/config?mode=${modeParam}`).subscribe((data) => {
        this.sessionConfigModel = {
          email_esperto_remoto: data['email_esperto_remoto'] ?? '',
          nome_informatico_sede: data['nome_informatico_sede'] ?? '',
          email_informatico_sede: data['email_informatico_sede'] ?? '',
          telefono_informatico_sede: data['telefono_informatico_sede'] ?? '',
          informatici_sede: (data['informatici_sede'] as unknown as SedeTechnician[]) ?? [],
        };
      });
      if (!commissionId) return;
      this.api.get<Record<string, any>>(`/bandi/${commissionId}/config?mode=${modeParam}`).subscribe((data) => {
        this.expertOptions.set(data['expert_options'] ?? []);
      });
    }
    if (this.currentState() === 'configurata') {
      if (!commissionId) return;
      this.api.get<MergedConfig>(`/bandi/${commissionId}/config?mode=${modeParam}`).subscribe((bando) => {
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
    this.success.set('');
    this.warning.set('');
    const validationError = this.sessionConfigValidationError();
    if (validationError) {
      this.error.set(validationError);
      return;
    }
    this.startBusy('Salvataggio configurazione in corso...');
    const modeParam = encodeURIComponent(this.viewMode());
    this.api.put(`/sessioni/${this.sessionId()}/config?mode=${modeParam}`, this.sessionConfigPayload()).subscribe({
      next: () => { this.stopBusy(); this.success.set('Configurazione sessione salvata correttamente.'); this.changed.emit(); },
      error: (err) => { this.stopBusy(); this.error.set(this.extractError(err)); },
    });
  }

  canSaveSessionConfig(): boolean {
    return !!this.trimmed(this.sessionConfigModel.email_esperto_remoto)
      && !!this.trimmed(this.sessionConfigModel.email_informatico_sede);
  }

  importCandidati(): void {
    if (this.adminOnly()) {
      this.error.set('Scarica candidati richiede che il tuo utente sia segretario abilitato su Selezioni Online per questo bando.');
      return;
    }
    this.error.set('');
    this.success.set('');
    this.warning.set('');
    this.startBusy('Importazione candidati in corso...');
    this.api.post(`/sessioni/${this.sessionId()}/candidati/import?mode=${encodeURIComponent(this.viewMode())}`).subscribe({
      next: () => { this.stopBusy(); this.success.set('Lista candidati importata correttamente.'); this.changed.emit(); },
      error: (err) => { this.stopBusy(); this.error.set(this.extractError(err)); },
    });
  }

  runAction(action: string, confirmation?: string): void {
    if (confirmation && !window.confirm(confirmation)) return;
    this.error.set('');
    this.success.set('');
    this.warning.set('');
    this.startBusy('Aggiornamento stato in corso...');
    this.api.post(`/sessioni/${this.sessionId()}/actions/${action}?mode=${encodeURIComponent(this.viewMode())}`).subscribe({
      next: () => { this.stopBusy(); this.changed.emit(); },
      error: (err) => { this.stopBusy(); this.error.set(this.extractError(err)); },
    });
  }

  generaListe(): void {
    this.error.set('');
    this.success.set('');
    this.warning.set('');
    this.startBusy('Generazione liste candidati in corso...');
    this.api.post<ListSummary>(`/sessioni/${this.sessionId()}/lists/generate?mode=${encodeURIComponent(this.viewMode())}`).subscribe({
      next: (item) => {
        this.stopBusy();
        this.latestList.set(item);
        this.success.set(item.message || 'Liste candidati generate correttamente.');
        this.changed.emit();
      },
      error: (err) => { this.stopBusy(); this.error.set(this.extractError(err)); },
    });
  }

  inviaListe(): void {
    this.error.set('');
    this.success.set('');
    this.warning.set('');
    this.startBusy('Invio liste candidati all’esperto remoto in corso...');
    this.api.post<ListSendResult>(`/sessioni/${this.sessionId()}/lists/send?mode=${encodeURIComponent(this.viewMode())}`).subscribe({
      next: (result) => {
        this.stopBusy();
        const recipients = result.recipients?.length
          ? ` Destinatario: ${result.recipients.join(', ')}.`
          : '';
        this.success.set((result.message || 'Liste candidati inviate correttamente.') + recipients);
        if (result.warning) {
          this.warning.set(`Email non inviata: ${result.warning}. L'esperto remoto può comunque vedere e scaricare le liste dalla propria area personale.`);
        }
        if (result.email_status) {
          this.latestList.update((item) => (item ? { ...item, email_status: result.email_status } : item));
        }
        this.changed.emit();
      },
      error: (err) => { this.stopBusy(); this.error.set(this.extractError(err)); },
    });
  }

  private startBusy(message: string): void {
    this.operationMessage.set(message);
    this.busy.set(true);
  }

  private stopBusy(): void {
    this.busy.set(false);
    this.operationMessage.set('Operazione in corso... non chiudere la pagina.');
  }

  private extractError(err: unknown): string {
    const body = (err as { error?: { error?: { message?: string; details?: Record<string, string> } } })?.error?.error;
    if (!body) return 'Operazione non riuscita.';
    const details = body.details ? Object.entries(body.details).map(([field, msg]) => `${field}: ${msg}`).join('; ') : '';
    return details ? `${body.message} (${details})` : body.message || 'Operazione non riuscita.';
  }

  private sessionConfigValidationError(): string {
    const missing = [];
    if (!this.trimmed(this.sessionConfigModel.email_esperto_remoto)) {
      missing.push("l'esperto remoto");
    }
    if (!this.trimmed(this.sessionConfigModel.email_informatico_sede)) {
      missing.push("l'email dell'informatico in sede");
    }
    return missing.length
      ? `Per proseguire devi compilare ${missing.join(' e ')}.`
      : '';
  }

  private trimmed(value: string | null | undefined): string {
    return (value ?? '').trim();
  }

  private sessionConfigPayload(): Record<string, unknown> {
    const primarySede = {
      nome: this.sessionConfigModel.nome_informatico_sede,
      email: this.sessionConfigModel.email_informatico_sede,
      telefono: this.sessionConfigModel.telefono_informatico_sede,
      principale: true,
    };
    const informaticiSede = [
      primarySede,
      ...this.sessionConfigModel.informatici_sede.filter((item) =>
        this.trimmed(item.email) !== this.trimmed(primarySede.email)
      ),
    ].filter((item) => this.trimmed(item.nome) || this.trimmed(item.email) || this.trimmed(item.telefono));
    return {
      ...this.sessionConfigModel,
      informatici_sede: informaticiSede,
    };
  }
}

function loadResetSoundPreference(): boolean {
  try { return localStorage.getItem('checkin.resetSoundEnabled') === 'true'; }
  catch { return false; }
}
