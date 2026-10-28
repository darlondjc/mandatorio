import { inicioDaLegislatura } from './ranking';

describe('inicioDaLegislatura', () => {
  it('acha o 1º de fevereiro da legislatura em curso', () => {
    expect(inicioDaLegislatura('2026-10-28T06:00:00Z')).toBe('2023-02-01');
    expect(inicioDaLegislatura('2027-01-31')).toBe('2023-02-01');
    expect(inicioDaLegislatura('2027-02-01')).toBe('2027-02-01');
    expect(inicioDaLegislatura('2022-05-01')).toBe('2019-02-01');
  });
});
