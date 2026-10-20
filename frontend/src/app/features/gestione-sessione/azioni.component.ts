import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, Injector, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ItIconComponent } from 'design-angular-kit';
import { ApiClient } from '../../core/api-client';
import { ListSendResult, ListSummary, WorkflowState } from '../../core/models/api.models';
import { ActionsPanelComponent } from '../../shared/actions-panel.component';
import { InPageLinkDirective } from '../../shared/in-page-link.directive';
import { sessionStateAction, sessionStateInfo } from '../../shared/session-states';
import { DevicesPanelComponent } from '../dispositivi/devices-panel.component';
import { ListFilesComponent } from './list-files.component';
import { SessionReferences } from './session-references.component';

interface SedeTechnician {
  nome?: string;
  email?: string;
  telefono?: string;
  principale?: boolean;
}

interface Confirmation {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
  action: string;
}

const PHASE_NAMES = ['Preparazione', 'Check-in', 'Liste', 'Esame'];
const LIST_STATES = ['liste_generate', 'liste_inviate', 'lista_presenti_aggiornata_su_moodle', 'avvia_esame', 'esame_in_corso', 'esame_concluso'];
const AFTER_LISTS_SENT = LIST_STATES.slice(1);
const FROM_CHECKIN = ['checkin_avviato', 'checkin_concluso', ...LIST_STATES];
/** Stati in cui l'informatico in sede vede la sezione di riserva "Azioni del segretario" (contracts/ui-session-states.md). */
const SECRETARY_BACKUP_STATES = ['candidati_scaricati', 'dispositivi_connessi', 'checkin_avviato', 'checkin_concluso', 'liste_generate'];

/**
 * Pannello "Azioni · cosa fare adesso" della pagina sessione, per stato e
 * profilo come in specs/013-revisione-ui-design/contracts/ui-session-states.md
 * e nei prototipi docs/design-revisione/prototipo/sessione-*.html.
 * Le azioni dirette passano da /actions/<azione>; configurazione, scarico
 * candidati e liste usano i rispettivi endpoint.
 */
@Component({
  selector: 'app-azioni',
  imports: [FormsModule, NgTemplateOutlet, RouterLink, ItIconComponent, ActionsPanelComponent, DevicesPanelComponent, ListFilesComponent, InPageLinkDirective],
  template: `
    @if (currentState(); as state) {
      @switch (viewMode()) {
        @case ('esperto') { <ng-container *ngTemplateOutlet="esperto; context: { $implicit: state }" /> }
        @case ('sede') {
          <ng-container *ngTemplateOutlet="sede; context: { $implicit: state }" />
          @if (secretaryBackup(state)) {
            <details class="card card-bg no-after app-backup" (toggle)="onBackupToggle($event)">
              <summary class="card-body py-3 fw-semibold">Azioni del segretario
                <span class="fw-normal text-secondary small d-block">Da usare solo se il segretario non riesce a proseguire: risulti tu nella timeline.</span>
              </summary>
              <div class="card-body pt-0">
                <ng-container *ngTemplateOutlet="segretario; context: { $implicit: state, nested: true }" />
              </div>
            </details>
          }
        }
        @default { <ng-container *ngTemplateOutlet="segretario; context: { $implicit: state, nested: false }" /> }
      }
    }

    <!-- Segretario (e amministratore in vista di supporto) -->
    <ng-template #segretario let-state let-nested="nested">
      @switch (state) {
        @case ('iniziale') {
          <app-actions-panel etichetta="Passo 1 di 3 · Preparazione" titolo="Chi ti aiuta in questa sessione?"
            [nota]="canSaveSessionConfig() ? 'Poi scarichi i candidati da Selezioni Online.' : 'Indica l’esperto remoto e l’email dell’informatico in sede per continuare.'"
            [inCorso]="busy()" [messaggioInCorso]="operationMessage()" [intestazione]="!nested">
            <p class="text-secondary">Servono l’esperto remoto, che apre la prova su Moodle, e l’informatico in sede, che è in aula con te.
              @if (bandoConfigured()) { Gli altri dati del bando sono già a posto. }</p>
            @if (!bandoConfigured()) {
              <div class="alert alert-warning" role="status">Alcuni dati del bando non sono ancora completi. Puoi proseguire: il referente li completa da “Configura bando”.</div>
            }
            <form id="session-config-form" (ngSubmit)="saveSessionConfig()">
              <div class="row g-3 mb-2">
                <div class="col-12 col-md-7">
                  @if (expertOptions().length) {
                    <div class="select-wrapper">
                      <label for="email_esperto_remoto">Esperto remoto</label>
                      <select id="email_esperto_remoto" name="email_esperto_remoto" [(ngModel)]="sessionConfigModel.email_esperto_remoto" required>
                        <option value="">Scegli dall’elenco…</option>
                        @for (email of expertOptions(); track email) { <option [value]="email">{{ email }}</option> }
                      </select>
                    </div>
                  } @else {
                    <div class="form-group mb-0">
                      <label for="email_esperto_remoto" class="active">Email dell’esperto remoto</label>
                      <input type="email" class="form-control" id="email_esperto_remoto" name="email_esperto_remoto" [(ngModel)]="sessionConfigModel.email_esperto_remoto" required />
                    </div>
                  }
                </div>
              </div>
              <fieldset>
                <legend class="h6 mt-2 mb-4">Informatico in sede</legend>
                <div class="row g-3">
                  <div class="col-12 col-md-4"><div class="form-group mb-0"><label for="nome_informatico_sede" class="active">Nome e cognome</label>
                    <input type="text" class="form-control" id="nome_informatico_sede" name="nome_informatico_sede" [(ngModel)]="sessionConfigModel.nome_informatico_sede" /></div></div>
                  <div class="col-12 col-md-4"><div class="form-group mb-0"><label for="email_informatico_sede" class="active">Email (obbligatoria)</label>
                    <input type="email" class="form-control" id="email_informatico_sede" name="email_informatico_sede" [(ngModel)]="sessionConfigModel.email_informatico_sede" required /></div></div>
                  <div class="col-12 col-md-4"><div class="form-group mb-0"><label for="telefono_informatico_sede" class="active">Telefono</label>
                    <input type="tel" class="form-control" id="telefono_informatico_sede" name="telefono_informatico_sede" [(ngModel)]="sessionConfigModel.telefono_informatico_sede" /></div></div>
                </div>
              </fieldset>
            </form>
            <ng-container *ngTemplateOutlet="esiti" />
            <button azione type="submit" form="session-config-form" class="btn btn-primary btn-lg" [disabled]="busy() || !canSaveSessionConfig()">Salva e continua</button>
          </app-actions-panel>
        }
        @case ('configurata') {
          <app-actions-panel etichetta="Passo 2 di 3 · Preparazione" titolo="Scarica i candidati"
            [nota]="adminOnly() ? 'Lo scarico richiede un segretario della commissione: da amministratore non è disponibile.' : 'Al termine l’elenco compare qui sotto.'"
            [inCorso]="busy()" messaggioInCorso="Sto scaricando i candidati da Selezioni Online…" notaInCorso="Non chiudere la pagina. Di solito servono meno di 30 secondi." [intestazione]="!nested">
            <p class="text-secondary mb-0">Prendiamo da Selezioni Online l’elenco dei candidati convocati a questa sessione, con i dati del documento. Usa le tue credenziali di segretario.</p>
            @if (adminOnly()) {
              <div class="alert alert-warning mt-3 mb-0" role="status">Stai aprendo questa sessione solo come amministratore locale: lo scarico dei candidati richiede una relazione operativa con la commissione.</div>
            }
            <ng-container *ngTemplateOutlet="esiti" />
            <button azione type="button" class="btn btn-primary btn-lg btn-icon gap-2" [disabled]="busy() || adminOnly()" (click)="importCandidati()">
              <it-icon name="download" color="white" /><span>Scarica candidati</span>
            </button>
          </app-actions-panel>
        }
        @case ('candidati_scaricati') { <ng-container *ngTemplateOutlet="dispositivi; context: { $implicit: state, nested }" /> }
        @case ('dispositivi_connessi') { <ng-container *ngTemplateOutlet="dispositivi; context: { $implicit: state, nested }" /> }
        @case ('checkin_avviato') {
          @if (compatto() && !nested) {
            <!-- Smartphone (P08): contatore ed elenco di chi manca sono già sopra, qui resta la conclusione. -->
            <ng-container *ngTemplateOutlet="esiti" />
            <button type="button" class="btn btn-outline-primary w-100" [disabled]="busy()" (click)="askConcludeCheckin()">Concludi check-in…</button>
          } @else {
          <app-actions-panel [etichetta]="'Fase 2 · Check-in in corso' + (stateTime('checkin_avviato') ? ' dalle ' + stateTime('checkin_avviato') : '')"
            titolo="Registra le presenze" nota="Chiede conferma: dopo non si può riaprire." [inCorso]="busy()" [messaggioInCorso]="operationMessage()" [intestazione]="!nested">
            <ng-container *ngTemplateOutlet="contatore" />
            <p class="mb-0 small text-secondary"><span class="app-dot app-dot--ok" aria-hidden="true"></span>
              {{ deviceCount() === 1 ? '1 scanner collegato' : deviceCount() + ' scanner collegati' }}
              @if (!nested) { · <button type="button" class="btn btn-link p-0 align-baseline small" [attr.aria-expanded]="showDevices()" (click)="showDevices.set(!showDevices())">collega un altro dispositivo</button> }</p>
            @if (showDevices() && !nested) { <div class="mt-3"><app-devices-panel [sessionId]="sessionId()" [mode]="viewMode()" /></div> }
            @if (nested) { <p class="small text-secondary mt-2 mb-0">Con questa sezione aperta puoi segnare le presenze dalla tabella Candidati.</p> }
            <ng-container *ngTemplateOutlet="esiti" />
            <button azione type="button" class="btn btn-primary btn-lg" [disabled]="busy()" (click)="askConcludeCheckin()">Concludi check-in</button>
          </app-actions-panel>
          }
        }
        @case ('checkin_concluso') {
          <app-actions-panel etichetta="Fase 3 · Liste" titolo="Genera le liste dei presenti"
            [nota]="checkedInCount() + ' presenti · ' + absentCount() + (absentCount() === 1 ? ' assente' : ' assenti')"
            [inCorso]="busy()" messaggioInCorso="Sto generando le liste…" notaInCorso="Non chiudere la pagina. Può servire fino a un minuto." [intestazione]="!nested">
            <p class="text-secondary mb-0">Creiamo il file Excel dei presenti e il CSV per Moodle. Potrai scaricarli prima di inviarli.</p>
            <ng-container *ngTemplateOutlet="esiti" />
            <button azione type="button" class="btn btn-primary btn-lg" [disabled]="busy()" (click)="generaListe()">Genera liste</button>
          </app-actions-panel>
        }
        @case ('liste_generate') {
          <app-actions-panel etichetta="Fase 3 · Liste" titolo="Invia le liste all’esperto remoto" nota="Controlla i file se vuoi, poi invia."
            [inCorso]="busy()" messaggioInCorso="Sto inviando le liste all’esperto remoto…" [intestazione]="!nested">
            <p class="text-secondary">Le mandiamo per email a <strong class="text-body">{{ references().email_esperto_remoto || 'l’esperto remoto' }}</strong>, con te in copia.</p>
            @if (latestList()) { <app-list-files [list]="latestList()" /> } @else { <p class="text-secondary mb-0">Carico i file della sessione…</p> }
            <ng-container *ngTemplateOutlet="esiti" />
            <button azione type="button" class="btn btn-primary btn-lg" [disabled]="busy() || !latestList()" (click)="inviaListe()">Invia liste</button>
          </app-actions-panel>
        }
        @default {
          <app-actions-panel [etichetta]="secretaryDoneEyebrow(state)" [titolo]="secretaryDoneTitle(state)"
            nota="I file restano scaricabili anche dopo l’aggiornamento di Moodle." [intestazione]="!nested">
            @if (state === 'liste_inviate' || state === 'lista_presenti_aggiornata_su_moodle') {
              <div class="callout success mt-0 mb-4"><div class="callout-title"><it-icon name="check-circle" color="success" /><span class="text">Hai finito la tua parte</span></div>
                <p class="mb-0">L’esperto remoto prepara Moodle e avvia l’esame: vedrai gli stati avanzare nella timeline.</p></div>
            } @else if (state === 'avvia_esame') {
              <div class="alert alert-info mb-4" role="status">L’ambiente d’esame è pronto su Moodle. L’esperto remoto avvia la prova quando la commissione autorizza.</div>
            } @else if (state === 'esame_in_corso') {
              <p class="text-secondary mb-4">I candidati stanno svolgendo la prova. L’esperto remoto la conclude allo scadere del tempo.</p>
            } @else if (state === 'esame_concluso') {
              <p class="text-secondary mb-4">La prova è terminata. Non ci sono altre azioni per questa sessione.</p>
            }
            <ng-container *ngTemplateOutlet="esiti" />
            @if (latestList()) { <app-list-files [list]="latestList()" titolo="File della sessione" [esitoEmail]="true" /> }
            <a azione class="btn btn-outline-primary" [routerLink]="['/bandi', commissionId(), 'sessioni']" [queryParams]="{ mode: viewMode() }">Torna alle sessioni</a>
          </app-actions-panel>
        }
      }
    </ng-template>

    <ng-template #dispositivi let-state let-nested="nested">
      <app-actions-panel etichetta="Passo 3 di 3 · Preparazione" titolo="Collega gli smartphone che useranno come scanner"
        [nota]="nested ? 'Il check-in si avvia quando almeno un telefono è collegato.' : ''" [inCorso]="busy()" [messaggioInCorso]="operationMessage()" [intestazione]="!nested">
        @if (!nested) { <app-devices-panel [sessionId]="sessionId()" [mode]="viewMode()" /> }
        <ng-container *ngTemplateOutlet="esiti" />
        <span nota>
          @if (!nested) {
            @if (state === 'dispositivi_connessi') {
              <strong class="text-success">Tutto pronto:</strong> {{ deviceCount() === 1 ? '1 dispositivo' : deviceCount() + ' dispositivi' }}, {{ candidateCount() === 1 ? '1 candidato' : candidateCount() + ' candidati' }}. Puoi collegarne altri anche dopo.
            } @else { Collega almeno un dispositivo per avviare il check-in. }
          }
        </span>
        <button azione type="button" class="btn btn-primary btn-lg" [disabled]="busy() || state !== 'dispositivi_connessi'" (click)="runAction('avvia_checkin')">Avvia check-in</button>
      </app-actions-panel>
    </ng-template>

    <!-- Informatico in sede -->
    <ng-template #sede let-state>
      @if (state === 'iniziale' || state === 'configurata') {
        <app-actions-panel etichetta="Informatico in sede · in aula" titolo="In attesa che il segretario prepari la sessione"
          nota="Quando i candidati sono scaricati, qui colleghi gli smartphone che useranno come scanner.">
          <p class="text-secondary mb-0">Il segretario indica chi lo aiuta e scarica i candidati da Selezioni Online. Puoi seguire l’avanzamento nella timeline.</p>
        </app-actions-panel>
      } @else if (state === 'candidati_scaricati' || state === 'dispositivi_connessi') {
        <app-actions-panel etichetta="Informatico in sede · in aula" titolo="Collega gli smartphone che useranno come scanner"
          nota="Il segretario avvia il check-in quando i telefoni sono collegati.">
          <app-devices-panel [sessionId]="sessionId()" [mode]="viewMode()" />
        </app-actions-panel>
      } @else {
        <app-actions-panel etichetta="Informatico in sede · in aula" titolo="Segnala chi non riesce ad accedere"
          [nota]="state === 'checkin_avviato' ? 'Puoi anche collegare smartphone come scanner.' : 'Le richieste restano possibili fino alla fine dell’esame.'">
          <p class="text-secondary mb-2">Se un candidato non riesce ad accedere a Moodle, premi <strong class="text-body">Serve reset password</strong> sulla sua riga nella tabella Candidati qui sotto. L’esperto remoto riceve la richiesta; quando l’ha risolta vedi “Reset fatto”. Il reset si chiede dalla riga del candidato.</p>
          <p class="mb-0"><span class="badge app-badge-warning">{{ openResetCount() === 1 ? '1 richiesta in attesa' : openResetCount() + ' richieste in attesa' }}</span> <a href="#cand" appInPageLink="cand" class="ms-2 fw-semibold">Vai ai candidati</a></p>
          @if (showDevices() && state === 'checkin_avviato') { <div class="mt-3"><app-devices-panel [sessionId]="sessionId()" [mode]="viewMode()" /></div> }
          @if (state === 'checkin_avviato') {
            <button azione type="button" class="btn btn-outline-primary" [attr.aria-expanded]="showDevices()" (click)="showDevices.set(!showDevices())">{{ showDevices() ? 'Chiudi collegamento' : 'Collega un dispositivo' }}</button>
          }
        </app-actions-panel>
      }
    </ng-template>

    <!-- Esperto remoto -->
    <ng-template #esperto let-state>
      <app-actions-panel [etichetta]="'Esperto remoto · fase ' + phaseName(state)" [titolo]="expertTitle(state)" [nota]="expertNote(state)"
        [inCorso]="busy()" [messaggioInCorso]="operationMessage()">
        <p class="text-secondary">{{ expertText(state) }}</p>
        @if (fromCheckin(state)) {
          <p class="mb-3"><span class="badge app-badge-warning">{{ openResetCount() === 1 ? '1 reset password da fare' : openResetCount() + ' reset password da fare' }}</span> <a href="#cand" appInPageLink="cand" class="ms-2 fw-semibold">Vai ai candidati</a>
            <br><span class="small text-secondary">Per ogni nuova richiesta ti avvisiamo nel browser e via email.</span></p>
          <div class="form-check mb-3">
            <input class="form-check-input" id="reset-sound" type="checkbox" [checked]="resetSoundEnabled()" (change)="setResetSoundEnabled($event)" />
            <label class="form-check-label" for="reset-sound">Avviso sonoro per le nuove richieste</label>
          </div>
        }
        @if (latestList() && (state === 'liste_generate' || afterListsSent(state))) {
          <app-list-files [list]="latestList()" [titolo]="afterListsSent(state) && stateTime('liste_inviate') ? 'Liste ricevute alle ' + stateTime('liste_inviate') : 'File della sessione'" />
        }
        <ng-container *ngTemplateOutlet="esiti" />
        @if (expertAction(state); as action) {
          <button azione type="button" class="btn btn-primary btn-lg" [disabled]="busy()" (click)="askExpertAction(state)">{{ action }}</button>
        }
      </app-actions-panel>
    </ng-template>

    <ng-template #contatore>
      <p class="app-counter mb-2"><strong>{{ checkedInCount() }}</strong>&ngsp;<span>/ {{ candidateCount() }} presenti</span></p>
      <div class="progress app-progress mb-2">
        <div class="progress-bar" role="progressbar" [style.width.%]="presentPercent()" [attr.aria-valuenow]="presentPercent()" aria-valuemin="0" aria-valuemax="100" aria-label="Presenti sul totale"></div>
      </div>
    </ng-template>

    <ng-template #esiti>
      @if (success()) { <div class="alert alert-success mt-3 mb-0" role="status">{{ success() }}</div> }
      @if (warning()) { <div class="alert alert-warning mt-3 mb-0" role="status">{{ warning() }}</div> }
      @if (error()) { <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div> }
    </ng-template>

    @if (confirmation(); as dialog) {
      <div class="modal d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="confirm-title" style="background: rgba(0,0,0,.45)"
        (keydown.escape)="confirmation.set(null)">
        <div class="modal-dialog modal-dialog-centered" role="document"><div class="modal-content">
          <div class="modal-header"><h2 class="modal-title h5" id="confirm-title">{{ dialog.title }}</h2></div>
          <div class="modal-body"><p class="mb-0" [innerHTML]="dialog.body"></p></div>
          <div class="modal-footer">
            <button #confirmCancel class="btn btn-outline-secondary btn-sm" type="button" (click)="confirmation.set(null)">{{ dialog.cancel }}</button>
            <button class="btn btn-primary btn-sm" type="button" [disabled]="busy()" (click)="confirm(dialog)">{{ dialog.confirm }}</button>
          </div>
        </div></div>
      </div>
    }
  `,
  styles: `
    .app-backup > summary { cursor: pointer; list-style-position: inside; }
    .app-backup[open] > summary { border-bottom: 1px solid var(--app-line); margin-bottom: 1rem; }
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
  readonly history = input<WorkflowState['history']>([]);
  readonly references = input<SessionReferences>({});
  /** Vista smartphone: durante il check-in mostra solo "Concludi check-in…". */
  readonly compatto = input(false);
  readonly changed = output<void>();
  /** L'informatico in sede ha aperto "Azioni del segretario": la tabella passa alla registrazione presenze. */
  readonly secretaryActionsOpen = output<boolean>();

  private readonly api = inject(ApiClient);
  private readonly injector = inject(Injector);
  private readonly confirmCancel = viewChild<ElementRef<HTMLButtonElement>>('confirmCancel');
  readonly error = signal('');
  readonly success = signal('');
  readonly warning = signal('');
  readonly busy = signal(false);
  readonly operationMessage = signal('Operazione in corso…');
  readonly latestList = signal<ListSummary | null>(null);
  readonly expertOptions = signal<string[]>([]);
  readonly confirmation = signal<Confirmation | null>(null);
  readonly showDevices = signal(false);
  readonly resetSoundEnabled = signal(loadResetSoundPreference());
  private readonly originalDocumentTitle = typeof document === 'undefined' ? '' : document.title;
  private lastOpenResetCount = -1;
  private loadedState: string | null = null;

  sessionConfigModel = {
    email_esperto_remoto: '',
    nome_informatico_sede: '',
    email_informatico_sede: '',
    telefono_informatico_sede: '',
    informatici_sede: [] as SedeTechnician[],
  };

  ngOnChanges(): void {
    // I dati di contesto si ricaricano solo al cambio di stato: il polling della
    // pagina aggiorna spesso gli input e non deve azzerare il modulo in compilazione.
    const state = this.currentState();
    if (state && state !== this.loadedState) {
      this.loadedState = state;
      this.showDevices.set(false);
      this.loadContextData(state);
    }
    if (this.viewMode() === 'esperto') {
      const count = this.openResetCount();
      if (typeof document !== 'undefined') document.title = count > 0 ? `(${count}) ${this.originalDocumentTitle}` : this.originalDocumentTitle;
      if (this.lastOpenResetCount >= 0 && count > this.lastOpenResetCount && this.resetSoundEnabled()) this.playResetSound();
      this.lastOpenResetCount = count;
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined' && this.viewMode() === 'esperto') document.title = this.originalDocumentTitle;
  }

  secretaryBackup(state: string): boolean { return SECRETARY_BACKUP_STATES.includes(state); }
  fromCheckin(state: string): boolean { return FROM_CHECKIN.includes(state); }
  afterListsSent(state: string): boolean { return AFTER_LISTS_SENT.includes(state); }
  phaseName(state: string): string { return PHASE_NAMES[sessionStateInfo(state).phase - 1]; }
  absentCount(): number { return Math.max(0, this.candidateCount() - this.checkedInCount()); }
  presentPercent(): number { return this.candidateCount() ? Math.round((this.checkedInCount() / this.candidateCount()) * 100) : 0; }

  /** Ora (HH:MM) in cui la sessione è entrata nello stato, dalla timeline. */
  stateTime(state: string): string {
    const at = this.history()?.find((item) => item.state === state)?.at;
    if (!at) return '';
    const date = new Date(at);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  secretaryDoneEyebrow(state: string): string {
    if (state === 'liste_inviate') return 'Fase 3 · Liste inviate' + (this.stateTime('liste_inviate') ? ` alle ${this.stateTime('liste_inviate')}` : '');
    return sessionStateInfo(state).phase === 4 ? 'Fase 4 · Esame · a cura dell’esperto remoto' : '';
  }

  secretaryDoneTitle(state: string): string {
    if (state === 'liste_inviate' || state === 'lista_presenti_aggiornata_su_moodle') return 'Nessuna azione da fare';
    return sessionStateAction(state, 'segretario')?.title ?? 'Stato non riconosciuto';
  }

  expertTitle(state: string): string { return sessionStateAction(state, 'esperto')?.title ?? 'Stato non riconosciuto'; }
  expertAction(state: string): string | undefined { return sessionStateAction(state, 'esperto')?.action; }

  expertText(state: string): string {
    switch (state) {
      case 'liste_generate': return 'Il segretario ha generato le liste: puoi già scaricarle. In attesa che il segretario le invii.';
      case 'liste_inviate': return 'Scarica il CSV degli utenti Moodle e caricalo sulla piattaforma d’esame, poi conferma qui.';
      case 'lista_presenti_aggiornata_su_moodle': return 'I presenti sono su Moodle. Prepara l’ambiente d’esame e conferma quando è pronto: il segretario lo vede nella timeline.';
      case 'avvia_esame': return 'I presenti sono su Moodle e l’ambiente è pronto. Quando la commissione autorizza, avvia la prova: i candidati potranno iniziare.';
      case 'esame_in_corso': return 'I candidati stanno svolgendo la prova. Concludila allo scadere del tempo.';
      case 'esame_concluso': return 'La prova è terminata. Non ci sono altre azioni per questa sessione.';
      default: return 'Ti avvisiamo per email quando il segretario invia le liste dei presenti. Intanto puoi seguire l’avanzamento nella timeline.';
    }
  }

  expertNote(state: string): string {
    switch (state) {
      case 'liste_inviate': return 'Dopo la conferma prepari l’ambiente d’esame.';
      case 'lista_presenti_aggiornata_su_moodle': return 'Poi avvii la prova.';
      case 'avvia_esame': return 'Dopo l’avvio lo stato passa a “Esame in corso”.';
      case 'esame_in_corso': return 'Chiede conferma: dopo non si può riaprire.';
      default: return '';
    }
  }

  askConcludeCheckin(): void {
    const present = this.checkedInCount();
    const total = this.candidateCount();
    this.confirmation.set({
      title: 'Concludere il check-in?',
      body: `<strong>${present} ${present === 1 ? 'candidato' : 'candidati'} su ${total}</strong> ${present === 1 ? 'risulta presente' : 'risultano presenti'}. Gli altri saranno considerati assenti.<br>Dopo la conclusione non si possono più registrare presenze. Il passo successivo è generare le liste per l’esperto remoto.`,
      confirm: 'Concludi check-in',
      cancel: 'Continua il check-in',
      action: 'concludi_checkin',
    });
    this.focusDialog();
  }

  askExpertAction(state: string): void {
    const dialogs: Record<string, Omit<Confirmation, 'cancel'>> = {
      liste_inviate: { title: 'Presenti caricati su Moodle?', body: 'Conferma di avere aggiornato su Moodle l’elenco dei candidati presenti. Il passaggio non si può annullare.', confirm: 'Lista presenti aggiornata', action: 'aggiorna_presenti_moodle' },
      lista_presenti_aggiornata_su_moodle: { title: 'Ambiente d’esame pronto?', body: 'Il segretario vedrà che l’ambiente d’esame è pronto. Il passaggio non si può annullare.', confirm: 'Ambiente pronto', action: 'avvia_esame' },
      avvia_esame: { title: 'Iniziare l’esame?', body: 'I candidati potranno iniziare la prova. Il passaggio non si può annullare.', confirm: 'Inizia esame', action: 'inizia_esame' },
      esame_in_corso: { title: 'Concludere l’esame?', body: 'La prova risulterà conclusa per tutti i candidati. Il passaggio non si può annullare.', confirm: 'Concludi esame', action: 'concludi_esame' },
    };
    const dialog = dialogs[state];
    if (!dialog) return;
    this.confirmation.set({ ...dialog, cancel: 'Annulla' });
    this.focusDialog();
  }

  confirm(dialog: Confirmation): void {
    this.confirmation.set(null);
    this.runAction(dialog.action);
  }

  onBackupToggle(event: Event): void {
    this.secretaryActionsOpen.emit((event.target as HTMLDetailsElement).open);
  }

  setResetSoundEnabled(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.resetSoundEnabled.set(enabled);
    try { localStorage.setItem('checkin.resetSoundEnabled', String(enabled)); } catch { /* Archiviazione del browser non disponibile. */ }
  }

  saveSessionConfig(): void {
    this.clearMessages();
    const validationError = this.sessionConfigValidationError();
    if (validationError) {
      this.error.set(validationError);
      return;
    }
    this.startBusy('Salvo chi ti aiuta in questa sessione…');
    this.api.put(`/sessioni/${this.sessionId()}/config?mode=${this.mode()}`, this.sessionConfigPayload()).subscribe({
      next: () => { this.stopBusy(); this.success.set('Configurazione della sessione salvata.'); this.changed.emit(); },
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
    this.clearMessages();
    this.startBusy('Sto scaricando i candidati da Selezioni Online…');
    this.api.post(`/sessioni/${this.sessionId()}/candidati/import?mode=${this.mode()}`).subscribe({
      next: () => { this.stopBusy(); this.success.set('Candidati scaricati da Selezioni Online.'); this.changed.emit(); },
      error: (err) => { this.stopBusy(); this.error.set(this.extractError(err)); },
    });
  }

  runAction(action: string): void {
    this.clearMessages();
    this.startBusy('Aggiorno lo stato della sessione…');
    this.api.post(`/sessioni/${this.sessionId()}/actions/${action}?mode=${this.mode()}`).subscribe({
      next: () => { this.stopBusy(); this.changed.emit(); },
      error: (err) => { this.stopBusy(); this.error.set(this.extractError(err)); },
    });
  }

  generaListe(): void {
    this.clearMessages();
    this.startBusy('Sto generando le liste…');
    this.api.post<ListSummary>(`/sessioni/${this.sessionId()}/lists/generate?mode=${this.mode()}`).subscribe({
      next: (item) => {
        this.stopBusy();
        this.latestList.set(item);
        this.success.set(item.message || 'Liste dei presenti generate.');
        this.changed.emit();
      },
      error: (err) => { this.stopBusy(); this.error.set(this.extractError(err)); },
    });
  }

  inviaListe(): void {
    this.clearMessages();
    this.startBusy('Sto inviando le liste all’esperto remoto…');
    this.api.post<ListSendResult>(`/sessioni/${this.sessionId()}/lists/send?mode=${this.mode()}`).subscribe({
      next: (result) => {
        this.stopBusy();
        const recipients = result.recipients?.length ? ` Destinatario: ${result.recipients.join(', ')}.` : '';
        this.success.set((result.message || 'Liste candidati inviate correttamente.') + recipients);
        if (result.warning) {
          this.warning.set(`Email non inviata: ${result.warning}. L’esperto remoto può comunque vedere e scaricare le liste dalla propria area personale.`);
        }
        if (result.email_status) {
          this.latestList.update((item) => (item ? { ...item, email_status: result.email_status, email_error: result.warning ?? item.email_error } : item));
        }
        this.changed.emit();
      },
      error: (err) => { this.stopBusy(); this.error.set(this.extractError(err)); },
    });
  }

  private loadContextData(state: string): void {
    const commissionId = this.commissionId();
    if (state === 'iniziale') {
      this.api.get<Record<string, unknown>>(`/sessioni/${this.sessionId()}/config?mode=${this.mode()}`).subscribe((data) => {
        this.sessionConfigModel = {
          email_esperto_remoto: (data['email_esperto_remoto'] as string) ?? '',
          nome_informatico_sede: (data['nome_informatico_sede'] as string) ?? '',
          email_informatico_sede: (data['email_informatico_sede'] as string) ?? '',
          telefono_informatico_sede: (data['telefono_informatico_sede'] as string) ?? '',
          informatici_sede: (data['informatici_sede'] as SedeTechnician[]) ?? [],
        };
      });
      if (commissionId) {
        this.api.get<Record<string, unknown>>(`/bandi/${commissionId}/config?mode=${this.mode()}`).subscribe((data) => {
          this.expertOptions.set((data['expert_options'] as string[]) ?? []);
        });
      }
    }
    if (LIST_STATES.includes(state)) {
      this.api.get<ListSummary>(`/sessioni/${this.sessionId()}/lists/latest?mode=${this.mode()}`).subscribe({
        next: (item) => this.latestList.set(item),
        error: () => this.latestList.set(null),
      });
    }
  }

  /** Il focus va sulla scelta prudente della conferma appena compare. */
  private focusDialog(): void {
    afterNextRender(() => this.confirmCancel()?.nativeElement.focus(), { injector: this.injector });
  }

  private mode(): string { return encodeURIComponent(this.viewMode()); }

  private clearMessages(): void {
    this.error.set('');
    this.success.set('');
    this.warning.set('');
  }

  private startBusy(message: string): void {
    this.operationMessage.set(message);
    this.busy.set(true);
  }

  private stopBusy(): void {
    this.busy.set(false);
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
    } catch { /* Il suono è facoltativo e può non essere disponibile prima di un'interazione. */ }
  }

  private extractError(err: unknown): string {
    const body = (err as { error?: { error?: { message?: string; details?: Record<string, string> } } })?.error?.error;
    if (!body) return 'Operazione non riuscita.';
    const details = body.details ? Object.entries(body.details).map(([field, msg]) => `${field}: ${msg}`).join('; ') : '';
    return details ? `${body.message} (${details})` : body.message || 'Operazione non riuscita.';
  }

  private sessionConfigValidationError(): string {
    const missing = [];
    if (!this.trimmed(this.sessionConfigModel.email_esperto_remoto)) missing.push("l'esperto remoto");
    if (!this.trimmed(this.sessionConfigModel.email_informatico_sede)) missing.push("l'email dell'informatico in sede");
    return missing.length ? `Per proseguire devi compilare ${missing.join(' e ')}.` : '';
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
      ...this.sessionConfigModel.informatici_sede.filter((item) => this.trimmed(item.email) !== this.trimmed(primarySede.email)),
    ].filter((item) => this.trimmed(item.nome) || this.trimmed(item.email) || this.trimmed(item.telefono));
    return { ...this.sessionConfigModel, informatici_sede: informaticiSede };
  }
}

function loadResetSoundPreference(): boolean {
  try { return localStorage.getItem('checkin.resetSoundEnabled') === 'true'; }
  catch { return false; }
}
