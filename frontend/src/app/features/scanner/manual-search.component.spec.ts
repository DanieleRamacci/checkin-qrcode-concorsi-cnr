import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiClient } from '../../core/api-client';
import { ManualSearchComponent } from './manual-search.component';

describe('ManualSearchComponent', () => {
  it('requires two characters, searches with scanner credentials, and emits the selected candidate', async () => {
    const post = vi.fn(() => of({ items: [{ uid: 'u1', first_name: 'Ada', last_name: 'Lovelace', document_number: 'DOC-1', checkin_effettuato: false }] }));
    await TestBed.configureTestingModule({
      imports: [ManualSearchComponent],
      providers: [{ provide: ApiClient, useValue: { post } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ManualSearchComponent);
    fixture.componentRef.setInput('sessionId', 's1');
    fixture.componentRef.setInput('deviceToken', 'device-token');
    fixture.detectChanges();
    const selected = vi.fn();
    fixture.componentInstance.candidateSelected.subscribe(selected);
    fixture.componentInstance.query = ' a ';
    fixture.componentInstance.search();
    expect(post).not.toHaveBeenCalled();
    fixture.componentInstance.query = ' Ada ';
    fixture.componentInstance.search();
    fixture.detectChanges();
    expect(post).toHaveBeenCalledWith('/scanner/search-candidates', { session_id: 's1', device_token: 'device-token', q: 'Ada' });
    expect(fixture.nativeElement.textContent).toContain('Lovelace Ada');
    (fixture.nativeElement.querySelector('li button') as HTMLButtonElement).click();
    expect(selected).toHaveBeenCalledWith('u1');
  });

  it('shows no-match and request-error messages', async () => {
    const responses = [of({ items: [] }), throwError(() => new Error('network'))];
    const post = vi.fn(() => responses.shift() ?? of({ items: [] }));
    await TestBed.configureTestingModule({ imports: [ManualSearchComponent], providers: [{ provide: ApiClient, useValue: { post } }] }).compileComponents();
    const fixture = TestBed.createComponent(ManualSearchComponent);
    fixture.componentRef.setInput('sessionId', 's1');
    fixture.componentRef.setInput('deviceToken', 'token');
    fixture.detectChanges();
    fixture.componentInstance.query = 'Ada';
    fixture.componentInstance.search();
    expect(fixture.componentInstance.error()).toContain('Nessun candidato trovato');
    fixture.componentInstance.search();
    expect(fixture.componentInstance.error()).toContain('Ricerca non riuscita');
  });
});
