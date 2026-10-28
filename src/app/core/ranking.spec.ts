import { pctExibido } from './format';
import { inicioDaLegislatura } from './ranking';

describe('inicioDaLegislatura', () => {
  it('acha o 1º de fevereiro da legislatura em curso', () => {
    expect(inicioDaLegislatura('2026-10-28T06:00:00Z')).toBe('2023-02-01');
    expect(inicioDaLegislatura('2027-01-31')).toBe('2023-02-01');
    expect(inicioDaLegislatura('2027-02-01')).toBe('2027-02-01');
    expect(inicioDaLegislatura('2022-05-01')).toBe('2019-02-01');
  });
});

describe('pctExibido', () => {
  it('não mostra 100% nem 0% quando não é', () => {
    expect(pctExibido(99.53)).toBe(99);
    expect(pctExibido(99.53, 1)).toBe(99.5);
    expect(pctExibido(99.98, 1)).toBe(99.9);
    expect(pctExibido(100)).toBe(100);
    expect(pctExibido(0.2)).toBe(1);
    expect(pctExibido(0)).toBe(0);
    expect(pctExibido(87.44)).toBe(87);
  });
});
