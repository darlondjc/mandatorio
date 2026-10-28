import { Voto } from './models';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** "R$ 268 mil", "R$ 1,2 mi" — para cards. */
export function dinheiroCurto(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000).toLocaleString('pt-BR')} mil`;
  return brl.format(v);
}

export function dinheiro(v: number): string {
  return brl.format(v);
}

export function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/** "2026-09-16" -> "16/09/2026" */
export function data(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function ano(iso: string): string {
  return iso.slice(0, 4);
}

export function diasAte(iso: string, hoje = new Date()): number {
  const alvo = new Date(iso + 'T23:59:59');
  return Math.ceil((alvo.getTime() - hoje.getTime()) / 864e5);
}

export const ROTULO_VOTO: Record<Voto, string> = {
  sim: 'Sim',
  nao: 'Não',
  abstencao: 'Abstenção',
  ausente: 'Ausente',
};

const UF_NOME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};
export function ufNome(uf: string): string {
  return UF_NOME[uf] ?? uf;
}

/** Variável CSS da cor do partido (tokens party-*). */
export function corPartido(sigla: string): string {
  const chave = sigla
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const conhecidos = ['pt', 'psb', 'pdt', 'mdb', 'psd', 'podemos', 'psdb', 'uniao', 'republicanos', 'pp', 'pl', 'novo'];
  return `var(--party-${conhecidos.includes(chave) ? chave : 'outros'})`;
}

/** Partidos de cor clara recebem texto escuro no avatar. */
export function textoSobrePartido(sigla: string): string {
  return ['UNIÃO', 'PP', 'PODEMOS', 'PSB', 'NOVO'].includes(sigla) ? 'var(--on-coral)' : '#ffffff';
}

export function iniciais(nome: string): string {
  const partes = nome.split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÁ-Ú]/.test(p));
  return ((partes[0]?.[0] ?? '') + (partes.at(-1)?.[0] ?? '')).toUpperCase();
}
