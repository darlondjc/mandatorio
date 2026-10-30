import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { Avatar } from './avatar';

/**
 * Cabeçalho que desce do topo com a foto e o nome quando o cabeçalho grande da página (`alvo`)
 * sai da tela por cima; some ao voltar. Tocar nele leva ao começo da página.
 */
@Component({
  selector: 'mt-cabecalho-fixo',
  imports: [Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixo" [class.fixo--visivel]="visivel()" [attr.aria-hidden]="!visivel()">
      <button class="fixo__dentro" type="button" [tabIndex]="visivel() ? 0 : -1" (click)="topo()" [attr.aria-label]="nome() + ': voltar ao começo da página'">
        <mt-avatar [nome]="nome()" [partido]="partido()" [foto]="foto()" />
        <span class="fixo__texto">
          <span class="fixo__nome">{{ nome() }}</span>
          @if (sub()) { <span class="fixo__sub">{{ sub() }}</span> }
        </span>
        <span class="fixo__subir" aria-hidden="true">↑</span>
      </button>
    </div>
  `,
  styles: `
    .fixo {
      position: fixed; z-index: 15; top: var(--altura-topo); left: var(--largura-menu); right: 0;
      background: var(--surface); border-bottom: 2px solid var(--line); box-shadow: 0 6px 18px rgb(0 0 0 / 0.08);
      opacity: 0; transform: translateY(-100%); pointer-events: none;
      transition: transform 0.25s ease, opacity 0.2s ease;
    }
    .fixo--visivel { opacity: 1; transform: none; pointer-events: auto; }
    .fixo__dentro {
      display: flex; align-items: center; gap: 12px; width: 100%; max-width: 1200px; margin: 0 auto;
      padding: 8px var(--space-10); border: 0; background: none; color: inherit; text-align: left; cursor: pointer; font: inherit;
    }
    .fixo__texto { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .fixo__nome { font: 500 17px/1.2 var(--font-display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fixo__sub { font-size: 12.5px; color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fixo__subir {
      display: grid; place-items: center; width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%;
      background: var(--brand-100); color: var(--brand-700); font-size: 16px;
    }
    :host ::ng-deep .fixo .mt-avatar { width: 40px; height: 40px; font-size: 14px; }
    /* A foto aparece crescendo um pouco, como se subisse do cabeçalho grande. */
    :host ::ng-deep .fixo .mt-avatar { transform: scale(0.8); transition: transform 0.3s ease; }
    :host ::ng-deep .fixo--visivel .mt-avatar { transform: none; }
    @media (prefers-reduced-motion: reduce) {
      .fixo, :host ::ng-deep .fixo .mt-avatar { transition: none; }
    }
    @media (max-width: 960px) { .fixo__dentro { padding: 8px var(--space-4); } }
    @media (max-width: 720px) {
      .fixo__nome { font-size: 15.5px; }
      :host ::ng-deep .fixo .mt-avatar { width: 36px; height: 36px; font-size: 13px; }
    }
  `,
})
export class CabecalhoFixo {
  /** O cabeçalho grande da página: quando ele sai da tela por cima, este aparece. */
  readonly alvo = input<HTMLElement | undefined>();
  readonly nome = input.required<string>();
  readonly partido = input('');
  readonly foto = input<string | null>(null);
  /** Linha de baixo: "PP · Paraíba", "Presidente · 2023–2026". */
  readonly sub = input<string | null>(null);

  protected readonly visivel = signal(false);

  constructor() {
    let observador: IntersectionObserver | undefined;
    inject(DestroyRef).onDestroy(() => observador?.disconnect());
    effect(() => {
      const el = this.alvo();
      observador?.disconnect();
      if (!el) {
        this.visivel.set(false);
        return;
      }
      // A barra do topo do celular cobre o começo da página: desconta a altura dela.
      const topo = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--altura-topo')) || 0;
      observador = new IntersectionObserver(([e]) => this.visivel.set(!e.isIntersecting && e.boundingClientRect.top < topo), {
        rootMargin: `-${topo}px 0px 0px 0px`,
      });
      observador.observe(el);
    });
  }

  protected topo() {
    const suave = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: suave ? 'smooth' : 'auto' });
  }
}
