import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { DataSource } from './core/data-source';
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
  protected readonly exemplo = this.ds.exemplo;
  protected readonly menuAberto = signal(false);
  protected readonly atualizado = signal<string | null>(null);

  constructor() {
    this.ds.sincronizacao().then((s) => this.atualizado.set(s ? data(s.atualizadoEm) : null)).catch(() => {});
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.menuAberto.set(false));
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
