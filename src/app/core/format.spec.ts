import { corPartido, data, dinheiroCurto, iniciais, pct } from './format';

describe('format', () => {
  it('formata dinheiro curto', () => {
    expect(dinheiroCurto(268_400)).toBe('R$ 268 mil');
    expect(dinheiroCurto(1_250_000)).toBe('R$ 1,3 mi');
  });

  it('formata datas ISO no padrão brasileiro', () => {
    expect(data('2026-09-16')).toBe('16/09/2026');
    expect(data(null)).toBe('');
  });

  it('calcula porcentagem sem dividir por zero', () => {
    expect(pct(312, 332)).toBe(94);
    expect(pct(1, 0)).toBe(0);
  });

  it('mapeia partido para o token de cor', () => {
    expect(corPartido('UNIÃO')).toBe('var(--party-uniao)');
    expect(corPartido('PSOL')).toBe('var(--party-outros)');
  });

  it('extrai iniciais do nome', () => {
    expect(iniciais('Marina Leite Albuquerque')).toBe('MA');
    expect(iniciais('Luiz Inácio Lula da Silva')).toBe('LS');
  });
});
