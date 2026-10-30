import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { Esqueleto } from '../../shared/esqueleto';
import { corPartido, data, ufNome } from '../../core/format';
import { Historico } from '../../core/historico';
import type { Cadeira } from '../../core/models';
import { Avatar } from '../../shared/avatar';
import { ModoCor, SeatMap } from '../../shared/seat-map';

@Component({
  selector: 'mt-senado-page',
  imports: [Esqueleto, RouterLink, SeatMap, Avatar],
  templateUrl: './senado-page.html',
  styleUrl: './senado-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SenadoPage {
  private readonly ds = inject(DataSource);
  protected readonly plenario = resource({ loader: () => this.ds.plenario() });

  protected readonly modo = signal<ModoCor>('partido');
  protected readonly partido = signal<string | null>(null);
  protected readonly busca = signal('');
  protected readonly uf = signal('');
  /** Só quem teve despesa da cota fora do padrão nesta legislatura. */
  protected readonly soForaDoPadrao = signal(false);
  /** Senador sob o mouse (ou com foco) na lista: realça a cadeira no plenário. */
  protected readonly realce = signal<string | null>(null);

  protected readonly corPartido = corPartido;
  protected readonly ufNome = ufNome;
  protected readonly data = data;

  /** O filtro só aparece quando a coleta já contou os casos. */
  protected readonly temForaDoPadrao = computed(() => this.plenario.value()?.cadeiras.some((c) => c.foraDoPadrao) ?? false);

  protected readonly ufs = computed(() => [...new Set(this.plenario.value()?.cadeiras.map((c) => c.uf) ?? [])].sort());

  protected readonly lista = computed(() =>
    this.filtrar(this.plenario.value()?.cadeiras ?? []).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  );

  /**
   * Busca e estado também valem para o plenário: as cadeiras de fora se apagam e o centro
   * conta as encontradas. O filtro de partido o próprio plenário já trata.
   */
  protected readonly apagadas = computed(() => {
    if (!this.busca().trim() && !this.uf() && !this.soForaDoPadrao()) return null;
    const ficam = new Set(this.lista().map((c) => c.codigo));
    return new Set((this.plenario.value()?.cadeiras ?? []).filter((c) => !ficam.has(c.codigo)).map((c) => c.codigo));
  });
  protected readonly centro = computed(() => {
    if (!this.apagadas()) return null;
    const n = this.lista().length;
    return { numero: n, legenda: n === 1 ? 'senador encontrado' : 'senadores encontrados' };
  });

  /** Quem saiu nesta legislatura, com os mesmos filtros; a ordem (saída mais recente primeiro) vem da coleta. */
  protected readonly saidas = computed(() => this.filtrar(this.plenario.value()?.exSenadores ?? []));

  private filtrar<T extends Cadeira>(lista: T[]): T[] {
    const termo = normalizar(this.busca().trim());
    return lista
      .filter((c) => !this.partido() || c.partido === this.partido())
      .filter((c) => !this.uf() || c.uf === this.uf())
      .filter((c) => !this.soForaDoPadrao() || !!c.foraDoPadrao)
      .filter((c) => !termo || normalizar(`${c.nome} ${c.partido} ${c.uf} ${ufNome(c.uf)}`).includes(termo));
  }

  constructor() {
    const historico = inject(Historico);
    let restaurou = false;
    effect(() => {
      if (!restaurou && this.plenario.value()) {
        restaurou = true;
        historico.restaurarRolagem();
      }
    });
  }

  protected alternarPartido(sigla: string) {
    this.partido.update((atual) => (atual === sigla ? null : sigla));
  }

  protected limparFiltros() {
    this.partido.set(null);
    this.uf.set('');
    this.busca.set('');
    this.soForaDoPadrao.set(false);
  }
}

function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
