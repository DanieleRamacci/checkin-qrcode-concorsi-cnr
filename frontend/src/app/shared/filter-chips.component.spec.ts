import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FilterChipsComponent } from './filter-chips.component';

@Component({ imports: [FilterChipsComponent], template: '<app-filter-chips label="Presenti" [options]="options" selected="all" />' })
class HostComponent { options = [{ id: 'yes', label: 'Presenti', count: 4 }, { id: 'all', label: 'Tutti', count: 8 }]; }

describe('FilterChipsComponent', () => {
  it('shows counts and marks the selected filter accessibly', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].textContent).toContain('Presenti · 4');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
  });
});
