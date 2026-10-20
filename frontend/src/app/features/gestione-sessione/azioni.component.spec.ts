import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';
import { ApiClient } from '../../core/api-client';
import { AzioniComponent } from './azioni.component';
import { provideKitForTests } from '../../../testing/kit';

interface ApiStub {
  get?: (url: string) => Observable<unknown>;
  post?: (url: string, body?: unknown) => Observable<unknown>;
  put?: (url: string, body?: unknown) => Observable<unknown>;
}

const LIST = { id: 1, session_id: 'session-1', num_presenti: 3, generato_da: 'seg@cnr.it', timestamp_creazione: '2026-10-20T14:44:00', downloads: { xlsx: '/x.xlsx', moodle_csv: '/m.csv' }, email_status: null };

async function render(state: string, viewMode: string, inputs: Record<string, unknown> = {}, api: ApiStub = {}) {
  await TestBed.configureTestingModule({
    imports: [AzioniComponent],
    providers: [
      provideRouter([]),
      ...provideKitForTests(),
      {
        provide: ApiClient,
        useValue: {
          get: api.get ?? ((url: string) => of(url.includes('/lists/latest') ? LIST : { expert_options: [] })),
          post: api.post ?? (() => of({ items: [] })),
          put: api.put ?? (() => of({})),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AzioniComponent);
  fixture.componentRef.setInput('sessionId', 'session-1');
  fixture.componentRef.setInput('commissionId', 'commission-1');
  fixture.componentRef.setInput('currentState', state);
  fixture.componentRef.setInput('viewMode', viewMode);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return { fixture, element, text: () => element.textContent ?? '' };
}

function primaryButtons(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('.app-next-footer .btn-primary')).map((button) => button.textContent?.trim() ?? '');
}

describe('AzioniComponent', () => {
  describe('segretario', () => {
    it('asks who helps in the session, with one primary action blocked until the required fields are set', async () => {
      let putCalls = 0;
      const { fixture, element, text } = await render('iniziale', 'segretario', {}, {
        get: (url) => of(url.includes('/bandi/') ? { expert_options: ['esperto@cnr.it'] } : { email_esperto_remoto: '', email_informatico_sede: '' }),
        put: () => { putCalls += 1; return of({}); },
      });
      expect(element.querySelector('.app-actions-head h2')?.textContent).toBe('Azioni');
      expect(element.querySelector('.app-eyebrow')?.textContent).toContain('Passo 1 di 3 · Preparazione');
      expect(element.querySelector('h3')?.textContent).toContain('Chi ti aiuta in questa sessione?');
      expect(primaryButtons(element)).toEqual(['Salva e continua']);
      const button = element.querySelector('.app-next-footer button') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(text()).toContain('Indica l’esperto remoto e l’email dell’informatico in sede per continuare.');
      fixture.componentInstance.saveSessionConfig();
      expect(putCalls).toBe(0);
      expect(fixture.componentInstance.error()).toContain('esperto remoto');
      expect(fixture.componentInstance.error()).toContain("email dell'informatico in sede");
    });

    it('does not prefill technical assignments from bando-level defaults', async () => {
      const { fixture } = await render('iniziale', 'segretario', {}, {
        get: (url) => of(url.includes('/bandi/')
          ? { email_esperto_remoto: 'bando@cnr.it', email_informatico_sede: 'bando-sede@cnr.it', expert_options: [] }
          : { email_esperto_remoto: '', nome_informatico_sede: '', email_informatico_sede: '', telefono_informatico_sede: '' }),
      });
      expect(fixture.componentInstance.sessionConfigModel.email_esperto_remoto).toBe('');
      expect(fixture.componentInstance.sessionConfigModel.email_informatico_sede).toBe('');
      expect(fixture.componentInstance.sessionConfigModel.informatici_sede).toEqual([]);
    });

    it('does not request bando config before commission id is available', async () => {
      const urls: string[] = [];
      await TestBed.configureTestingModule({
        imports: [AzioniComponent],
        providers: [provideRouter([]), ...provideKitForTests(), { provide: ApiClient, useValue: { get: (url: string) => { urls.push(url); return of({}); }, post: () => of({}), put: () => of({}) } }],
      }).compileComponents();
      const fixture = TestBed.createComponent(AzioniComponent);
      fixture.componentRef.setInput('sessionId', 'session-1');
      fixture.componentRef.setInput('commissionId', '');
      fixture.componentRef.setInput('currentState', 'iniziale');
      fixture.detectChanges();
      expect(urls).toContain('/sessioni/session-1/config?mode=segretario');
      expect(urls.some((url) => url.includes('/bandi/'))).toBe(false);
    });

    it('keeps the form being filled when the page polling updates other inputs', async () => {
      const get = vi.fn((url: string) => of(url.includes('/bandi/') ? { expert_options: [] } : { email_esperto_remoto: '' }));
      const { fixture } = await render('iniziale', 'segretario', {}, { get });
      fixture.componentInstance.sessionConfigModel.email_esperto_remoto = 'esperto@cnr.it';
      const calls = get.mock.calls.length;
      fixture.componentRef.setInput('candidateCount', 4);
      fixture.detectChanges();
      expect(get.mock.calls.length).toBe(calls);
      expect(fixture.componentInstance.sessionConfigModel.email_esperto_remoto).toBe('esperto@cnr.it');
    });

    it('disables candidate import with the reason when the session is admin-only', async () => {
      let postCalls = 0;
      const { fixture, element, text } = await render('configurata', 'admin', { adminOnly: true }, { post: () => { postCalls += 1; return of({}); } });
      expect(element.querySelector('h3')?.textContent).toContain('Scarica i candidati');
      expect(text()).toContain('solo come amministratore locale');
      const button = element.querySelector('.app-next-footer button') as HTMLButtonElement;
      expect(button.textContent).toContain('Scarica candidati');
      expect(button.disabled).toBe(true);
      fixture.componentInstance.importCandidati();
      expect(postCalls).toBe(0);
    });

    it('enables Avvia check-in only once a device is connected', async () => {
      const waiting = await render('candidati_scaricati', 'segretario', { deviceCount: 0, candidateCount: 4 });
      expect(waiting.text()).toContain('Collega almeno un dispositivo per avviare il check-in.');
      expect((waiting.element.querySelector('.app-next-footer .btn-primary') as HTMLButtonElement).disabled).toBe(true);
      TestBed.resetTestingModule();
      const ready = await render('dispositivi_connessi', 'segretario', { deviceCount: 1, candidateCount: 4 });
      expect(ready.text()).toContain('Tutto pronto: 1 dispositivo, 4 candidati.');
      expect((ready.element.querySelector('.app-next-footer .btn-primary') as HTMLButtonElement).disabled).toBe(false);
    });

    it('shows the check-in counter with its start time and confirms before concluding', async () => {
      const post = vi.fn(() => of({}));
      const { fixture, element, text } = await render('checkin_avviato', 'segretario', {
        candidateCount: 4, checkedInCount: 2,
        history: [{ state: 'checkin_avviato', at: '2026-10-20T14:05:00', actor_role: 'Segretario' }],
      }, { post });
      expect(element.querySelector('.app-eyebrow')?.textContent).toContain('Fase 2 · Check-in in corso dalle 14:05');
      expect(element.querySelector('.app-counter')?.textContent).toContain('2 / 4 presenti');
      (element.querySelector('.app-next-footer .btn-primary') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(text()).toContain('Concludere il check-in?');
      expect(text()).toContain('2 candidati su 4');
      expect(post).not.toHaveBeenCalledWith(expect.stringContaining('/actions/concludi_checkin'));
      (Array.from(element.querySelectorAll('.modal-footer button')).find((button) => button.textContent?.includes('Concludi')) as HTMLButtonElement).click();
      expect(post).toHaveBeenCalledWith('/sessioni/session-1/actions/concludi_checkin?mode=segretario');
    });

    it('sends lists to the remote expert and shows the outcome near the action', async () => {
      const { fixture, text } = await render('liste_generate', 'segretario', { references: { email_esperto_remoto: 'esperto@cnr.it' } }, {
        post: () => of({ sent: true, message: 'Liste candidati inviate correttamente.', recipients: ['esperto@cnr.it'], email_status: 'sent' }),
      });
      expect(text()).toContain('Le mandiamo per email a esperto@cnr.it, con te in copia.');
      expect(text()).toContain('Presenti · Excel (XLSX)');
      fixture.componentInstance.inviaListe();
      fixture.detectChanges();
      expect(text()).toContain('Liste candidati inviate correttamente');
      expect(text()).toContain('esperto@cnr.it');
    });

    it('warns when lists are available but the email notification fails', async () => {
      const { fixture, text } = await render('liste_generate', 'segretario', {}, {
        post: () => of({ sent: true, message: "Liste candidati rese disponibili all'informatico da remoto.", warning: 'SMTP KO', recipients: [], email_status: 'failed' }),
      });
      fixture.componentInstance.inviaListe();
      fixture.detectChanges();
      expect(text()).toContain('Email non inviata: SMTP KO');
      expect(text()).toContain('può comunque vedere e scaricare le liste');
    });

    it('says there is nothing left to do after sending, keeping the files downloadable', async () => {
      const { element, text } = await render('lista_presenti_aggiornata_su_moodle', 'segretario');
      expect(element.querySelector('h3')?.textContent).toContain('Nessuna azione da fare');
      expect(text()).toContain('Hai finito la tua parte');
      expect(text()).toContain('File della sessione');
      expect(element.querySelectorAll('.app-files a[href]')).toHaveLength(2);
      expect(primaryButtons(element)).toEqual([]);
    });
  });

  describe('informatico in sede', () => {
    it('waits for the secretary before candidates and hides the secretary section', async () => {
      const { element, text } = await render('configurata', 'sede');
      expect(text()).toContain('In attesa che il segretario prepari la sessione');
      expect(text()).not.toContain('Azioni del segretario');
      expect(element.querySelector('details')).toBeNull();
      expect(primaryButtons(element)).toEqual([]);
    });

    it('keeps the secretary actions closed by default as a backup', async () => {
      const { element } = await render('candidati_scaricati', 'sede');
      expect(element.querySelector('h3')?.textContent).toContain('Collega gli smartphone');
      const details = element.querySelector('details') as HTMLDetailsElement;
      expect(details.textContent).toContain('Azioni del segretario');
      expect(details.open).toBe(false);
      expect(details.textContent).toContain('Avvia check-in');
      expect(details.textContent).not.toContain('Scarica candidati');
    });

    it('during check-in explains that resets are asked from the candidate row, with no exam actions', async () => {
      const { element, text } = await render('checkin_avviato', 'sede', { openResetCount: 2 });
      expect(element.querySelector('h3')?.textContent).toContain('Segnala chi non riesce ad accedere');
      expect(text()).toContain('Il reset si chiede dalla riga del candidato');
      expect(text()).toContain('2 richieste in attesa');
      expect(text()).toContain('Vai ai candidati');
      expect(element.querySelector('.app-next-footer .btn-outline-primary')?.textContent).toContain('Collega un dispositivo');
      const mainPanel = element.querySelector('.app-actions-card') as HTMLElement;
      expect(mainPanel.querySelector('.app-next-footer .btn-primary')).toBeNull();
      expect(text()).not.toContain('Inizia esame');
      expect(text()).not.toContain('Lista presenti aggiornata');
    });

    it('never shows the secretary section once lists are sent', async () => {
      const { element } = await render('avvia_esame', 'sede');
      expect(element.querySelector('details')).toBeNull();
      expect(element.textContent).not.toContain('Inizia esame');
    });
  });

  describe('esperto remoto', () => {
    it('waits for the lists before they are sent', async () => {
      const { element } = await render('checkin_concluso', 'esperto');
      expect(element.querySelector('h3')?.textContent).toContain('In attesa che il segretario generi e invii le liste');
      expect(primaryButtons(element)).toEqual([]);
    });

    it('shows generated lists as downloadable while waiting for them to be sent', async () => {
      const { text } = await render('liste_generate', 'esperto');
      expect(text()).toContain('Liste generate, in attesa dell’invio');
      expect(text()).toContain('In attesa che il segretario le invii');
      expect(text()).toContain('Presenti · Excel (XLSX)');
    });

    it('offers the exam step as the only primary action, with confirmation', async () => {
      const post = vi.fn(() => of({}));
      const { fixture, element, text } = await render('liste_inviate', 'esperto', {}, { post });
      expect(element.querySelector('h3')?.textContent).toContain('Carica i presenti su Moodle');
      expect(primaryButtons(element)).toEqual(['Lista presenti aggiornata']);
      expect(text()).not.toContain('Invia liste');
      (element.querySelector('.app-next-footer .btn-primary') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(text()).toContain('Presenti caricati su Moodle?');
      (Array.from(element.querySelectorAll('.modal-footer button')).find((button) => button.textContent?.includes('Lista presenti')) as HTMLButtonElement).click();
      expect(post).toHaveBeenCalledWith('/sessioni/session-1/actions/aggiorna_presenti_moodle?mode=esperto');
    });

    it('shows pending resets and puts them in the browser tab title', async () => {
      const initialTitle = document.title;
      const { fixture, text } = await render('avvia_esame', 'esperto', { openResetCount: 3 });
      expect(text()).toContain('3 reset password da fare');
      expect(text()).toContain('Inizia esame');
      expect(document.title).toContain('(3)');
      fixture.destroy();
      expect(document.title).toBe(initialTitle);
    });
  });
});
