import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { PagerComponent } from './pager.component';

@Component({ imports: [PagerComponent], template: '<app-pager label="Candidati" [total]="23" [page]="1" [pageSize]="10" />' })
class HostComponent {}

describe('PagerComponent', () => {
  it('shows the visible range and pagination control', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Candidati 11–20 di 23');
    expect(fixture.nativeElement.querySelector('.it-pagination')).toBeTruthy();
  });
});
