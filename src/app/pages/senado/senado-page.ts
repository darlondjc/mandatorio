import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { corPartido, ufNome } from '../../core/format';
import { Avatar } from '../../shared/avatar';
import { ModoCor, SeatMap } from '../../shared/seat-map';

@Component({
  selector: 'mt-senado-page',
  imports: [RouterLink, SeatMap, Avatar],
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

  protected readonly ufs = computed(() => [...new Set(this.plenario.value()?.cadeiras.map((c) => c.uf) ?? [])].sort());

  protected readonly lista = computed(() => {
    const p = this.plenario.value();
    if (!p) return [];
    const termo = normalizar(this.busca().trim());
    return p.cadeiras
      .filter((c) => !this.partido() || c.partido === this.partido())
      .filter((c) => !this.uf() || c.uf === this.uf())
      .filter((c) => !termo || normalizar(`${c.nome} ${c.partido} ${c.uf} ${ufNome(c.uf)}`).includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  });

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
