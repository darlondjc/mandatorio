import type { Voto } from '../../src/app/core/models.ts';

/** "2026-09-16T00:00:00" | "16/09/2026" -> "2026-09-16" */
export function isoData(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(v);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  return iso ? iso[1] : null;
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 4512 -> "4.512" (como o Congresso escreve números de matérias). */
export function numeroMateria(n: number | string): string {
  const v = Number(String(n).replace(/\D/g, ''));
  return Number.isFinite(v) ? v.toLocaleString('pt-BR') : String(n);
}

export function identificacao(sigla: string, numero: number | string, ano: number | string): string {
  return `${sigla} ${numeroMateria(numero)}/${ano}`;
}

/**
 * Converte a sigla de voto do Senado nos quatro estados do Mandatório.
 * Sim/Não são votos; Abstenção, Obstrução e P-NRV (presente, não registrou voto) contam como abstenção;
 * o resto (MIS, LP, LS, AP, NCom, Ausente…) é ausência.
 */
export function normalizarVoto(sigla: string | null | undefined): Voto {
  const s = (sigla ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (s === 'sim') return 'sim';
  if (s === 'nao') return 'nao';
  if (s.startsWith('abst') || s.startsWith('obstr') || s === 'p-nrv' || s === 'presidente (art. 51 ri)' || s.startsWith('presidente'))
    return 'abstencao';
  return 'ausente';
}

/** Soma dias corridos ignorando os recessos parlamentares (18–31/jul e 23/dez–1º/fev). */
export function somarDiasSemRecesso(inicioISO: string, dias: number): string {
  const d = new Date(inicioISO + 'T12:00:00Z');
  let contados = 0;
  while (contados < dias) {
    d.setUTCDate(d.getUTCDate() + 1);
    const m = d.getUTCMonth() + 1;
    const dia = d.getUTCDate();
    const recesso = (m === 7 && dia >= 18) || (m === 12 && dia >= 23) || m === 1 || (m === 2 && dia === 1);
    if (!recesso) contados++;
  }
  return d.toISOString().slice(0, 10);
}

export function semAcento(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
