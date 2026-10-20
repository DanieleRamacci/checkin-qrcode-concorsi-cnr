import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { PagerComponent } from './pager.component';
import { provideKitForTests } from '../../testing/kit';

@Component({
  imports: [PagerComponent],
  template: '<app-pager label="Candidati" [total]="total()" [page]="page()" [pageSize]="10" (pageChange)="page.set($event)" />',
})
class HostComponent {
  readonly total = signal(23);
  readonly page = signal(1);
}

describe('PagerComponent', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [HostComponent], providers: [...provideKitForTests()] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the visible range, numbered pages and the page size selector', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Candidati 11–20 di 23');
    expect(Array.from(element.querySelectorAll('.pagination .page-item')).map((item) => item.textContent?.replace('Pagina ', '').trim())).toEqual(['precedente', '1', '2', '3', 'successiva']);
    expect(element.querySelector('.page-item.active [aria-current="page"]')?.textContent).toContain('2');
    expect(element.querySelector('.app-perpage select')).toBeTruthy();
  });

  it('moves between pages and collapses long ranges', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    (element.querySelectorAll('.pagination button')[3] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.page()).toBe(2);
    fixture.componentInstance.total.set(200);
    fixture.componentInstance.page.set(10);
    fixture.detectChanges();
    const labels = Array.from(element.querySelectorAll('.pagination .page-item')).map((item) => item.textContent?.replace('Pagina ', '').trim());
    expect(labels).toEqual(['precedente', '1', '…', '10', '11', '12', '…', '20', 'successiva']);
  });
});
