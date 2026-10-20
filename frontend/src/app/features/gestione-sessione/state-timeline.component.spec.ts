import { TestBed } from '@angular/core/testing';
import { StateTimelineComponent } from './state-timeline.component';
import { provideKitForTests } from '../../../testing/kit';

async function render(state: string, faseEsameMia = false) {
  await TestBed.configureTestingModule({ imports: [StateTimelineComponent], providers: [...provideKitForTests()] }).compileComponents();
  const fixture = TestBed.createComponent(StateTimelineComponent);
  fixture.componentRef.setInput('currentState', state);
  fixture.componentRef.setInput('faseEsameMia', faseEsameMia);
  fixture.componentRef.setInput('history', [{ state: 'iniziale', at: '2026-10-19T15:53:54.425537', actor_role: 'Segretario' }]);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('StateTimelineComponent', () => {
  it('shows the design timeline with time and role of each completed step', async () => {
    const element = await render('configurata');
    expect(element.querySelector('#tl-title')?.textContent).toBe('Timeline della sessione');
    expect(element.textContent).toContain('2 di 12');
    const firstStep = element.querySelector('.app-tl li') as HTMLElement;
    expect(firstStep.classList).toContain('is-done');
    expect(firstStep.querySelector('.app-tl-time')?.textContent).toBe('15:53');
    expect(firstStep.querySelector('.visually-hidden')?.textContent).toContain('Segretario');
    expect(firstStep.textContent).not.toContain('2026-10-19T');
    const current = element.querySelector('li[aria-current="step"]') as HTMLElement;
    expect(current.textContent).toContain('Configurata');
    expect(current.querySelector('.app-tl-now')?.textContent).toBe('stato attuale');
    expect(element.querySelectorAll('.app-tl li')).toHaveLength(12);
  });

  it('shows the role when a step was done by someone other than the expected role', async () => {
    await TestBed.configureTestingModule({ imports: [StateTimelineComponent], providers: [...provideKitForTests()] }).compileComponents();
    const fixture = TestBed.createComponent(StateTimelineComponent);
    fixture.componentRef.setInput('currentState', 'checkin_concluso');
    fixture.componentRef.setInput('history', [{ state: 'checkin_avviato', at: '2026-10-20T14:05:00', actor_role: 'Informatico in sede' }]);
    fixture.detectChanges();
    const step = Array.from(fixture.nativeElement.querySelectorAll('.app-tl li') as NodeListOf<HTMLElement>).find((li) => li.textContent?.includes('Check-in avviato'));
    expect(step?.querySelector('.app-tl-text .small')?.textContent).toBe('dall’informatico in sede');
  });

  it('marks phase 4 as handled by the remote expert, except for the expert', async () => {
    const element = await render('liste_inviate');
    expect(element.querySelector('.app-tl-phase.is-other')?.textContent).toContain('4 · Esame · a cura dell’esperto remoto');
    TestBed.resetTestingModule();
    const expert = await render('liste_inviate', true);
    expect(expert.querySelector('.app-tl-phase.is-other')).toBeNull();
  });
});
