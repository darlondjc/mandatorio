import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Indicador de carregamento: a marca pulsando e o que está vindo. Compacto dentro de uma
 * seção; com `pagina`, maior e centralizado no espaço da página, para quando é o conteúdo
 * principal que ainda não chegou.
 */
@Component({
  selector: 'mt-carregando',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="marca" aria-hidden="true"></span>
    <span>{{ texto() }}</span>
  `,
  host: { role: 'status', 'aria-live': 'polite', '[class.pagina]': 'pagina()' },
  styles: `
    :host { display: flex; align-items: center; gap: 12px; padding-block: var(--space-5); color: var(--ink-muted); font-size: 15px; }
    .marca {
      width: 24px; height: 24px; flex-shrink: 0;
      background: var(--brand-700); -webkit-mask: var(--marca) center / contain no-repeat; mask: var(--marca) center / contain no-repeat;
      animation: pulsar 1.1s ease-in-out infinite;
    }
    :host(.pagina) { flex-direction: column; justify-content: center; gap: var(--space-4); min-height: 55vh; font-size: 16px; text-align: center; }
    :host(.pagina) .marca { width: 48px; height: 48px; }
    @keyframes pulsar { 0%, 100% { opacity: 0.35; transform: scale(0.88); } 50% { opacity: 1; transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { .marca { animation: none; opacity: 0.7; } }
  `,
})
export class Carregando {
  readonly texto = input('Carregando…');
  readonly pagina = input(false, { transform: booleanAttribute });
}
