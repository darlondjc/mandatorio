// Indicadores do país ano a ano, para o gráfico com os mandatos ao fundo.
//
//   - Banco Central (SGS): IPCA, desemprego (PNAD Contínua e, até 2011, PME), PIB, dívida
//     bruta e salário mínimo. https://dadosabertos.bcb.gov.br
//   - ANP: preço médio da gasolina comum, das planilhas mensais do levantamento de preços.
//   - Tabela manual (indicadores-manuais.json): desmatamento (INPE/PRODES) e feminicídio
//     (Fórum Brasileiro de Segurança Pública), que não têm API estável.
//
// Cada série é buscada à parte: se uma falhar, as outras seguem e a que falhou mantém o que
// estava gravado.

import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import type { Indicadores, SerieIndicador } from '../../src/app/core/models.ts';
import { getJson } from './http.ts';

/** Um ano antes do primeiro mandato do gráfico. */
const ANO_INICIAL = 2002;

export interface Mensal {
  ano: number;
  mes: number;
  valor: number;
}

export const diagIndicadores: string[] = [];

// ---------------------------------------------------------------------------------------
// Contas (puras, testadas em regras.test.ts)

/** Inflação do ano a partir das taxas mensais: só anos com os 12 meses. */
export function acumuladoNoAno(mensais: Mensal[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [ano, ms] of porAno(mensais)) {
    if (ms.length < 12) continue;
    out[ano] = arred((ms.reduce((f, m) => f * (1 + m.valor / 100), 1) - 1) * 100, 2);
  }
  return out;
}

/** Média dos meses de cada ano (com pelo menos `minMeses`). */
export function mediaNoAno(mensais: Mensal[], minMeses = 1): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [ano, ms] of porAno(mensais)) if (ms.length >= minMeses) out[ano] = arred(ms.reduce((a, m) => a + m.valor, 0) / ms.length, 3);
  return out;
}

/** Valor do último mês disponível de cada ano (dezembro, nos anos completos). */
export function ultimoDoAno(mensais: Mensal[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [ano, ms] of porAno(mensais)) out[ano] = ms.at(-1)!.valor;
  return out;
}

/** Índice de preços acumulado mês a mês a partir das taxas mensais do IPCA. */
export function indicePrecos(ipca: Mensal[]): Map<string, number> {
  const idx = new Map<string, number>();
  let v = 1;
  for (const m of [...ipca].sort((a, b) => a.ano - b.ano || a.mes - b.mes)) {
    v *= 1 + m.valor / 100;
    idx.set(chave(m), v);
  }
  return idx;
}

/** Valores mensais levados a reais do mês de referência (o último IPCA conhecido). */
export function corrigir(mensais: Mensal[], idx: Map<string, number>): Mensal[] {
  const ref = [...idx.values()].at(-1)!;
  return mensais.filter((m) => idx.has(chave(m))).map((m) => ({ ...m, valor: (m.valor * ref) / idx.get(chave(m))! }));
}

function porAno(mensais: Mensal[]): [number, Mensal[]][] {
  const m = new Map<number, Mensal[]>();
  for (const x of [...mensais].sort((a, b) => a.ano - b.ano || a.mes - b.mes)) m.set(x.ano, [...(m.get(x.ano) ?? []), x]);
  return [...m];
}

const chave = (m: { ano: number; mes: number }) => `${m.ano}-${m.mes}`;
const arred = (v: number, casas: number) => Math.round(v * 10 ** casas) / 10 ** casas;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Anos incompletos: o ano corrente, quando a série já tem dados dele. */
function parciais(mensais: Mensal[]): string[] {
  const ultimo = mensais.reduce((a, m) => (m.ano > a.ano || (m.ano === a.ano && m.mes > a.mes) ? m : a), mensais[0]);
  return ultimo && ultimo.mes < 12 ? [String(ultimo.ano)] : [];
}

// ---------------------------------------------------------------------------------------
// Fontes

/** Série do SGS do Banco Central, mensal ou anual. */
async function sgs(codigo: number): Promise<Mensal[]> {
  const fim = new Date().getFullYear();
  const pontos: Mensal[] = [];
  // O SGS limita o intervalo por consulta; em blocos de 10 anos fica seguro.
  for (let ini = ANO_INICIAL; ini <= fim; ini += 10) {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=01/01/${ini}&dataFinal=31/12/${Math.min(ini + 9, fim)}`;
    const lista = await getJson<{ data: string; valor: string }[]>(url).catch((e) => {
      // Sem dados no bloco o SGS responde 404; os outros blocos seguem.
      if (String(e).includes('404')) return [];
      throw e;
    });
    for (const p of lista) {
      const [, mes, ano] = p.data.split('/').map(Number);
      const valor = Number(String(p.valor).replace(',', '.'));
      if (Number.isFinite(valor)) pontos.push({ ano, mes, valor });
    }
  }
  if (!pontos.length) throw new Error(`SGS ${codigo}: sem dados`);
  return pontos;
}

async function baixar(url: string): Promise<Uint8Array> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'mandatorio-sync (+https://github.com/darlondjc/mandatorio)' }, signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      if (i >= 3) throw e;
      await new Promise((ok) => setTimeout(ok, 3000 * i));
    }
  }
}

// --- Planilhas .xlsx (zip com XML), sem dependência: só o necessário para a da ANP.

/** Arquivos de um .zip (só os métodos "stored" e "deflate", que é o que o Excel usa). */
export function lerZip(b: Uint8Array): Map<string, Uint8Array> {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let fimCd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) if (v.getUint32(i, true) === 0x06054b50) { fimCd = i; break; }
  if (fimCd < 0) throw new Error('não é um .zip');
  const total = v.getUint16(fimCd + 10, true);
  let p = v.getUint32(fimCd + 16, true);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('diretório do .zip inválido');
    const metodo = v.getUint16(p + 10, true);
    const tamanho = v.getUint32(p + 20, true);
    const nomeLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), comLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nome = dec.decode(b.subarray(p + 46, p + 46 + nomeLen));
    const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const dados = b.subarray(ini, ini + tamanho);
    out.set(nome, metodo === 0 ? dados : new Uint8Array(inflateRawSync(dados)));
    p += 46 + nomeLen + extraLen + comLen;
  }
  return out;
}

const desescapar = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');

/** Primeira planilha do .xlsx como linhas de células (texto ou número). */
export function lerXlsx(b: Uint8Array): (string | number | null)[][] {
  const arquivos = lerZip(b);
  const txt = (n: string) => (arquivos.has(n) ? new TextDecoder().decode(arquivos.get(n)) : '');
  const compartilhadas = [...txt('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    desescapar([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
  );
  const folha = [...arquivos.keys()].filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
  if (!folha) throw new Error('planilha sem folhas');
  const linhas: (string | number | null)[][] = [];
  for (const r of txt(folha).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const linha: (string | number | null)[] = [];
    for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+)\d+"/.exec(c[1])?.[1] ?? '';
      const col = [...ref].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const tipo = /t="(\w+)"/.exec(c[1])?.[1];
      const bruto = /<v>([\s\S]*?)<\/v>/.exec(c[2] ?? '')?.[1];
      let valor: string | number | null = null;
      if (tipo === 's' && bruto != null) valor = compartilhadas[Number(bruto)] ?? null;
      else if (tipo === 'inlineStr') valor = desescapar(/<t[^>]*>([\s\S]*?)<\/t>/.exec(c[2] ?? '')?.[1] ?? '');
      else if (tipo === 'str') valor = bruto != null ? desescapar(bruto) : null;
      else if (bruto != null) valor = Number(bruto);
      if (col >= 0) linha[col] = valor;
    }
    linhas.push(Array.from(linha, (x) => x ?? null));
  }
  return linhas;
}

const norm = (s: unknown) =>
  String(s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Mês de uma célula: número de série do Excel, "jan/13", "01/2013" ou data por extenso. */
function mesDaCelula(v: string | number | null): { ano: number; mes: number } | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
  }
  const s = norm(v).toLowerCase();
  let m = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return { ano: Number(m[2]), mes: Number(m[1]) };
  m = /^([a-z]{3})[a-z]*[/\- ](\d{2,4})$/.exec(s);
  if (m && MESES.includes(m[1])) return { ano: (m[2].length === 2 ? 2000 : 0) + Number(m[2]), mes: MESES.indexOf(m[1]) + 1 };
  m = /^(\d{4})-(\d{2})/.exec(s);
  if (m) return { ano: Number(m[1]), mes: Number(m[2]) };
  return null;
}

/** Preço médio mensal da gasolina comum numa planilha mensal da ANP (Brasil). */
export function gasolinaDaPlanilha(linhas: (string | number | null)[][]): Mensal[] {
  const h = linhas.findIndex((l) => l.some((c) => norm(c) === 'PRODUTO') && l.some((c) => norm(c).includes('PRECO MEDIO REVENDA')));
  if (h < 0) throw new Error('cabeçalho da planilha da ANP não encontrado');
  const cab = linhas[h].map(norm);
  const cMes = cab.findIndex((c) => c === 'MES' || c.startsWith('MES') || c === 'DATA');
  const cProd = cab.indexOf('PRODUTO');
  const cPreco = cab.findIndex((c) => c.includes('PRECO MEDIO REVENDA'));
  const out: Mensal[] = [];
  for (const l of linhas.slice(h + 1)) {
    if (!norm(l[cProd]).startsWith('GASOLINA COMUM')) continue;
    const mes = mesDaCelula(l[cMes]);
    const valor = typeof l[cPreco] === 'number' ? (l[cPreco] as number) : Number(String(l[cPreco] ?? '').replace(',', '.'));
    if (mes && Number.isFinite(valor) && valor > 0) out.push({ ...mes, valor });
  }
  return out;
}

const ANP = 'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/shlp/mensal';

/**
 * Planilhas mensais "Brasil" da ANP. Os nomes mudam de tempos em tempos, então procura os
 * links na própria página da série histórica; sem achar, usa os nomes conhecidos.
 */
async function planilhasDaAnp(): Promise<string[]> {
  const paginas = [
    'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos',
    'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/serie-historica-de-precos-de-combustiveis',
    ANP,
  ];
  const achados = new Set<string>();
  for (const url of paginas) {
    try {
      const html = new TextDecoder().decode(await baixar(url));
      for (const m of html.matchAll(/href="([^"]*mensal[^"]*brasil[^"]*\.xlsx)"/gi)) achados.add(new URL(m[1], url).href);
    } catch (e) {
      diagIndicadores.push(`gasolina (página ${url.split('/').at(-1)}): ${String((e as Error).message).slice(0, 80)}`);
    }
  }
  diagIndicadores.push(`gasolina: planilhas achadas nas páginas da ANP: ${[...achados].map((a) => a.split('/').at(-1)).join(', ') || 'nenhuma'}`);
  return achados.size ? [...achados] : ['mensal-brasil-2001-a-2012.xlsx', 'mensal-brasil-desde-jan2013.xlsx'];
}

// ---------------------------------------------------------------------------------------
// Montagem das séries

type Base = Omit<SerieIndicador, 'anos' | 'reais' | 'referenciaReal' | 'parciais' | 'metodologiaAntigaAte' | 'manual'>;

/** Só os anos do gráfico (o ano inicial serve de base para as contas). */
const doGrafico = (v: Record<string, number>) => Object.fromEntries(Object.entries(v).filter(([a]) => Number(a) >= ANO_INICIAL + 1));

const serie = (b: Base, anos: Record<string, number>, extra: Partial<SerieIndicador> = {}): SerieIndicador => ({
  ...b,
  reais: null,
  referenciaReal: null,
  parciais: [],
  metodologiaAntigaAte: null,
  manual: false,
  ...extra,
  anos: doGrafico(anos),
  ...(extra.reais ? { reais: doGrafico(extra.reais) } : {}),
});

interface Manual {
  rotulo: string;
  titulo: string;
  unidade: SerieIndicador['unidade'];
  casas: number;
  tipo: SerieIndicador['tipo'];
  fonte: string;
  url: string;
  nota: string | null;
  anos: Record<string, number>;
}

export async function coletarIndicadores(anterior: Indicadores | null): Promise<Indicadores> {
  const series: SerieIndicador[] = [];
  let ipca: Mensal[] = [];

  const tentar = async (id: string, f: () => Promise<SerieIndicador>) => {
    try {
      const s = await f();
      const anos = Object.keys(s.anos).sort();
      diagIndicadores.push(`${id}: ${anos.length} anos (${anos[0]}–${anos.at(-1)}) · últimos: ${anos.slice(-3).map((a) => `${a}=${s.anos[a]}`).join(', ')}${s.parciais.length ? ` · parcial: ${s.parciais}` : ''}${s.reais ? ` · corrigido (${s.referenciaReal}): ${anos.slice(-1).map((a) => s.reais![a]?.toFixed(2))}` : ''}`);
      series.push(s);
    } catch (e) {
      const antiga = anterior?.series.find((x) => x.id === id);
      diagIndicadores.push(`${id}: FALHOU (${String((e as Error).message ?? e).slice(0, 200)})${antiga ? ' · mantida a versão anterior' : ''}`);
      if (antiga) series.push(antiga);
    }
  };

  await tentar('inflacao', async () => {
    ipca = await sgs(433);
    return serie(
      { id: 'inflacao', rotulo: 'Inflação', titulo: 'Inflação (IPCA) no ano', unidade: '%', casas: 1, tipo: 'taxa', fonte: 'IBGE (IPCA), via Banco Central', url: 'https://www.ibge.gov.br/explica/inflacao.php', nota: null },
      acumuladoNoAno(ipca),
    );
  });
  const idx = ipca.length ? indicePrecos(ipca) : null;
  const ultimoIpca = ipca.at(-1);
  const referencia = ultimoIpca ? `${MESES[ultimoIpca.mes - 1]}/${ultimoIpca.ano}` : null;

  await tentar('desemprego', async () => {
    const pnad = await sgs(24369);
    let pme: Mensal[] = [];
    try {
      pme = (await sgs(10777)).filter((m) => m.ano < 2012);
    } catch (e) {
      diagIndicadores.push(`desemprego (PME até 2011): ${String((e as Error).message).slice(0, 150)}`);
    }
    return serie(
      {
        id: 'desemprego', rotulo: 'Desemprego', titulo: 'Taxa de desemprego, média do ano', unidade: '%', casas: 1, tipo: 'nivel',
        fonte: 'IBGE (PNAD Contínua; até 2011, PME), via Banco Central', url: 'https://www.ibge.gov.br/explica/desemprego.php',
        nota: pme.length ? 'Até 2011 o IBGE media o desemprego só em 6 regiões metropolitanas (PME). Desde 2012 a PNAD Contínua cobre o país todo; as duas séries não são diretamente comparáveis.' : 'A PNAD Contínua, que cobre o país todo, começa em 2012.',
      },
      { ...mediaNoAno(pme, 10), ...mediaNoAno(pnad, 10) },
      { parciais: parciais(pnad), metodologiaAntigaAte: pme.length ? 2011 : null },
    );
  });

  await tentar('pib', async () => {
    const pib = await sgs(7326);
    return serie(
      { id: 'pib', rotulo: 'PIB', titulo: 'Crescimento do PIB no ano', unidade: '%', casas: 1, tipo: 'taxa', fonte: 'IBGE (Contas Nacionais), via Banco Central', url: 'https://www.ibge.gov.br/explica/pib.php', nota: null },
      Object.fromEntries(pib.map((p) => [String(p.ano), arred(p.valor, 2)])),
    );
  });

  await tentar('divida', async () => {
    const d = await sgs(13762);
    return serie(
      {
        id: 'divida', rotulo: 'Dívida pública', titulo: 'Dívida bruta do governo, em % do PIB', unidade: '%', casas: 1, tipo: 'nivel',
        fonte: 'Banco Central', url: 'https://www.bcb.gov.br/estatisticas/estatisticasfiscais',
        nota: 'Valor de dezembro de cada ano. A série, na metodologia atual, começa em dezembro de 2006.',
      },
      ultimoDoAno(d),
      { parciais: parciais(d) },
    );
  });

  await tentar('salarioMinimo', async () => {
    const sm = (await sgs(1619)).filter((m) => m.ano >= ANO_INICIAL);
    const ano = ultimoDoAno(sm);
    return serie(
      {
        id: 'salarioMinimo', rotulo: 'Salário mínimo', titulo: 'Salário mínimo', unidade: 'R$', casas: 0, tipo: 'nivel',
        fonte: 'Banco Central; correção pelo IPCA (IBGE)', url: 'https://www.bcb.gov.br/estabilidadefinanceira/historicosalariominimo',
        nota: 'Valor em vigor em dezembro de cada ano. Corrigido pela inflação, mostra o poder de compra.',
      },
      ano,
      { reais: idx ? ultimoDoAno(corrigir(sm, idx)) : null, referenciaReal: idx ? referencia : null, parciais: parciais(sm) },
    );
  });

  await tentar('gasolina', async () => {
    const meses: Mensal[] = [];
    for (const arquivo of await planilhasDaAnp()) {
      try {
        const linhas = lerXlsx(await baixar(arquivo.startsWith('http') ? arquivo : `${ANP}/${arquivo}`));
        const g = gasolinaDaPlanilha(linhas);
        diagIndicadores.push(`gasolina (${arquivo.split('/').at(-1)}): ${g.length} meses, ${g[0]?.mes}/${g[0]?.ano}–${g.at(-1)?.mes}/${g.at(-1)?.ano}`);
        meses.push(...g);
      } catch (e) {
        diagIndicadores.push(`gasolina (${arquivo.split('/').at(-1)}): ${String((e as Error).message).slice(0, 120)}`);
      }
    }
    const unicos = [...new Map(meses.map((m) => [chave(m), m])).values()];
    if (!unicos.length) throw new Error('nenhuma planilha da ANP lida');
    return serie(
      {
        id: 'gasolina', rotulo: 'Gasolina', titulo: 'Preço médio da gasolina comum, por litro', unidade: 'R$', casas: 2, tipo: 'nivel',
        fonte: 'ANP (levantamento de preços); correção pelo IPCA (IBGE)', url: 'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos',
        nota: `Média dos preços de revenda no ano, no país.${Math.min(...unicos.map((m) => m.ano)) > 2004 ? ` A série da ANP disponível aqui começa em ${Math.min(...unicos.map((m) => m.ano))}.` : ''}`,
      },
      mediaNoAno(unicos, 6),
      { reais: idx ? mediaNoAno(corrigir(unicos, idx), 6) : null, referenciaReal: idx ? referencia : null, parciais: parciais(unicos) },
    );
  });

  const manuais = JSON.parse(readFileSync(new URL('./indicadores-manuais.json', import.meta.url), 'utf8')) as Record<string, Manual | string>;
  for (const [id, m] of Object.entries(manuais)) {
    if (typeof m === 'string') continue;
    await tentar(id, async () => serie({ id, ...m, nota: m.nota }, m.anos, { manual: true }));
  }

  // Ordem dos chips: a das séries acima; as que vieram da versão anterior entram no mesmo lugar.
  const ordem = ['inflacao', 'desemprego', 'pib', 'salarioMinimo', 'gasolina', 'divida', 'desmatamento', 'feminicidio'];
  series.sort((a, b) => (ordem.indexOf(a.id) + 1 || 99) - (ordem.indexOf(b.id) + 1 || 99));
  return { atualizadoEm: new Date().toISOString(), series };
}
