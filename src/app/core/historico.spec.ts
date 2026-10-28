import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { Historico, rotuloVoltar } from './historico';

@Component({ template: '' })
class Vazia {}

describe('Historico', () => {
  it('guarda a página anterior e ignora troca só de filtros', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: Vazia }])],
    });
    const h = TestBed.inject(Historico);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/rankings');
    expect(h.anterior()).toBeNull();
    await router.navigateByUrl('/rankings?criterio=gastos');
    expect(h.anterior()).toBeNull();
    await router.navigateByUrl('/senado/5012');
    expect(h.anterior()).toBe('/rankings?criterio=gastos');
    await router.navigateByUrl('/senado/5040');
    expect(h.anterior()).toBe('/senado/5012');
  });

  it('dá nome ao destino do Voltar', () => {
    expect(rotuloVoltar('/rankings?criterio=gastos')).toBe('Voltar ao ranking');
    expect(rotuloVoltar('/votacao/7108')).toBe('Voltar à votação');
    expect(rotuloVoltar('/senado')).toBe('Voltar ao plenário');
    expect(rotuloVoltar('/senado/5012?aba=gastos')).toBe('Voltar ao perfil anterior');
  });
});
