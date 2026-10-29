import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'mt-nao-encontrada',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mt-stack" style="gap: 16px; max-width: 560px; padding-block: 48px">
      <h1 class="page-title">Página não encontrada</h1>
      <p class="muted">O endereço pode estar errado ou o parlamentar não estar mais em exercício.</p>
      <div class="mt-row">
        <a class="mt-btn mt-btn--cta" routerLink="/">Ir para o início</a>
        <a class="mt-btn mt-btn--outline" routerLink="/presidente">Ver o Presidente</a>
      </div>
    </section>
  `,
})
export class NaoEncontradaPage {}
