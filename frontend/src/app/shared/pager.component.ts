import { Component, computed, input, output } from '@angular/core';
import { ItIconComponent } from 'design-angular-kit';

/**
 * Riga sotto le tabelle (prototipo, `app-pager`): "Concorsi 1–10 di 37",
 * paginazione Bootstrap Italia e selettore 10/25/50 per pagina. Pagine da 0.
 */
@Component({
  selector: 'app-pager',
  imports: [ItIconComponent],
  template: `
    @if (total() > 0) {
      <div class="app-pager">
        <p class="mb-0 text-secondary">{{ label() }} {{ first() }}–{{ last() }} di {{ total() }}</p>
        @if (pageCount() > 1) {
          <nav class="pagination-wrapper mb-0" [attr.aria-label]="'Paginazione ' + label().toLocaleLowerCase('it')">
            <ul class="pagination mb-0">
              <li class="page-item" [class.disabled]="page() <= 0">
                <button type="button" class="page-link" [disabled]="page() <= 0" (click)="go(page() - 1)">
                  <it-icon name="chevron-left" color="primary" /><span class="visually-hidden">Pagina precedente</span>
                </button>
              </li>
              @for (item of pages(); track $index) {
                @if (item === null) {
                  <li class="page-item disabled"><span class="page-link" aria-hidden="true">…</span></li>
                } @else {
                  <li class="page-item" [class.active]="item === page()">
                    <button type="button" class="page-link" [attr.aria-current]="item === page() ? 'page' : null" (click)="go(item)">
                      <span class="visually-hidden">Pagina </span>{{ item + 1 }}
                    </button>
                  </li>
                }
              }
              <li class="page-item" [class.disabled]="page() + 1 >= pageCount()">
                <button type="button" class="page-link" [disabled]="page() + 1 >= pageCount()" (click)="go(page() + 1)">
                  <span class="visually-hidden">Pagina successiva</span><it-icon name="chevron-right" color="primary" />
                </button>
              </li>
            </ul>
          </nav>
        }
        <div class="select-wrapper app-perpage">
          <label [for]="selectId" class="visually-hidden">Elementi per pagina</label>
          <select [id]="selectId" [value]="pageSize()" (change)="pageSizeChange.emit(+$any($event.target).value)">
            @for (size of sizes; track size) { <option [value]="size" [selected]="size === pageSize()">{{ size }} per pagina</option> }
          </select>
        </div>
      </div>
    }
  `,
  styles: `
    .page-link { background: transparent; }
    .page-link:disabled { opacity: .5; }
  `,
})
export class PagerComponent {
  private static nextId = 0;
  readonly label = input('Elementi');
  readonly total = input(0);
  readonly page = input(0);
  readonly pageSize = input(10);
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly sizes = [10, 25, 50];
  readonly selectId = `pager-size-${PagerComponent.nextId++}`;
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly first = computed(() => this.total() ? this.page() * this.pageSize() + 1 : 0);
  readonly last = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize()));
  /** Al massimo 7 pulsanti: prima, ultima e le pagine vicine a quella corrente, con "…" in mezzo. */
  readonly pages = computed<(number | null)[]>(() => {
    const count = this.pageCount();
    const current = this.page();
    if (count <= 7) return Array.from({ length: count }, (_, index) => index);
    const around = [current - 1, current, current + 1].filter((index) => index > 0 && index < count - 1);
    const result: (number | null)[] = [0];
    if (around[0] > 1) result.push(null);
    result.push(...around);
    if (around[around.length - 1] < count - 2) result.push(null);
    result.push(count - 1);
    return result;
  });

  go(index: number): void {
    if (index >= 0 && index < this.pageCount() && index !== this.page()) this.pageChange.emit(index);
  }
}
