import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * Lembra o caminho percorrido dentro do site, para o "Voltar" levar à página de onde a
 * pessoa veio (ranking, votação, plenário…) e não a um destino fixo. Também cuida da
 * rolagem: página nova começa do topo; o "Voltar" restaura a posição; trocar só a aba, um
 * filtro ou o ano (parâmetros do endereço) não move a tela.
 */
@Injectable({ providedIn: 'root' })
export class Historico {
  private readonly pilha: string[] = [];
  private atual: string | null = null;
  private voltando = false;
  /** Se a última navegação mudou de página (e não só os parâmetros, como ?aba=gastos). */
  private mudouDePagina = false;
  private readonly rolagem = new Map<string, number>();
  /** URL da página anterior dentro do site, ou null se a pessoa chegou direto. */
  readonly anterior = signal<string | null>(null);

  constructor() {
    // A rolagem é decidida aqui, não pelo navegador nem pelo roteador.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    // Atualiza já no início da navegação, antes de a página nova ser criada.
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) {
        this.voltando = e.navigationTrigger === 'popstate';
        if (this.atual) this.rolagem.set(this.atual, window.scrollY);
        this.registrar(e.url);
      } else if (e instanceof NavigationEnd) {
        this.atual = e.urlAfterRedirects;
        if (!this.mudouDePagina) return;
        // Voltando: tenta já; páginas que carregam dados chamam de novo quando prontas.
        if (this.voltando) requestAnimationFrame(() => this.restaurarRolagem());
        else window.scrollTo({ top: 0 });
      }
    });
  }

  private registrar(url: string) {
    const mudouDePagina = !this.atual || caminho(this.atual) !== caminho(url);
    this.mudouDePagina = mudouDePagina;
    if (mudouDePagina && this.voltando) this.pilha.pop();
    else if (mudouDePagina && this.atual) this.pilha.push(this.atual);
    this.atual = url;
    this.anterior.set(this.pilha.at(-1) ?? null);
  }

  /** Chamado pela página quando o conteúdo já está na tela: volta à rolagem salva, se veio pelo "Voltar". */
  restaurarRolagem() {
    const y = this.atual ? this.rolagem.get(this.atual) : undefined;
    if (this.voltando && y) requestAnimationFrame(() => window.scrollTo({ top: y }));
  }
}

function caminho(url: string) {
  return url.split(/[?#]/)[0];
}

/** "Voltar ao ranking", "Voltar à votação"… a partir do endereço da página anterior. */
export function rotuloVoltar(url: string): string {
  const c = caminho(url);
  if (c === '/' || c === '') return 'Voltar ao início';
  if (c.startsWith('/indicadores')) return 'Voltar aos indicadores';
  if (c.startsWith('/presidente/comparar')) return 'Voltar à comparação de mandatos';
  if (c.startsWith('/rankings')) return 'Voltar ao ranking';
  if (c.startsWith('/comparar')) return 'Voltar à comparação';
  if (c.startsWith('/votacao/')) return 'Voltar à votação';
  if (c.startsWith('/senado/')) return 'Voltar ao perfil anterior';
  if (c.startsWith('/senado')) return 'Voltar ao plenário';
  if (c.startsWith('/presidente')) return 'Voltar ao Presidente';
  return 'Voltar';
}
