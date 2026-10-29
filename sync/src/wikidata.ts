// Wikidata: cada senador tem lá o código do Senado como identificador, o que liga o item
// sem depender do nome. Daqui vêm fotos melhores (fotos.ts) e as profissões, que a API do
// Senado não traz (o endpoint /profissao devolve só o histórico acadêmico, quase sempre vazio).

import { getJson, lista } from './http.ts';

type Json = Record<string, any>;

export const sparql = async (q: string) =>
  lista<Json>((await getJson<Json>(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`))?.results?.bindings);

let propriedades: Promise<{ pid: string; formato: string }[]> | null = null;

/**
 * Propriedades de identificador do Senado, achadas pelo endereço de formatação
 * (senado.leg.br) em vez de fixar o número delas. Consultadas uma vez por coleta.
 */
export function propriedadesSenado() {
  propriedades ??= sparql(
    'SELECT ?p ?f WHERE { ?p wikibase:propertyType wikibase:ExternalId; wdt:P1630 ?f . FILTER(CONTAINS(LCASE(STR(?f)), "senado.leg.br")) }',
  ).then((r) =>
    r
      .map((p) => ({ pid: String(p.p?.value ?? '').split('/').at(-1) ?? '', formato: String(p.f?.value ?? '') }))
      .filter((p) => p.pid.startsWith('P')),
  );
  return propriedades;
}

export interface Ocupacao {
  masculino: string;
  feminino: string | null;
}

export const diagProfissoes = { comProfissao: 0, semProfissao: 0, exemplos: [] as string[], erro: null as string | null };

/** Ocupações (P106) de cada senador no Wikidata, pelo código do Senado, com o item de origem. */
export async function ocupacoesWikidata(): Promise<Map<string, { item: string; ocupacoes: Ocupacao[] }>> {
  const out = new Map<string, { item: string; ocupacoes: Ocupacao[] }>();
  for (const { pid } of await propriedadesSenado()) {
    const linhas = await sparql(`SELECT ?id ?item ?nome ?fem WHERE {
      ?item wdt:${pid} ?id; wdt:P106 ?oc .
      OPTIONAL { ?oc rdfs:label ?br FILTER(LANG(?br) = "pt-br") }
      OPTIONAL { ?oc rdfs:label ?pt FILTER(LANG(?pt) = "pt") }
      OPTIONAL { ?oc wdt:P2521 ?fem FILTER(LANG(?fem) = "pt" || LANG(?fem) = "pt-br") }
      BIND(COALESCE(?br, ?pt) AS ?nome)
      FILTER(BOUND(?nome))
    }`);
    for (const r of linhas) {
      const id = String(r.id?.value ?? '');
      if (!/^\d+$/.test(id)) continue;
      const atual = out.get(id) ?? { item: String(r.item?.value ?? ''), ocupacoes: [] };
      const masculino = String(r.nome.value);
      if (!atual.ocupacoes.some((o) => o.masculino === masculino)) atual.ocupacoes.push({ masculino, feminino: r.fem?.value ? String(r.fem.value) : null });
      out.set(id, atual);
    }
  }
  return out;
}

/** Cargos e funções públicas não são profissão: o perfil já diz que a pessoa é senadora. */
const NAO_PROFISSAO = /^(politic|senador|deputad|vereador|prefeit|vice|governador|parlamentar|ministr|secretari|president|lider|membro|candidat|estadista)/;

const semAcento = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** "Médico, Professor": até três profissões, no feminino quando o Wikidata tem a forma. */
export function profissaoTexto(ocupacoes: Ocupacao[], sexo: 'M' | 'F'): string | null {
  const nomes = ocupacoes
    .map((o) => (sexo === 'F' && o.feminino ? o.feminino : o.masculino).trim())
    .filter((n) => n && !NAO_PROFISSAO.test(semAcento(n)) && !/^Q\d+$/.test(n))
    .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
    .filter((n, i, a) => a.indexOf(n) === i)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return nomes.length ? nomes.slice(0, 3).join(', ') : null;
}
