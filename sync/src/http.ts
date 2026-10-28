// Requisições às APIs públicas, com novas tentativas e um pequeno intervalo entre chamadas
// para não sobrecarregar os servidores do Senado e da Câmara.
// Também anota o formato da primeira resposta de cada endpoint e as falhas, para o
// diagnóstico que a sincronização publica como anotações no GitHub Actions.

const USER_AGENT = 'mandatorio-sync (+https://github.com/darlondjc/mandatorio)';
const INTERVALO_MS = 150;
let ultima = 0;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Endpoint sem números nem query: "/dadosabertos/senador/5012/comissoes.json" -> "senador/{n}/comissoes.json" */
export function rotuloEndpoint(url: string): string {
  const u = new URL(url);
  return `${u.host.split('.')[0]}${u.pathname.replace(/\/dadosabertos|\/api\/v\d+|\/adm-dadosabertos/g, '').replace(/\d+/g, '{n}')}`;
}

/** Estrutura resumida de um JSON: chaves e tipos, sem os valores. */
export function formato(v: unknown, profundidade = 4): string {
  if (Array.isArray(v)) return v.length ? `[${formato(v[0], profundidade)}]×${v.length}` : '[]';
  if (v && typeof v === 'object') {
    if (profundidade <= 0) return '{…}';
    const chaves = Object.keys(v);
    const partes = chaves.slice(0, 14).map((k) => `${k}:${formato((v as Record<string, unknown>)[k], profundidade - 1)}`);
    return `{${partes.join(',')}${chaves.length > 14 ? ',…' : ''}}`;
  }
  return v === null ? 'null' : typeof v === 'string' ? 's' : typeof v === 'number' ? 'n' : typeof v;
}

export const diagnostico = {
  formatos: new Map<string, string>(),
  falhas: new Map<string, { vezes: number; ultima: string }>(),
  chamadas: 0,
};

function registrarFalha(url: string, msg: string) {
  const r = rotuloEndpoint(url);
  const f = diagnostico.falhas.get(r) ?? { vezes: 0, ultima: '' };
  f.vezes++;
  f.ultima = msg;
  diagnostico.falhas.set(r, f);
}

/** Falhas que costumam passar sozinhas: 5xx, 429 e tempo esgotado. Essas ganham mais tentativas. */
const TRANSITORIA = /^HTTP (5\d\d|429)|timeout|aborted|ECONNRESET|ETIMEDOUT|fetch failed/i;

export async function getJson<T = unknown>(url: string, tentativas = 4): Promise<T> {
  for (let i = 1; ; i++) {
    const agora = Date.now();
    if (agora - ultima < INTERVALO_MS) await espera(INTERVALO_MS - (agora - ultima));
    ultima = Date.now();
    diagnostico.chamadas++;
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status === 404) throw new NaoEncontrado(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200).replace(/\s+/g, ' ')}`);
      const texto = await res.text();
      let json: T;
      try {
        json = JSON.parse(texto) as T;
      } catch {
        throw new Error(`resposta não é JSON (${res.headers.get('content-type')}): ${texto.slice(0, 120).replace(/\s+/g, ' ')}`);
      }
      const r = rotuloEndpoint(url);
      if (!diagnostico.formatos.has(r)) diagnostico.formatos.set(r, formato(json).slice(0, 700));
      return json;
    } catch (e) {
      const transitoria = TRANSITORIA.test(`${(e as Error).message} ${(e as { name?: string }).name}`);
      if (e instanceof NaoEncontrado || i >= (transitoria ? tentativas + 3 : tentativas)) {
        const causa = (e as { cause?: { code?: string; message?: string } }).cause;
        registrarFalha(url, (e as Error).message + (causa ? ` (${causa.code ?? causa.message})` : ''));
        throw e;
      }
      await espera(Math.min(30_000, (transitoria ? 3000 : 1000) * 2 ** (i - 1)));
    }
  }
}

export class NaoEncontrado extends Error {
  constructor(url: string) {
    super(`404 em ${url}`);
  }
}

/** A API do Senado devolve objeto quando há um item e lista quando há vários. */
export function lista<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Executa tarefas com concorrência limitada. */
export async function emParalelo<T, R>(itens: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(itens.length);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, async () => {
      while (proximo < itens.length) {
        const i = proximo++;
        out[i] = await fn(itens[i]);
      }
    }),
  );
  return out;
}
