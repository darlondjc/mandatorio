// Fotos dos senadores. A foto oficial que a API do Senado indica costuma ser pequena e fica
// borrada no círculo do perfil (150 px, 300 px em telas de alta densidade). Quando ela é
// pequena, usa a imagem do senador no Wikidata/Wikimedia Commons, se houver uma boa.

import { getJson, lista } from './http.ts';

type Json = Record<string, any>;

/** Largura mínima para o círculo do perfil ficar nítido em telas de alta densidade. */
export const LARGURA_BOA = 300;

export const diagFotosSenado = {
  tamanhosSenado: new Map<string, number>(),
  propriedades: [] as string[],
  noWikidata: 0,
  trocadas: 0,
  exemplos: [] as string[],
  erros: [] as string[],
};

/** Largura e altura de um JPEG ou PNG a partir dos primeiros bytes. */
export function dimensoesImagem(b: Uint8Array): { largura: number; altura: number } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { largura: v.getUint32(16), altura: v.getUint32(20) };
  }
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marcador = b[i + 1];
    const tamanho = (b[i + 2] << 8) | b[i + 3];
    // SOF0–SOF15, exceto DHT (C4), JPG (C8) e DAC (CC): trazem altura e largura.
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
      return { altura: (b[i + 5] << 8) | b[i + 6], largura: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + tamanho;
  }
  return null;
}

/** Baixa só o começo da imagem (o cabeçalho basta) e devolve as dimensões. */
async function dimensoesUrl(url: string): Promise<{ largura: number; altura: number } | null> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'mandatorio-sync (+https://github.com/darlondjc/mandatorio)', Range: 'bytes=0-65535' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return dimensoesImagem(new Uint8Array(await res.arrayBuffer()));
}

/**
 * Imagens (P18) dos senadores no Wikidata, pelo código do senador no Senado. Descobre a
 * propriedade de identificador pelo endereço de formatação (senado.leg.br) em vez de fixar
 * o número dela.
 */
async function imagensWikidata(): Promise<Map<string, string>> {
  const sparql = async (q: string) =>
    lista<Json>((await getJson<Json>(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`))?.results?.bindings);
  const props = await sparql(
    'SELECT ?p ?f WHERE { ?p wikibase:propertyType wikibase:ExternalId; wdt:P1630 ?f . FILTER(CONTAINS(LCASE(STR(?f)), "senado.leg.br")) }',
  );
  const out = new Map<string, string>();
  for (const p of props) {
    const pid = String(p.p?.value ?? '').split('/').at(-1);
    if (!pid?.startsWith('P')) continue;
    diagFotosSenado.propriedades.push(`${pid} ${p.f?.value}`);
    for (const r of await sparql(`SELECT ?id ?img WHERE { ?item wdt:${pid} ?id; wdt:P18 ?img . }`)) {
      const id = String(r.id?.value ?? '');
      const arquivo = decodeURIComponent(String(r.img?.value ?? '').split('/').at(-1) ?? '');
      if (/^\d+$/.test(id) && arquivo && !out.has(id)) out.set(id, arquivo);
    }
  }
  return out;
}

/** Largura e altura dos arquivos no Commons, em lotes de 50. */
async function tamanhosCommons(arquivos: string[]): Promise<Map<string, { largura: number; altura: number }>> {
  const out = new Map<string, { largura: number; altura: number }>();
  for (let i = 0; i < arquivos.length; i += 50) {
    const titulos = arquivos.slice(i, i + 50).map((a) => `File:${a}`).join('|');
    const q = new URLSearchParams({ action: 'query', titles: titulos, prop: 'imageinfo', iiprop: 'size', format: 'json', formatversion: '2' });
    const j = await getJson<Json>(`https://commons.wikimedia.org/w/api.php?${q}`);
    for (const pg of lista<Json>(j?.query?.pages)) {
      const info = pg.imageinfo?.[0];
      if (info) out.set(String(pg.title).replace(/^File:/, '').replace(/ /g, '_'), { largura: info.width, altura: info.height });
    }
  }
  return out;
}

export interface FotoEscolhida {
  foto: string | null;
  fonte: string | null;
}

/**
 * Para cada senador, a melhor foto: a do Senado se tiver largura suficiente; senão a do
 * Commons, se for maior e mais alta que larga ou quase quadrada (retrato, não foto de evento).
 */
export async function escolherFotos(senadores: { codigo: string; nome: string; foto: string | null }[]): Promise<Map<string, FotoEscolhida>> {
  const out = new Map<string, FotoEscolhida>();
  let wikidata = new Map<string, string>();
  try {
    wikidata = await imagensWikidata();
  } catch (e) {
    diagFotosSenado.erros.push(`Wikidata: ${(e as Error).message}`);
  }
  diagFotosSenado.noWikidata = senadores.filter((s) => wikidata.has(s.codigo)).length;
  let commons = new Map<string, { largura: number; altura: number }>();
  try {
    commons = await tamanhosCommons(senadores.map((s) => wikidata.get(s.codigo)).filter((a): a is string => !!a).map((a) => a.replace(/ /g, '_')));
  } catch (e) {
    diagFotosSenado.erros.push(`Commons: ${(e as Error).message}`);
  }

  for (const s of senadores) {
    let largura = 0;
    if (s.foto) {
      try {
        largura = (await dimensoesUrl(s.foto))?.largura ?? 0;
      } catch (e) {
        if (diagFotosSenado.erros.length < 5) diagFotosSenado.erros.push(`${s.nome}: ${(e as Error).message}`);
      }
    }
    const faixa = largura >= LARGURA_BOA ? `≥${LARGURA_BOA}` : largura ? `${Math.floor(largura / 50) * 50}–${Math.floor(largura / 50) * 50 + 49}` : '?';
    diagFotosSenado.tamanhosSenado.set(faixa, (diagFotosSenado.tamanhosSenado.get(faixa) ?? 0) + 1);

    const arquivo = wikidata.get(s.codigo)?.replace(/ /g, '_');
    const dim = arquivo ? commons.get(arquivo) : undefined;
    const retrato = dim && dim.altura >= dim.largura * 0.9;
    if (largura < LARGURA_BOA && arquivo && dim && retrato && dim.largura > largura) {
      const arq = encodeURIComponent(arquivo);
      out.set(s.codigo, {
        foto: `https://commons.wikimedia.org/wiki/Special:FilePath/${arq}?width=480`,
        fonte: `https://commons.wikimedia.org/wiki/File:${arq}`,
      });
      if (++diagFotosSenado.trocadas <= 8) diagFotosSenado.exemplos.push(`${s.nome}: Senado ${largura || '?'}px → Commons ${dim.largura}×${dim.altura} ${arquivo}`);
    } else {
      out.set(s.codigo, { foto: s.foto, fonte: null });
    }
  }
  return out;
}
