import { TestBed } from '@angular/core/testing';
import { StateTimelineComponent } from './state-timeline.component';

describe('StateTimelineComponent', () => {
  it('places labels after the progress markers and formats history dates', async () => {
    await TestBed.configureTestingModule({ imports: [StateTimelineComponent] }).compileComponents();
    const fixture = TestBed.createComponent(StateTimelineComponent);
    fixture.componentRef.setInput('currentState', 'configurata');
    fixture.componentRef.setInput('history', [{ state: 'iniziale', at: '2026-10-19T15:53:54.425537', actor_role: 'Segretario' }]);
    fixture.detectChanges();

    const firstStep = fixture.nativeElement.querySelector('.app-tl li') as HTMLElement;
    expect(firstStep.querySelector('.app-tl-mark')).toBeTruthy();
    expect(firstStep.querySelector('.app-tl-text')?.textContent).toContain('Sessione creata');
    expect(firstStep.textContent).toContain('19/10/2026 · 15:53');
    expect(firstStep.textContent).not.toContain('2026-10-19T');
    expect(fixture.nativeElement.querySelectorAll('.app-tl li')).toHaveLength(12);
  });
});
