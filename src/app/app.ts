import { ChangeDetectionStrategy, Component, effect, inject, signal, viewChild } from '@angular/core';
import { NgProgressbar, NgProgressRef } from 'ngx-progressbar';
import { SwUpdate } from '@angular/service-worker';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Carregamento } from './core/carregamento';
import { filter } from 'rxjs';
import { DataSource } from './core/data-source';
import { Historico } from './core/historico';
import { appCheckSiteKey } from './core/app-check-config';
import { data } from './core/format';
import { Icon } from './shared/icon';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, NgProgressbar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:scroll)': 'aoRolar()' },
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
  /** O botão de voltar ao topo aparece depois de rolar mais de uma tela e meia, mais ou menos. */
  protected readonly mostrarTopo = signal(false);

  /** Barra de progresso do topo: ligada enquanto a página muda ou há dados chegando. */
  private readonly progresso = viewChild(NgProgressRef);
  private readonly navegando = signal(false);
  private readonly carregamento = inject(Carregamento);

  constructor() {
    effect(() => {
      const barra = this.progresso();
      if (!barra) return;
      if (this.navegando() || this.carregamento.ativo()) barra.start();
      else barra.complete();
    });
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) this.navegando.set(true);
      else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) this.navegando.set(false);
    });
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

  protected aoRolar() {
    this.mostrarTopo.set(window.scrollY > Math.max(600, window.innerHeight * 0.8));
  }

  protected irAoTopo() {
    const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduzir ? 'auto' : 'smooth' });
    // O foco vai para o começo do conteúdo (para quem navega pelo teclado) só quando a rolagem
    // termina: no Safari do iPhone, mudar o foco no meio da rolagem suave a interrompe.
    const focar = () => document.getElementById('conteudo')?.focus({ preventScroll: true });
    if (reduzir) return focar();
    const limite = performance.now() + 1500;
    const esperar = () => (window.scrollY <= 1 || performance.now() > limite ? focar() : requestAnimationFrame(esperar));
    requestAnimationFrame(esperar);
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
