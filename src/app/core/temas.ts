// Perfil de atuação: classifica os projetos de autoria pelo assunto da ementa.
// É uma classificação automática por palavras-chave, simples e verificável; serve para
// mostrar onde o parlamentar concentra a produção, não para rotular cada projeto.

import type { Proposicao } from './models';

export type EixoId = 'social' | 'economico' | 'estado';

export interface Tema {
  id: string;
  rotulo: string;
  eixo: EixoId;
  /** Expressões sobre a ementa sem acentos e em minúsculas. */
  regra: RegExp;
}

export const EIXOS: Record<EixoId, string> = {
  social: 'Social',
  economico: 'Economia e infraestrutura',
  estado: 'Estado, justiça e segurança',
};

/** Para a frase "Mais voltado ___ que a média do Senado". */
export const VOLTADO_A: Record<EixoId, string> = {
  social: 'à área social',
  economico: 'à economia e infraestrutura',
  estado: 'a Estado, justiça e segurança',
};

// A ordem importa só no desempate: um projeto pode cair em mais de um tema.
export const TEMAS: Tema[] = [
  { id: 'saude', rotulo: 'Saúde', eixo: 'social', regra: /\bsaude\b|\bsus\b|hospita|medicament|doenc|vacin|sanitari|farmac|\bmedic[oa]s?\b|enfermag|cancer|oncolog|deficiencia|autis|obesidade|odontolog|psicolog|saude mental|drogas?\b|aborto|pesquisa com seres humanos/ },
  { id: 'educacao', rotulo: 'Educação', eixo: 'social', regra: /educa|escol|ensino|universi|professor|estudant|alfabetiz|creche|fundeb|enem\b|bolsa de estudo|pesquisa cientific|ciencia e tecnologia/ },
  { id: 'direitos', rotulo: 'Direitos e assistência social', eixo: 'social', regra: /assistencia social|crianc|adolesc|idos[oa]|mulher|violencia domestica|feminic|genero|igualdade|raci[as]|indigen|quilombol|famili|pobreza|\bfome\b|seguranca alimentar|bolsa familia|moradia|habitac|direitos humanos|pessoa com deficiencia|lgbt|juventude|cultura|esporte|desporto|renda basica|transferencia de renda|calamidade|desastre|defesa civil|vulnerabilidade|inclusao social|voluntari|autonomia funcional/ },
  { id: 'trabalho', rotulo: 'Trabalho e previdência', eixo: 'social', regra: /trabalh|emprego|previd|aposent|pensao|salari|\bclt\b|sindica|fgts|seguro-desemprego|servidor(es)? publico|licenca-(maternidade|paternidade)|8\.213/ },
  { id: 'economia', rotulo: 'Economia e tributos', eixo: 'economico', regra: /tribut|impost|\bicms\b|\bipi\b|\birpf?\b|contribuic|fiscal|orcament|economi|empres|microempreend|\bmei\b|credito|financ|banc[oa]|juros|divida|comerci|consumidor|mercado|investiment|concorrencia|simples nacional|reforma tributaria|apostas|loteria|jogos de azar|moeda|investidor|pessoas? juridicas?|beneficiario final|cooperativ|armazenagem|producao\b/ },
  { id: 'agro', rotulo: 'Agro e meio ambiente', eixo: 'economico', regra: /agro|rural|agricult|pecuar|pesca|aquicult|florest|ambient|clima|desmatament|amazonia|mineracao|minerio|recursos hidricos|\bagua\b|saneamento|residuos|biodivers|queimad|fundiari|animais|maus-tratos|9\.605|paisagem|desapropriac|alimenta brasil/ },
  { id: 'infraestrutura', rotulo: 'Infraestrutura, energia e transporte', eixo: 'economico', regra: /transport|rodovi|ferrovi|hidrovi|aeroport|aviac|portos?\b|transito|veiculo|energi|eletric|combustiv|petrole|gas natural|telecom|internet|radiodifus|obras|infraestrutura|mobilidade|turismo|tecnologia da informacao|inteligencia artificial|dados pessoais|conectividade|marco civil|12\.965|transicao energetica/ },
  { id: 'seguranca', rotulo: 'Segurança e justiça', eixo: 'estado', regra: /penal|crime|criminal|seguranca publica|polic|prisao|prisional|presidi|violencia|\barmas?\b|armament|codigo de processo|trafico|homicid|estupro|corrupc|lavagem|organizac(ao|oes) criminos|juizad|tribunal|judicia|ministerio publico|contravenc|codigo civil|10\.406|registros publicos|extincao de dominio|lawfare|partilha|divorcio|casamento/ },
  { id: 'estado', rotulo: 'Estado e sistema político', eixo: 'estado', regra: /eleitor|eleic|partido|mandato|parlament|congresso|senado federal|camara dos deputados|regimento interno|administracao publica|licitac|transparencia|municipi|estados e (o )?distrito|federativ|emenda constitucional|constituic|forcas armadas|defesa nacional|relacoes exteriores|tratado|acordo internacional|plebiscito|referendo|improbidade|8\.429|agencias reguladoras|candidatur|audiencias e consultas publicas/ },
];

/**
 * Média do Senado (out/2026): parcela de cada eixo e tema nos projetos classificados, na
 * média dos 76 senadores com pelo menos 10 projetos classificados. Serve de referência para
 * dizer se alguém é "mais voltado a" uma área; como quase todo mundo produz mais na área
 * social, olhar só o maior eixo diria a mesma coisa de quase todos.
 */
export const MEDIA_SENADO = {
  eixos: { social: 45, economico: 33, estado: 22 } as Record<EixoId, number>,
  temas: { saude: 15, educacao: 10, direitos: 13, trabalho: 7, economia: 22, agro: 4, infraestrutura: 7, seguranca: 12, estado: 10 } as Record<string, number>,
};

/** Homenagens, datas comemorativas e denominações: comuns e pouco informativas sobre o foco. */
const HOMENAGEM = /institui o dia|dia nacional|semana nacional|mes nacional|ano nacional|denomina|confere (o )?titulo|declara patron|inscreve o nome|livro dos herois|homenage|capital nacional d|patrimonio (cultural|historico)|comend|diploma|premio/;

const semAcento = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Tema principal de uma ementa (o primeiro que casar), 'homenagem' ou null. */
export function temaDaEmenta(ementa: string): string | null {
  const e = semAcento(ementa);
  if (HOMENAGEM.test(e)) return 'homenagem';
  return TEMAS.find((t) => t.regra.test(e))?.id ?? null;
}

export interface PerfilTematico {
  /** Projetos considerados (sem PECs coletivas, ver abaixo). */
  total: number;
  classificados: number;
  homenagens: number;
  /** Temas com contagem, do maior para o menor. */
  temas: { id: string; rotulo: string; eixo: EixoId; n: number; pct: number; media: number }[];
  /** Divisão entre os eixos, em % dos projetos classificados, com a média do Senado. */
  eixos: { id: EixoId; rotulo: string; n: number; pct: number; media: number }[];
  /** Eixo em que está pelo menos 10 pontos acima da média do Senado (o de maior diferença), ou null. */
  destaque: EixoId | null;
}

/**
 * PECs precisam da assinatura de 27 senadores, então aparecem na autoria de quase todos e
 * diluiriam o perfil. Ficam de fora; os demais projetos (PL, PLP, PDL, PRS…) entram.
 */
export function perfilTematico(proposicoes: Pick<Proposicao, 'materia' | 'ementa'>[]): PerfilTematico | null {
  const considerados = proposicoes.filter((p) => !p.materia.startsWith('PEC '));
  if (considerados.length < 5) return null;
  const cont = new Map<string, number>();
  let homenagens = 0;
  for (const p of considerados) {
    const t = temaDaEmenta(p.ementa);
    if (t === 'homenagem') homenagens++;
    else if (t) cont.set(t, (cont.get(t) ?? 0) + 1);
  }
  const classificados = [...cont.values()].reduce((a, b) => a + b, 0);
  if (!classificados) return null;
  const pct = (n: number) => Math.round((n / classificados) * 100);
  const temas = TEMAS.filter((t) => cont.get(t.id))
    .map((t) => ({ id: t.id, rotulo: t.rotulo, eixo: t.eixo, n: cont.get(t.id)!, pct: pct(cont.get(t.id)!), media: MEDIA_SENADO.temas[t.id] ?? 0 }))
    .sort((a, b) => b.n - a.n);
  const eixos = (Object.keys(EIXOS) as EixoId[]).map((id) => {
    const n = temas.filter((t) => t.eixo === id).reduce((a, t) => a + t.n, 0);
    return { id, rotulo: EIXOS[id], n, pct: pct(n), media: MEDIA_SENADO.eixos[id] };
  });
  // Com poucos projetos a porcentagem oscila demais para afirmar um foco.
  const acima = [...eixos].sort((a, b) => b.pct - b.media - (a.pct - a.media))[0];
  const destaque = classificados >= 10 && acima.pct - acima.media >= 10 ? acima.id : null;
  return { total: considerados.length, classificados, homenagens, temas, eixos, destaque };
}
