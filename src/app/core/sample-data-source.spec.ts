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
    expect(d.sim + d.nao + d.abstencao + d.secreto + d.ausente).toBe(votos.length);
    expect(votos.filter((v) => v.divergiu).length).toBe(s.resumo.votosComparaveis - s.resumo.votosComPartido);
  });

  it('respeita o limite de votos pedido', async () => {
    const p = (await ds.plenario())!;
    expect((await ds.votos(p.cadeiras[1].codigo, 10)).length).toBe(10);
  });
});

describe('SampleDataSource — votações', () => {
  const ds = new SampleDataSource();

  it('monta o placar de uma votação a partir dos votos', async () => {
    const v = (await ds.votacao('v0'))!;
    const total = Object.values(v.placar).reduce((a, b) => a + b, 0);
    expect(total).toBe(v.votos.length);
    expect(v.secreta).toBe(false);
  });

  it('marca como secreta a votação em que ninguém votou Sim ou Não', async () => {
    const v = (await ds.votacao('v4'))!;
    expect(v.secreta).toBe(true);
    expect(v.placar.sim + v.placar.nao).toBe(0);
  });

  it('devolve null para votação inexistente', async () => {
    expect(await ds.votacao('nao-existe')).toBeNull();
  });
});

describe('SampleDataSource — quem saiu', () => {
  const ds = new SampleDataSource();

  it('lista quem saiu fora das 81 cadeiras, com perfil e votos até a saída', async () => {
    const p = (await ds.plenario())!;
    const ex = p.exSenadores ?? [];
    expect(ex.length).toBe(3);
    expect(ex.some((e) => p.cadeiras.some((c) => c.codigo === e.codigo))).toBe(false);
    const s = (await ds.senador(ex[0].codigo))!;
    expect(s.emExercicio).toBe(false);
    expect(s.saida?.data).toBe(ex[0].saida.data);
    const votos = await ds.votos(s.codigo, 1000);
    expect(votos.length).toBe(ex[0].votacoes);
    expect(votos.every((v) => v.data <= ex[0].saida.data!)).toBe(true);
  });

  it('cada votação tem no máximo 81 votos, contando quem saiu', async () => {
    for (const id of ['v0', 'v20', 'v59']) {
      const v = (await ds.votacao(id))!;
      expect(v.votos.length).toBe(81);
    }
  });
});
