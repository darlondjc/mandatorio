import { SampleDataSource } from './sample-data-source';

describe('SampleDataSource', () => {
  const ds = new SampleDataSource();

  it('monta um plenário de 81 cadeiras, 3 por estado', async () => {
    const p = (await ds.plenario())!;
    expect(p.cadeiras.length).toBe(81);
    expect(p.partidos.reduce((s, x) => s + x.total, 0)).toBe(81);
    const porUf = new Map<string, number>();
    p.cadeiras.forEach((c) => porUf.set(c.uf, (porUf.get(c.uf) ?? 0) + 1));
    expect([...porUf.values()].every((n) => n === 3)).toBe(true);
  });

  it('mantém o resumo do senador coerente com os votos', async () => {
    const p = (await ds.plenario())!;
    const s = (await ds.senador(p.cadeiras[0].codigo))!;
    const votos = await ds.votos(s.codigo, 1000);
    const d = s.resumo.distribuicao;
    expect(d.sim + d.nao + d.abstencao + d.ausente).toBe(votos.length);
    expect(votos.filter((v) => v.divergiu).length).toBe(s.resumo.votosComparaveis - s.resumo.votosComPartido);
  });

  it('respeita o limite de votos pedido', async () => {
    const p = (await ds.plenario())!;
    expect((await ds.votos(p.cadeiras[1].codigo, 10)).length).toBe(10);
  });
});
