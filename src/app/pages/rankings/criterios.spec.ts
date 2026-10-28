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

  it('99,5% não aparece como 100%: só quem esteve em todas tem 100%', () => {
    const r = ranking([linha('a', 'X', { presentes: 424, votacoes: 426 }), linha('b', 'X', { presentes: 59, votacoes: 59 })]);
    const c = classificar(r, crit('presenca'), 'desc');
    expect(c.ranqueados.map((p) => [p.linha.codigo, p.posicao])).toEqual([['b', 1], ['a', 2]]);
    expect(crit('presenca').formatar(c.ranqueados[1].valor)).toBe('99,5%');
    expect(crit('presenca').formatar(99.97)).toBe('99,9%');
    expect(crit('presenca').formatar(100)).toBe('100%');
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

describe('ordem entre iguais e período em exercício', () => {
  it('entre os 100%, fica acima quem tem mais votações', () => {
    const r = ranking([
      linha('novo', 'X', { votacoes: 59, presentes: 59 }),
      linha('antigo', 'X', { votacoes: 426, presentes: 426 }),
      linha('outro', 'Y', { votacoes: 426, presentes: 426 }),
    ]);
    const c = classificar(r, crit('presenca'), 'desc');
    expect(c.ranqueados.map((p) => [p.linha.codigo, p.posicao])).toEqual([['antigo', 1], ['outro', 1], ['novo', 3]]);
  });

  it('a nota de presença traz só os números', () => {
    const r = { ...ranking([]), votacoes: 426 };
    expect(crit('presenca').nota(linha('a', 'X', { votacoes: 59, presentes: 59 }), r)).toBe('59 de 59 votações');
  });
});
