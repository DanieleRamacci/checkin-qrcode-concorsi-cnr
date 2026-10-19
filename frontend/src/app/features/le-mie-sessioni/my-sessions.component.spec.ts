import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { MySessionsComponent } from './my-sessions.component';

describe('MySessionsComponent', () => {
  it('shows assigned sessions, today summary, mode badge, filters and search', async () => {
    const rows = [
      { session_id: 'today', commission_id: 'c1', bando_title: 'Concorso CNR', name: 'Prova scritta', date: new Date().toLocaleDateString('sv-SE'), time: '09:00', location: 'Roma', current_state: 'checkin_avviato', candidate_count: 8, checked_in_count: 4, device_count: 1, capabilities: [], open_reset_count: 2 },
      { session_id: 'old', commission_id: 'c2', bando_title: 'Concorso passato', name: 'Prova orale', date: '2020-01-01', time: '10:00', location: 'Pisa', current_state: 'liste_generate', candidate_count: 4, checked_in_count: 3, device_count: 0, capabilities: [], open_reset_count: 0 },
    ];
    await TestBed.configureTestingModule({
      imports: [MySessionsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ mode: 'expert' })) } },
        { provide: ApiClient, useValue: { get: () => of({ mode: 'expert', items: rows }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MySessionsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.mode()).toBe('expert');
    expect(component.todaySessions().map((row) => row.session_id)).toEqual(['today']);
    expect(fixture.nativeElement.textContent).toContain('2 reset da fare');
    expect(fixture.nativeElement.textContent).toContain('Prova scritta');
    component.setFilter('past');
    expect(component.filteredItems().map((row) => row.session_id)).toEqual(['old']);
    component.query.set('Pisa');
    expect(component.pageItems().map((row) => row.session_id)).toEqual(['old']);
  });

  it('shows a helpful empty state when no sessions are assigned', async () => {
    await TestBed.configureTestingModule({
      imports: [MySessionsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ mode: 'sede' })) } },
        { provide: ApiClient, useValue: { get: () => of({ mode: 'sede', items: [] }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MySessionsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nessuna sessione in programma');
  });
});
