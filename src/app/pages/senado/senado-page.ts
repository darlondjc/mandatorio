import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { Carregando } from '../../shared/carregando';
import { corPartido, data, ufNome } from '../../core/format';
import { Historico } from '../../core/historico';
import type { Cadeira } from '../../core/models';
import { Avatar } from '../../shared/avatar';
import { ModoCor, SeatMap } from '../../shared/seat-map';

@Component({
  selector: 'mt-senado-page',
  imports: [Carregando, RouterLink, SeatMap, Avatar],
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
  /** Senador sob o mouse (ou com foco) na lista: realça a cadeira no plenário. */
  protected readonly realce = signal<string | null>(null);

  protected readonly corPartido = corPartido;
  protected readonly ufNome = ufNome;
  protected readonly data = data;

  protected readonly ufs = computed(() => [...new Set(this.plenario.value()?.cadeiras.map((c) => c.uf) ?? [])].sort());

  protected readonly lista = computed(() =>
    this.filtrar(this.plenario.value()?.cadeiras ?? []).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  );

  /** Quem saiu nesta legislatura, com os mesmos filtros; a ordem (saída mais recente primeiro) vem da coleta. */
  protected readonly saidas = computed(() => this.filtrar(this.plenario.value()?.exSenadores ?? []));

  private filtrar<T extends Cadeira>(lista: T[]): T[] {
    const termo = normalizar(this.busca().trim());
    return lista
      .filter((c) => !this.partido() || c.partido === this.partido())
      .filter((c) => !this.uf() || c.uf === this.uf())
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
  }
}

function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
