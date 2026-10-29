// Wikidata: cada senador tem lá o código do Senado como identificador, o que liga o item
// sem depender do nome. Daqui vêm fotos melhores (fotos.ts).

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
