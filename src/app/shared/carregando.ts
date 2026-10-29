import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Indicador de carregamento de uma seção: a marca pulsando e o que está vindo. */
@Component({
  selector: 'mt-carregando',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="marca" aria-hidden="true"></span>
    <span>{{ texto() }}</span>
  `,
  host: { role: 'status', 'aria-live': 'polite' },
  styles: `
    :host { display: flex; align-items: center; gap: 12px; padding-block: var(--space-5); color: var(--ink-muted); font-size: 15px; }
    .marca {
      width: 24px; height: 24px; flex-shrink: 0;
      background: var(--brand-700); -webkit-mask: var(--marca) center / contain no-repeat; mask: var(--marca) center / contain no-repeat;
      animation: pulsar 1.1s ease-in-out infinite;
    }
    @keyframes pulsar { 0%, 100% { opacity: 0.35; transform: scale(0.88); } 50% { opacity: 1; transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { .marca { animation: none; opacity: 0.7; } }
  `,
})
export class Carregando {
  readonly texto = input('Carregando…');
}
