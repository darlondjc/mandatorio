import { Carregamento, comCarregamento } from './carregamento';
import { SampleDataSource } from './sample-data-source';

describe('Carregamento', () => {
  it('fica ativo enquanto há buscas pendentes, inclusive quando uma falha', async () => {
    const c = new Carregamento();
    let terminar!: () => void;
    let falhar!: (e: Error) => void;
    const a = c.acompanhar(new Promise<void>((r) => (terminar = r)));
    const b = c.acompanhar(new Promise<void>((_, rej) => (falhar = rej)));
    expect(c.ativo()).toBe(true);
    terminar();
    await a;
    expect(c.ativo()).toBe(true);
    falhar(new Error('x'));
    await b.catch(() => {});
    await Promise.resolve();
    expect(c.ativo()).toBe(false);
  });

  it('envolve a fonte de dados sem mudar o resultado', async () => {
    const c = new Carregamento();
    const ds = comCarregamento(new SampleDataSource(), c);
    const p = ds.plenario();
    expect(c.ativo()).toBe(true);
    expect((await p)?.cadeiras.length).toBe(81);
    await Promise.resolve();
    expect(c.ativo()).toBe(false);
    expect(ds.exemplo).toBe(true);
  });
});
