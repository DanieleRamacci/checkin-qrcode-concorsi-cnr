import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiClient } from '../../core/api-client';
import { ScannerComponent, parseCandidateQr, parseSessionQr } from './scanner.component';
import { provideKitForTests } from '../../../testing/kit';

describe('parseCandidateQr', () => {
  it('extracts the candidate uid from the legacy QR payload', () => {
    expect(parseCandidateQr('{"uid":"candidate-123"}')).toBe('candidate-123');
  });

  it('rejects malformed or unrelated QR payloads', () => {
    expect(parseCandidateQr('not-json')).toBeNull();
    expect(parseCandidateQr('{"session_id":"session-1"}')).toBeNull();
  });
});

describe('parseSessionQr', () => {
  it('extracts association data from the scanner URL', () => {
    expect(
      parseSessionQr(
        'https://example.test/scanner?sessionId=session-1&token=registration-token',
      ),
    ).toBe('/scanner?sessionId=session-1&token=registration-token');
  });

  it('accepts the legacy JSON session payload', () => {
    expect(
      parseSessionQr('{"session_id":"session-1","token":"registration-token"}'),
    ).toBe('/scanner?sessionId=session-1&token=registration-token');
  });
});

describe('ScannerComponent', () => {
  it('renders session association mode with camera instructions', async () => {
    const timeout = vi.spyOn(window, 'setTimeout').mockImplementation(() => 0 as never);
    await TestBed.configureTestingModule({
      imports: [ScannerComponent],
      providers: [
        provideRouter([]),
        ...provideKitForTests(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: new Map() } },
        },
        {
          provide: ApiClient,
          useValue: { post: () => of({}) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScannerComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Scansiona il QR code della sessione');
    fixture.destroy();
    timeout.mockRestore();
  });

  it('polls while blocked, unlocks the camera when check-in starts, then stops polling', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', { getItem: () => 'device-token', setItem: vi.fn(), removeItem: vi.fn() });
    let summaryCount = 0;
    const post = vi.fn((path: string) => {
      if (path === '/scanner/session-summary') {
        summaryCount += 1;
        return of({ session_id: 's1', name: 'Sessione CNR', current_state: summaryCount === 1 ? 'configurata' : 'checkin_avviato', checked_in_count: 0, candidate_count: 2 });
      }
      return of({});
    });
    await TestBed.configureTestingModule({
      imports: [ScannerComponent],
      providers: [
        provideRouter([]),
        ...provideKitForTests(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map([['sessionId', 's1']]) } } },
        { provide: ApiClient, useValue: { post } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ScannerComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Il check-in non è ancora iniziato.');
    await vi.advanceTimersByTimeAsync(5000);
    fixture.detectChanges();
    expect(fixture.componentInstance.workflowBlocked()).toBe('');
    const unlockedSummaryCount = summaryCount;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(summaryCount).toBe(unlockedSummaryCount);
    fixture.destroy();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows a retry path when device association fails', async () => {
    const timeout = vi.spyOn(window, 'setTimeout').mockImplementation(() => 0 as never);
    await TestBed.configureTestingModule({
      imports: [ScannerComponent],
      providers: [
        provideRouter([]),
        ...provideKitForTests(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map([['sessionId', 's1'], ['token', 'invalid']]) } } },
        { provide: ApiClient, useValue: { post: () => throwError(() => ({ error: { error: { message: 'Token non valido' } } })) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ScannerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Collegamento non riuscito');
    expect(fixture.nativeElement.textContent).toContain('Scansiona di nuovo il QR');
    expect(fixture.componentInstance.associationMode()).toBe(true);
    fixture.destroy();
    timeout.mockRestore();
  });

  it('completes device association and enters the blocked scanner state', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
    const post = (path: string) => {
      if (path === '/devices/register') return of({ device_token: 'device-token' });
      if (path.endsWith('/devices/verify')) return of({});
      return of({ session_id: 's1', name: 'Sessione CNR', current_state: 'configurata', checked_in_count: 0, candidate_count: 2 });
    };
    await TestBed.configureTestingModule({
      imports: [ScannerComponent],
      providers: [
        provideRouter([]),
        ...provideKitForTests(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map([['sessionId', 's1'], ['token', 'registration']]) } } },
        { provide: ApiClient, useValue: { post } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ScannerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.associationStatus()).toBe('Telefono collegato');
    expect(fixture.componentInstance.ready()).toBe(true);
    expect(fixture.componentInstance.workflowBlocked()).toContain('non è ancora iniziato');
    expect(fixture.nativeElement.textContent).toContain('Sessione CNR');
    fixture.destroy();
    vi.unstubAllGlobals();
  });

  it('offers retry and manual search when a scanned candidate is not found', async () => {
    const timeout = vi.spyOn(window, 'setTimeout').mockImplementation(() => 0 as never);
    vi.stubGlobal('localStorage', { getItem: () => 'device-token', setItem: vi.fn(), removeItem: vi.fn() });
    const post = (path: string) => path === '/scanner/session-summary'
      ? of({ session_id: 's1', name: 'Sessione CNR', current_state: 'checkin_avviato', checked_in_count: 0, candidate_count: 2 })
      : throwError(() => ({ error: { error: { code: 'candidate_not_found', message: 'Candidato non trovato.' } } }));
    await TestBed.configureTestingModule({
      imports: [ScannerComponent],
      providers: [
        provideRouter([]),
        ...provideKitForTests(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map([['sessionId', 's1']]) } } },
        { provide: ApiClient, useValue: { post } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ScannerComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCandidate('missing');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Candidato non trovato.');
    expect(fixture.nativeElement.textContent).toContain('Scansiona di nuovo');
    expect(fixture.nativeElement.textContent).toContain('Cerca per cognome');
    fixture.componentInstance.openManualSearch();
    fixture.detectChanges();
    expect(fixture.componentInstance.manualSearchOpen()).toBe(true);
    fixture.destroy();
    vi.unstubAllGlobals();
    timeout.mockRestore();
  });

  it('shows the original check-in time and source for a candidate already registered', async () => {
    const timeout = vi.spyOn(window, 'setTimeout').mockImplementation(() => 0 as never);
    vi.stubGlobal('localStorage', { getItem: () => 'device-token', setItem: vi.fn(), removeItem: vi.fn() });
    const post = (path: string) => path === '/scanner/session-summary'
      ? of({ session_id: 's1', name: 'Sessione CNR', current_state: 'checkin_avviato', checked_in_count: 1, candidate_count: 2 })
      : of({ uid: 'c1', first_name: 'Ada', last_name: 'Lovelace', document_number: 'DOC1', checkin_effettuato: true, checkin_at: '2026-10-19T12:07:00Z', checkin_source: 'scanner' });
    await TestBed.configureTestingModule({
      imports: [ScannerComponent],
      providers: [
        provideRouter([]),
        ...provideKitForTests(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map([['sessionId', 's1']]) } } },
        { provide: ApiClient, useValue: { post } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ScannerComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCandidate('c1');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Presente dalle 14:07, registrato dallo scanner.');
    expect(fixture.nativeElement.textContent).toContain('Scansiona il prossimo');
    expect(fixture.nativeElement.querySelector('button.btn-success')).toBeNull();
    fixture.destroy();
    vi.unstubAllGlobals();
    timeout.mockRestore();
  });
});
