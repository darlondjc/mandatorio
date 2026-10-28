import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { DataSource } from './core/data-source';
import { Historico } from './core/historico';
import { appCheckSiteKey } from './core/app-check-config';
import { data } from './core/format';
import { Icon } from './shared/icon';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly ds = inject(DataSource);
  // Começa a registrar o caminho desde a primeira página.
  private readonly historico = inject(Historico);
  protected readonly exemplo = this.ds.exemplo;
  /** Com App Check, o selo do reCAPTCHA fica escondido e o aviso exigido pelo Google vai no rodapé do menu. */
  protected readonly recaptcha = !this.ds.exemplo && !!appCheckSiteKey;
  protected readonly menuAberto = signal(false);
  protected readonly atualizado = signal<string | null>(null);
  protected readonly novaVersao = signal(false);

  constructor() {
    this.ds.sincronizacao().then((s) => this.atualizado.set(s ? data(s.atualizadoEm) : null)).catch(() => {});
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.menuAberto.set(false));
    const sw = inject(SwUpdate, { optional: true });
    if (sw?.isEnabled) {
      sw.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => this.novaVersao.set(true));
      sw.unrecoverable.subscribe(() => location.reload());
    }
  }

  protected recarregar() {
    location.reload();
  }

  protected alternarTema() {
    const root = document.documentElement;
    const escuroAgora =
      root.dataset['theme'] === 'dark' || (!root.dataset['theme'] && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset['theme'] = escuroAgora ? 'light' : 'dark';
    try {
      localStorage.setItem('mt-tema', root.dataset['theme']);
    } catch {}
  }
}
