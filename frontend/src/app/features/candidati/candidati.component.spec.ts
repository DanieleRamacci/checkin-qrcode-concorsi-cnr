import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { CandidatiComponent, candidateQrPayload } from './candidati.component';

describe('candidateQrPayload', () => {
  it('matches the payload consumed by the scanner', () => {
    expect(candidateQrPayload('candidate-123')).toBe('{"uid":"candidate-123"}');
  });
});

describe('CandidatiComponent', () => {
  it('renders candidates and the QR action', async () => {
    await TestBed.configureTestingModule({
      imports: [CandidatiComponent],
      providers: [{
        provide: ApiClient,
        useValue: {
          get: () => of({ items: [{
            uid: 'candidate-1',
            first_name: 'Ada',
            last_name: 'Lovelace',
            document_number: 'DOC1',
            document_expired: false,
            checkin_effettuato: false,
            reset_password_richiesto: false,
            reset_password_effettuato: false,
            note: 'Carta identità aggiornata',
          }] }),
          post: () => of({}),
          put: () => of({}),
        },
      }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CandidatiComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ada');
    expect(fixture.nativeElement.textContent).toContain('QR');
    expect(fixture.nativeElement.textContent).toContain('Modifica note');
    expect(fixture.nativeElement.textContent).toContain('Carta identità aggiornata');
    expect(fixture.nativeElement.querySelectorAll('.candidate-table thead th')).toHaveLength(4);
  });

  it('shows the reset table inside the candidates section for the in-person profile', async () => {
    await TestBed.configureTestingModule({
      imports: [CandidatiComponent],
      providers: [{
        provide: ApiClient,
        useValue: {
          get: () => of({ items: [{
            uid: 'candidate-reset', first_name: 'Ada', last_name: 'Lovelace', document_number: 'DOC1',
            document_expired: false, checkin_effettuato: true, reset_password_richiesto: true,
            reset_password_effettuato: false, reset_password_richiesto_da: 'sede', reset_password_richiesto_il: '2026-10-19T10:00:00Z',
          }] }),
          post: () => of({}),
          put: () => of({}),
        },
      }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CandidatiComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.componentRef.setInput('viewMode', 'sede');
    fixture.componentRef.setInput('sectionMode', 'reset-sede');
    const openCounts: number[] = [];
    fixture.componentInstance.openResetCountChange.subscribe((count) => openCounts.push(count));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reset richiesto');
    expect(fixture.nativeElement.textContent).not.toContain('Documento');
    expect(openCounts.at(-1)).toBe(1);
  });

  it('saves candidate notes and updates the row', async () => {
    let putPayload: unknown = null;
    await TestBed.configureTestingModule({
      imports: [CandidatiComponent],
      providers: [{
        provide: ApiClient,
        useValue: {
          get: () => of({ items: [{
            uid: 'candidate-1',
            first_name: 'Ada',
            last_name: 'Lovelace',
            document_number: 'DOC1',
            document_expired: false,
            checkin_effettuato: false,
            reset_password_richiesto: false,
            reset_password_effettuato: false,
            note: '',
          }] }),
          post: () => of({}),
          put: (_url: string, payload: unknown) => {
            putPayload = payload;
            return of({
              uid: 'candidate-1',
              first_name: 'Ada',
              last_name: 'Lovelace',
              document_number: 'DOC1',
              document_expired: false,
              checkin_effettuato: false,
              reset_password_richiesto: false,
              reset_password_effettuato: false,
              note: 'Documento verificato a vista',
            });
          },
        },
      }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CandidatiComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.openNotes(fixture.componentInstance.items()[0]);
    fixture.componentInstance.noteDraft = 'Documento verificato a vista';
    fixture.componentInstance.saveNotes();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(putPayload).toEqual({ note: 'Documento verificato a vista' });
    expect(fixture.componentInstance.items()[0].note).toBe('Documento verificato a vista');
    expect(fixture.nativeElement.textContent).toContain('Note candidato salvate');
  });
});
