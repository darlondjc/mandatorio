import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { corPartido, fotoSegura, iniciais, textoSobrePartido } from '../core/format';

/** Foto oficial em círculo com anel verde (ProfilePhoto) ou, sem foto, iniciais. */
@Component({
  selector: 'mt-photo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-photo" [class.mt-photo--sm]="pequena()">
      @if (src() && !falhou()) {
        <img class="mt-photo__img" [src]="src()" [alt]="'Foto oficial de ' + nome()" (error)="falhou.set(true)" />
      } @else {
        <div class="mt-photo__img sem-foto" role="img" [attr.aria-label]="nome()">{{ ini() }}</div>
      }
    </div>
  `,
  styles: `
    .sem-foto { display: grid; place-items: center; font: 600 40px/1 var(--font-display); color: var(--brand-700); }
    .mt-photo--sm .sem-foto { font-size: 30px; }
  `,
})
export class Photo {
  readonly nome = input.required<string>();
  readonly foto = input<string | null>(null);
  readonly pequena = input(false);
  protected readonly src = computed(() => fotoSegura(this.foto()));
  protected readonly falhou = signal(false);
  protected readonly ini = computed(() => iniciais(this.nome()));
}

/** Avatar pequeno para listas: foto ou iniciais sobre a cor do partido. */
@Component({
  selector: 'mt-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src() && !falhou()) {
      <img class="mt-avatar" [src]="src()" alt="" (error)="falhou.set(true)" loading="lazy" />
    } @else {
      <span class="mt-avatar" aria-hidden="true" [style.background]="cor()" [style.color]="texto()">{{ ini() }}</span>
    }
  `,
  styles: `img.mt-avatar { object-fit: cover; object-position: 50% 22%; background: var(--brand-100); }`,
})
export class Avatar {
  readonly nome = input.required<string>();
  readonly partido = input.required<string>();
  readonly foto = input<string | null>(null);
  protected readonly src = computed(() => fotoSegura(this.foto()));
  protected readonly falhou = signal(false);
  protected readonly ini = computed(() => iniciais(this.nome()));
  protected readonly cor = computed(() => corPartido(this.partido()));
  protected readonly texto = computed(() => textoSobrePartido(this.partido()));
}
