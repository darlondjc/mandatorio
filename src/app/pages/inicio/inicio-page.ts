import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { data } from '../../core/format';
import { Icon } from '../../shared/icon';

interface Secao {
  link: string;
  icone: string;
  titulo: string;
  texto: string;
}

/** Página inicial: o que é o Mandatório, por onde começar e de onde vêm os dados. */
@Component({
  selector: 'mt-inicio-page',
  imports: [RouterLink, Icon],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPage {
  private readonly ds = inject(DataSource);
  private readonly sinc = resource({ loader: () => this.ds.sincronizacao().catch(() => null) });
  protected readonly atualizado = computed(() => {
    const s = this.sinc.value();
    return s ? data(s.atualizadoEm) : null;
  });

  constructor() {
    // Enquanto a pessoa lê, adianta os dados (pequenos) de Presidente e Indicadores: ficam
    // guardados e essas telas abrem sem esperar o banco.
    const t = setTimeout(() => {
      this.ds.presidentes().catch(() => {});
      this.ds.indicadores().catch(() => {});
    }, 1500);
    inject(DestroyRef).onDestroy(() => clearTimeout(t));
  }

  protected readonly secoes: Secao[] = [
    { link: '/presidente', icone: 'presidente', titulo: 'Presidente', texto: 'O que cada presidente fez desde 2003: projetos enviados ao Congresso, medidas provisórias e vetos, e quantos viraram lei.' },
    { link: '/presidente/comparar', icone: 'comparar', titulo: 'Comparar mandatos', texto: 'Os mandatos presidenciais lado a lado, por ano ou em porcentagem, porque têm durações diferentes.' },
    { link: '/indicadores', icone: 'indicadores', titulo: 'O país em cada mandato', texto: 'Inflação, desemprego, PIB, salário mínimo, gasolina, dívida, desmatamento e feminicídio ano a ano, com os mandatos ao fundo.' },
    { link: '/senado', icone: 'senado', titulo: 'Senado', texto: 'Os 81 senadores no plenário. No perfil de cada um: como vota, quanto gasta da cota parlamentar, projetos e comissões.' },
    { link: '/rankings', icone: 'rankings', titulo: 'Rankings', texto: 'Quem mais e quem menos comparece às votações, segue o partido, gasta a cota e apresenta projetos.' },
    { link: '/comparar', icone: 'comparar', titulo: 'Comparar senadores', texto: 'Dois senadores frente a frente: presença, gastos, projetos e como cada um votou nas mesmas votações.' },
  ];
}
