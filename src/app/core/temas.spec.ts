import { perfilTematico, temaDaEmenta } from './temas';

describe('temas', () => {
  it('classifica ementas pelos assuntos', () => {
    expect(temaDaEmenta('Altera a Lei nº 8.080 para garantir atendimento no SUS')).toBe('saude');
    expect(temaDaEmenta('Altera o Código Penal para aumentar a pena do crime de furto')).toBe('seguranca');
    expect(temaDaEmenta('Dispõe sobre o Imposto sobre a Renda das Pessoas Físicas')).toBe('economia');
    expect(temaDaEmenta('Institui o Dia Nacional do Forró')).toBe('homenagem');
    expect(temaDaEmenta('Susta os efeitos do Decreto nº 1')).toBeNull();
  });

  it('deixa PECs de fora e compara com a média do Senado', () => {
    const p = (materia: string, ementa: string) => ({ materia, ementa });
    const lista = [
      ...Array.from({ length: 8 }, (_, i) => p(`PL ${i}/2025`, 'Altera o Código Penal para tipificar o crime')),
      ...Array.from({ length: 4 }, (_, i) => p(`PL ${10 + i}/2025`, 'Dispõe sobre o atendimento no SUS')),
      ...Array.from({ length: 30 }, (_, i) => p(`PEC ${i}/2025`, 'Altera a Constituição para tratar de tributos')),
    ];
    const perfil = perfilTematico(lista)!;
    expect(perfil.total).toBe(12);
    expect([perfil.temas[0].id, perfil.temas[0].pct]).toEqual(['seguranca', 67]);
    expect(perfil.destaque).toBe('estado');
  });

  it('não afirma perfil com poucos projetos', () => {
    expect(perfilTematico([{ materia: 'PL 1/2025', ementa: 'SUS' }])).toBeNull();
  });
});
