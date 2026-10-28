import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { DataSource } from './core/data-source';
import { SampleDataSource } from './core/sample-data-source';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: DataSource, useClass: SampleDataSource }],
    }).compileComponents();
  });

  it('mostra o menu com Presidente e Senado', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav[aria-label="Principal"]')!;
    expect(nav.textContent).toContain('Presidente');
    expect(nav.textContent).toContain('Senado');
  });

  it('avisa quando os dados são de exemplo', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Dados de exemplo');
  });
});
