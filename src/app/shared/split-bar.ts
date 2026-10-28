import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface Segmento {
  rotulo: string;
  valor: number;
  cor: string; // variável CSS
}

/** Barra empilhada com legenda (VoteSplit). */
@Component({
  selector: 'mt-split-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-stack" style="gap: 8px">
      <div class="mt-split" role="img" [attr.aria-label]="descricao()">
        @for (s of partes(); track s.rotulo) {
          <span [style.width.%]="s.pct" [style.background]="s.cor"></span>
        }
      </div>
      <div class="mt-split-legend">
        @for (s of partes(); track s.rotulo) {
          <span><strong class="mt-num">{{ s.valor }}</strong> {{ s.rotulo }}</span>
        }
        @if (nota()) {
          <span class="nota">{{ nota() }}</span>
        }
      </div>
    </div>
  `,
  styles: `.nota { margin-left: auto; } @media (max-width: 720px) { .nota { margin-left: 0; width: 100%; } }`,
})
export class SplitBar {
  readonly segmentos = input.required<Segmento[]>();
  readonly nota = input<string | null>(null);

  protected readonly partes = computed(() => {
    const total = this.segmentos().reduce((a, s) => a + s.valor, 0);
    return this.segmentos().map((s) => ({ ...s, pct: total ? (s.valor / total) * 100 : 0 }));
  });
  protected readonly descricao = computed(() =>
    this.partes()
      .map((s) => `${s.rotulo}: ${s.valor} (${Math.round(s.pct)}%)`)
      .join(', '),
  );
}
