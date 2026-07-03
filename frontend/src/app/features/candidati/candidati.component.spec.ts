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
          }] }),
          post: () => of({}),
        },
      }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CandidatiComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ada');
    expect(fixture.nativeElement.textContent).toContain('QR');
  });
});
