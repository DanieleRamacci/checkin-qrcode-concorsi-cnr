import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApiClient } from '../../core/api-client';
import { ScannerComponent, parseCandidateQr, parseSessionQr } from './scanner.component';

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
});
