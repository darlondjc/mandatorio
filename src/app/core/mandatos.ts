// Mandatos presidenciais lado a lado: a quem pertence cada ano dos indicadores e como
// resumir um indicador dentro de um mandato. Usado no gráfico, na comparação de mandatos e
// no bloco "O país no mandato" do perfil do presidente.

import type { DataISO, MandatoPresidente, Presidente, SerieIndicador } from './models';

export interface MandatoLinha {
  /** "lula/2023-2026" */
  chave: string;
  presidenteId: string;
  mandatoId: string;
  nome: string;
  /** "Lula 3", "Temer": o nome curto e, se a pessoa teve mais de um, o número do mandato. */
  curto: string;
  /** Versão mínima para faixas estreitas do gráfico ("D2", "T"). */
  sigla: string;
  partido: string;
  foto: string | null;
  inicio: DataISO;
  fim: DataISO;
  atual: boolean;
  ordem: number;
  resumo: MandatoPresidente['resumo'];
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Todos os mandatos, do mais antigo para o mais recente. */
export function listaMandatos(presidentes: Presidente[]): MandatoLinha[] {
  return presidentes
    .flatMap((p) =>
      p.mandatos.map((m) => {
        const nomeCurto = maiuscula(p.id);
        const varios = p.mandatos.length > 1 || m.ordem > 1;
        return {
          chave: `${p.id}/${m.id}`,
          presidenteId: p.id,
          mandatoId: m.id,
          nome: p.nome,
          curto: varios ? `${nomeCurto} ${m.ordem}` : nomeCurto,
          sigla: `${nomeCurto.charAt(0)}${varios ? m.ordem : ''}`,
          partido: m.partido,
          foto: p.foto,
          inicio: m.inicio,
          fim: m.fim,
          atual: m.atual,
          ordem: m.ordem,
          resumo: m.resumo,
        };
      }),
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

const DIA = 86_400_000;
const tempo = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Fim efetivo: hoje, para o mandato em curso. */
export function fimEfetivo(m: Pick<MandatoLinha, 'fim' | 'atual'>, hoje = new Date()): DataISO {
  const h = hoje.toISOString().slice(0, 10);
  return m.atual && h < m.fim ? h : m.fim;
}

/** Duração em anos (fração), até hoje no mandato em curso. */
export function anosDeMandato(m: Pick<MandatoLinha, 'inicio' | 'fim' | 'atual'>, hoje = new Date()): number {
  return (tempo(fimEfetivo(m, hoje)) - tempo(m.inicio)) / (365.25 * DIA);
}

/**
 * O mandato que governou a maior parte do ano. Em 2016, Temer (Dilma foi afastada em
 * maio); nos anos de posse, quem toma posse em 1º de janeiro.
 */
export function donoDoAno(ano: number, mandatos: MandatoLinha[], hoje = new Date()): MandatoLinha | null {
  const ini = Date.UTC(ano, 0, 1), fim = Date.UTC(ano + 1, 0, 1);
  let melhor: MandatoLinha | null = null, maior = 0;
  for (const m of mandatos) {
    const dias = Math.min(fim, tempo(fimEfetivo(m, hoje))) - Math.max(ini, tempo(m.inicio));
    if (dias > maior) [melhor, maior] = [m, dias];
  }
  return melhor;
}

/** Valores da série (da época ou corrigidos pela inflação, quando houver). */
export function valoresDaSerie(s: SerieIndicador, corrigido: boolean): Record<string, number> {
  return corrigido && s.reais ? s.reais : s.anos;
}

export interface ResumoNoMandato {
  anos: number[];
  media: number | null;
  inicio: { ano: number; valor: number } | null;
  fim: { ano: number; valor: number } | null;
  /** O último ano considerado ainda está incompleto. */
  parcial: boolean;
}

export function resumoNoMandato(s: SerieIndicador, m: MandatoLinha, mandatos: MandatoLinha[], corrigido = false, hoje = new Date()): ResumoNoMandato {
  const valores = valoresDaSerie(s, corrigido);
  const anos = Object.keys(valores)
    .map(Number)
    .filter((a) => donoDoAno(a, mandatos, hoje)?.chave === m.chave)
    .sort((a, b) => a - b);
  if (!anos.length) return { anos, media: null, inicio: null, fim: null, parcial: false };
  const v = anos.map((a) => valores[a]);
  return {
    anos,
    media: v.reduce((x, y) => x + y, 0) / v.length,
    inicio: { ano: anos[0], valor: v[0] },
    fim: { ano: anos.at(-1)!, valor: v.at(-1)! },
    parcial: s.parciais.includes(String(anos.at(-1))),
  };
}

/** "6,2%", "R$ 1.518", "9.001 km²", "1.467". */
export function formatarIndicador(v: number, s: Pick<SerieIndicador, 'unidade' | 'casas'>, casas = s.casas): string {
  const n = v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  if (s.unidade === '%') return `${n}%`;
  if (s.unidade === 'R$') return `R$ ${n}`;
  if (s.unidade === 'km²') return `${n} km²`;
  return n;
}

/** Último ano do mandato: o dia anterior ao fim (2003-01-01 → 2007-01-01 é 2003–2006). */
export function anoFinal(m: Pick<MandatoLinha, 'fim'>): number {
  return new Date(tempo(m.fim) - DIA).getUTCFullYear();
}

/** "7,8 → 5,9%", "R$ 1.443 → 1.518", "9.001 → 6.288 km²": a unidade aparece uma vez só. */
export function formatarFaixa(a: number, b: number, s: Pick<SerieIndicador, 'unidade' | 'casas'>): string {
  const n = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: s.casas, maximumFractionDigits: s.casas });
  if (s.unidade === 'R$') return `R$ ${n(a)} → ${n(b)}`;
  return `${n(a)} → ${formatarIndicador(b, s)}`;
}

/** "2019–2022", "2015" ou "" */
export function periodoDosAnos(anos: number[]): string {
  if (!anos.length) return '';
  return anos.length === 1 ? String(anos[0]) : `${anos[0]}–${anos.at(-1)}`;
}
