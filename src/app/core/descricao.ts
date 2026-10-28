// Descrição curta de uma votação: só o que a distingue das outras da mesma matéria.
// O Senado escreve "Votação nominal do Projeto de Lei nº 2.159, de 2021, nos termos do
// parecer (1º turno)."; nas listas basta "1º turno". A descrição completa continua
// guardada e aparece na página da votação.

const semAcento = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** "Votação nominal do Requerimento nº 911, de 2025, …" -> "Requerimento nº 911, de 2025, …" */
function semPrefixo(d: string) {
  return d
    .replace(/^\s*\(+/, '')
    .replace(/^\s*vota[cç][aã]o( nominal| simb[oó]lica)?\s+(d[aoe]s?\s+)?/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\.\s*$/, '')
    .trim();
}

/** "Proposta de Emenda à Constituição nº 48, de 2023" -> "PEC 48/2023" */
function abreviar(s: string) {
  return s
    .replace(/Proposta de Emenda (à|a) Constitui[cç][aã]o/gi, 'PEC')
    .replace(/Projeto de Lei Complementar/gi, 'PLP')
    .replace(/Projeto de Decreto Legislativo/gi, 'PDL')
    .replace(/Projeto de Lei/gi, 'PL')
    .replace(/Medida Provis[oó]ria/gi, 'MPV')
    .replace(/\s*n[º°o]\s*([\d.]+),? de (\d{4})/gi, ' $1/$2')
    .replace(/\s*n[º°o]\s*/gi, ' ');
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Corta numa fronteira de palavra, com reticências. */
function curto(s: string, max = 90) {
  if (s.length <= max) return s;
  return s.slice(0, s.lastIndexOf(' ', max)).replace(/[,;:\s]+$/, '') + '…';
}

/**
 * Resumo do que foi votado, ou null quando a descrição não acrescenta nada à matéria
 * (por exemplo, "Votação nominal do PL nº 1, nos termos do parecer").
 */
export function descricaoCurta(descricao: string | null | undefined): string | null {
  if (!descricao?.trim()) return null;
  const texto = semPrefixo(descricao);
  const s = semAcento(texto);

  // Indicação de autoridade: "Mensagem nº 12 - Gabriel Galípolo (Banco Central do Brasil)".
  const indicacao = texto.match(/\s[-–]\s([^()]+?)\s*\(([^)]+)\)\s*$/);
  if (indicacao && /^(mensagem|oficio|ofício)/i.test(texto)) return `Indicação de ${indicacao[1].trim()} (${indicacao[2].trim()})`;

  if (/pressupostos constitucionais/.test(s)) return 'Admissibilidade (pressupostos constitucionais)';

  // Requerimentos: o que pedem.
  if (/^(requerimento|rqs\b|solicita\b)/.test(s)) {
    if (/calendario especial/.test(s)) {
      const alvo = texto.match(/calend[aá]rio especial para a?o?\s*(.+)$/i)?.[1];
      return `Requerimento de calendário especial${alvo ? ` (${curto(abreviar(alvo), 40)})` : ''}`;
    }
    if (/encerramento da discussao/.test(s)) return 'Requerimento de encerramento da discussão';
    if (/preferencia/.test(s)) return 'Requerimento de preferência na votação';
    if (/urgencia/.test(s)) return 'Requerimento de urgência';
    if (/adiamento/.test(s)) return 'Requerimento de adiamento';
    const pedido = texto.match(/(?:que )?solicita\s+(.+)$/i)?.[1];
    return pedido ? `Requerimento: ${curto(abreviar(pedido), 70)}` : 'Requerimento';
  }

  const partes: string[] = [];
  const emenda = texto.match(/^emenda n[º°o]\s*([\d.]+)/i)?.[1];
  if (/^express/.test(s)) partes.push('Destaque de trecho');
  else if (emenda && /substitutivo/.test(s) && !/ao substitutivo/.test(s)) partes.push(`Substitutivo (emenda nº ${emenda})`);
  else if (emenda && /destacad/.test(s)) partes.push(`Destaque da emenda nº ${emenda}`);
  else if (emenda) partes.push(`Emenda nº ${emenda}`);
  else if (/^subemenda/.test(s) && /destacad/.test(s)) partes.push('Destaque de subemenda');
  else if (/^substitutivo da camara/.test(s)) partes.push('Substitutivo da Câmara');
  else if (/^substitutivo/.test(s)) partes.push('Substitutivo');
  else if (/destacad/.test(s)) partes.push('Destaque de trecho');

  const turno = s.match(/\(?(1|2)[º°o]\s*turno|(primeiro|segundo) turno/);
  if (turno) partes.push(turno[1] === '2' || turno[2] === 'segundo' ? '2º turno' : '1º turno');
  if (/ressalvad[oa]s? (o|os|a|as) destaques?/.test(s)) partes.push(partes.length ? 'ressalvados os destaques' : 'Texto principal, ressalvados os destaques');

  if (partes.length) return maiuscula(partes.join(', '));
  // Só "nos termos do parecer" ou só a matéria: nada a acrescentar.
  if (/^(projeto|proposta|medida|pec|pl|plp|pdl|prs|mpv|plv)\b/.test(s) && !indicacao) return null;
  return curto(maiuscula(abreviar(texto)));
}
