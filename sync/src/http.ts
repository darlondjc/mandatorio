// Requisições às APIs públicas, com novas tentativas e um pequeno intervalo entre chamadas
// para não sobrecarregar os servidores do Senado e da Câmara.

const USER_AGENT = 'mandatorio-sync (+https://github.com/darlondjc/mandatorio)';
const INTERVALO_MS = 150;
let ultima = 0;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getJson<T = unknown>(url: string, tentativas = 4): Promise<T> {
  for (let i = 1; ; i++) {
    const agora = Date.now();
    if (agora - ultima < INTERVALO_MS) await espera(INTERVALO_MS - (agora - ultima));
    ultima = Date.now();
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
      if (res.status === 404) throw new NaoEncontrado(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof NaoEncontrado || i >= tentativas) throw e;
      await espera(1000 * 2 ** (i - 1));
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
