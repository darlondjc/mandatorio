import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

// Ícones de traço 2px, grade 24 (desenho no estilo Lucide). Decorativos: aria-hidden.
const PATHS: Record<string, string> = {
  presidente: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  senado: '<path d="M3 20h18"/><path d="M5 20v-8M9.5 20v-8M14.5 20v-8M19 20v-8"/><path d="M3 10l9-6 9 6"/>',
  comparar: '<path d="M8 3v18M16 3v18"/><path d="M3 8h5M16 16h5"/>',
  rankings: '<path d="M6 20V11M12 20V5M18 20v-6"/>',
  indicadores: '<path d="M3 20h18"/><path d="M4 15l5-5 4 3 7-8"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  voltar: '<path d="M15 6l-6 6 6 6"/>',
  topo: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  externo: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  tema: '<path d="M12 3a9 9 0 109 9 7 7 0 01-9-9z"/>',
  positivo: '<path d="M7 10v12"/><path d="M15 5.88L14 10h5.83a2 2 0 011.92 2.56l-2.33 8A2 2 0 0117.5 22H4a2 2 0 01-2-2v-8a2 2 0 012-2h2.76a2 2 0 001.79-1.11L12 2a3.13 3.13 0 013 3.88z"/>',
  negativo: '<path d="M17 14V2"/><path d="M9 18.12L10 14H4.17a2 2 0 01-1.92-2.56l2.33-8A2 2 0 016.5 2H20a2 2 0 012 2v8a2 2 0 01-2 2h-2.76a2 2 0 00-1.79 1.11L12 22a3.13 3.13 0 01-3-3.88z"/>',
};

@Component({
  selector: 'mt-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:inline-flex;flex-shrink:0' },
  template: `<svg
    aria-hidden="true"
    [attr.width]="size()"
    [attr.height]="size()"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    [innerHTML]="svg()"
  ></svg>`,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(20);
  private readonly sanitizer = inject(DomSanitizer);
  // Os desenhos são constantes deste arquivo, nunca vêm de dados externos.
  protected readonly svg = computed(() => this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name()] ?? ''));
}
