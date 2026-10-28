import type { LinhaRanking, RankingSenado } from '../../core/models';
import { classificar, CRITERIOS } from './criterios';

const linha = (codigo: string, partido: string, extra: Partial<LinhaRanking>): LinhaRanking => ({
  codigo, nome: `Senador ${codigo}`, partido, uf: 'DF', sexo: 'M', foto: null,
  votacoes: 100, presentes: 90, comparaveis: 50, comPartido: 45, cota: 100_000, proposicoes: 10, leis: 1, ...extra,
});
const ranking = (linhas: LinhaRanking[]): RankingSenado => ({ legislatura: 57, inicio: '2023-02-01', cotaAno: 2026, atualizadoEm: '', linhas });
const crit = (id: string) => CRITERIOS.find((c) => c.id === id)!;

describe('classificar', () => {
  it('ordena e repete a posição nos empates', () => {
    const r = ranking([
      linha('a', 'X', { presentes: 95 }),
      linha('b', 'X', { presentes: 80 }),
      linha('c', 'Y', { presentes: 95 }),
      linha('d', 'Y', { presentes: 70 }),
    ]);
    const c = classificar(r, crit('presenca'), 'desc');
    expect(c.ranqueados.map((p) => [p.linha.codigo, p.posicao])).toEqual([['a', 1], ['c', 1], ['b', 3], ['d', 4]]);
    expect(c.media).toBeCloseTo(85);
    const asc = classificar(r, crit('presenca'), 'asc');
    expect(asc.ranqueados[0].linha.codigo).toBe('d');
  });

  it('empata quem aparece com a mesma porcentagem, mantendo o valor exato na ordem', () => {
    const r = ranking([linha('a', 'X', { presentes: 424, votacoes: 426 }), linha('b', 'X', { presentes: 59, votacoes: 59 })]);
    const c = classificar(r, crit('presenca'), 'desc');
    expect(c.ranqueados.map((p) => [p.linha.codigo, p.posicao])).toEqual([['b', 1], ['a', 1]]);
  });

  it('deixa de fora quem chegou há pouco e o único do partido', () => {
    const r = ranking([linha('a', 'X', {}), linha('b', 'X', { votacoes: 12, presentes: 12, comparaveis: 8, comPartido: 8 }), linha('c', 'SOLO', {})]);
    expect(classificar(r, crit('presenca'), 'desc').fora.map((f) => f.linha.codigo)).toEqual(['b']);
    const fid = classificar(r, crit('fidelidade'), 'desc');
    expect(fid.fora.map((f) => f.linha.codigo)).toEqual(['b', 'c']);
    expect(fid.fora[1].motivo).toContain('único');
  });

  it('gastos: sem registro no ano fica fora', () => {
    const r = ranking([linha('a', 'X', { cota: 0 }), linha('b', 'X', { cota: 250_000 })]);
    const g = classificar(r, crit('gastos'), 'asc');
    expect(g.ranqueados.map((p) => p.linha.codigo)).toEqual(['b']);
    expect(g.fora[0].motivo).toContain('2026');
  });
});
