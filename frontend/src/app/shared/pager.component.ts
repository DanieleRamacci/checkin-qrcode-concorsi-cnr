import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pager',
  template: `
    @if (total() > 0) {
      <div class="app-pager d-flex flex-wrap align-items-center justify-content-between gap-3">
        <span>{{ label() }} {{ first() }}–{{ last() }} di {{ total() }}</span>
        <nav class="it-pagination" aria-label="Pagine dei risultati">
          <button class="page-link" type="button" [disabled]="page() <= 0" (click)="pageChange.emit(page() - 1)">Precedente</button>
          <span aria-current="page">Pagina {{ page() + 1 }} di {{ pageCount() }}</span>
          <button class="page-link" type="button" [disabled]="page() + 1 >= pageCount()" (click)="pageChange.emit(page() + 1)">Successiva</button>
        </nav>
        <label class="d-flex align-items-center gap-2">Elementi per pagina
          <select class="form-select form-select-sm" [value]="pageSize()" (change)="pageSizeChange.emit(+$any($event.target).value)">
            <option [value]="10">10</option><option [value]="25">25</option><option [value]="50">50</option>
          </select>
        </label>
      </div>
    }
  `,
})
export class PagerComponent {
  readonly label = input('Elementi');
  readonly total = input(0);
  readonly page = input(0);
  readonly pageSize = input(10);
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly first = computed(() => this.total() ? this.page() * this.pageSize() + 1 : 0);
  readonly last = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize()));
}
