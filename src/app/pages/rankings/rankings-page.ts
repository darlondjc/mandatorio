import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { data, ufNome } from '../../core/format';
import { Avatar } from '../../shared/avatar';
import { Tabs } from '../../shared/tabs';
import { classificar, CRITERIOS, Ordem } from './criterios';

@Component({
  selector: 'mt-rankings-page',
  imports: [RouterLink, Avatar, Tabs],
  templateUrl: './rankings-page.html',
  styleUrl: './rankings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingsPage {
  private readonly ds = inject(DataSource);
  private readonly router = inject(Router);
  protected readonly ranking = resource({ loader: () => this.ds.ranking() });

  /** ?criterio=…&ordem=asc, para dar para compartilhar o link. */
  readonly criterio = input<string>();
  readonly ordem = input<string>();

  protected readonly abas = CRITERIOS.map((c) => ({ id: c.id, rotulo: c.rotulo }));
  protected readonly atual = computed(() => CRITERIOS.find((c) => c.id === this.criterio()) ?? CRITERIOS[0]);
  protected readonly sentido = computed<Ordem>(() => (this.ordem() === 'asc' ? 'asc' : 'desc'));

  protected readonly partido = signal('');
  protected readonly uf = signal('');

  protected readonly ufNome = ufNome;
  protected readonly data = data;

  protected readonly classificacao = computed(() => {
    const r = this.ranking.value();
    return r ? classificar(r, this.atual(), this.sentido()) : null;
  });

  protected readonly partidos = computed(() => [...new Set(this.ranking.value()?.linhas.map((l) => l.partido) ?? [])].sort());
  protected readonly ufs = computed(() => [...new Set(this.ranking.value()?.linhas.map((l) => l.uf) ?? [])].sort());

  private readonly passa = (l: { partido: string; uf: string }) =>
    (!this.partido() || l.partido === this.partido()) && (!this.uf() || l.uf === this.uf());

  /** A posição é sempre a do Senado inteiro; os filtros só escondem linhas. */
  protected readonly visiveis = computed(() => this.classificacao()?.ranqueados.filter((p) => this.passa(p.linha)) ?? []);
  protected readonly foraVisiveis = computed(() => this.classificacao()?.fora.filter((f) => this.passa(f.linha)) ?? []);

  protected largura(valor: number) {
    const max = this.classificacao()?.maximo || 1;
    return Math.max(1.5, (valor / max) * 100);
  }

  protected trocarCriterio(id: string) {
    this.navegar({ criterio: id === CRITERIOS[0].id ? null : id, ordem: null });
  }

  protected trocarOrdem(o: Ordem) {
    this.navegar({ ordem: o === 'desc' ? null : o });
  }

  protected limparFiltros() {
    this.partido.set('');
    this.uf.set('');
  }

  private navegar(queryParams: Record<string, string | null>) {
    this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
