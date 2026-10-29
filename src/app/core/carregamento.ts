import { Injectable, computed, signal } from '@angular/core';
import { DataSource } from './data-source';

/** Quantas buscas de dados estão em andamento: a barra de progresso do topo acompanha isso. */
@Injectable({ providedIn: 'root' })
export class Carregamento {
  private readonly pendentes = signal(0);
  readonly ativo = computed(() => this.pendentes() > 0);

  acompanhar<T>(p: Promise<T>): Promise<T> {
    this.pendentes.update((n) => n + 1);
    p.finally(() => this.pendentes.update((n) => Math.max(0, n - 1))).catch(() => {});
    return p;
  }
}

/**
 * Envolve a fonte de dados para registrar cada busca no Carregamento, sem mudar as páginas:
 * todo método que devolve uma Promise passa a contar enquanto não termina.
 */
export function comCarregamento(ds: DataSource, carregamento: Carregamento): DataSource {
  return new Proxy(ds, {
    get(alvo, chave, receptor) {
      const valor = Reflect.get(alvo, chave, receptor);
      if (typeof valor !== 'function') return valor;
      return (...args: unknown[]) => {
        const r = valor.apply(alvo, args);
        return r instanceof Promise ? carregamento.acompanhar(r) : r;
      };
    },
  });
}
