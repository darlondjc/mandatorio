// Despesas da cota parlamentar (CEAPS), uma a uma: para quem foi o dinheiro e quais
// despesas fogem muito do comum. "Fora do padrão" não quer dizer irregular: é só o que
// merece uma segunda olhada, com o critério dito na tela.

import type { DespesaForaPadrao, FornecedorCeaps } from '../../src/app/core/models.ts';
import { isoData } from './util.ts';

type Json = Record<string, any>;

export interface ItemCeaps {
  cod: string;
  categoria: string;
  fornecedor: string;
  cnpj: string;
  documento: string;
  data: string | null;
  mes: number;
  valor: number;
}

export function itemCeaps(d: Json): ItemCeaps | null {
  const cod = String(d.codSenador ?? d.CodSenador ?? '');
  const valor = Number(String(d.valorReembolsado ?? d.ValorReembolsado ?? 0).replace(',', '.')) || 0;
  if (!cod || valor <= 0) return null;
  return {
    cod,
    categoria: String(d.tipoDespesa ?? d.TipoDespesa ?? 'Outros'),
    fornecedor: String(d.fornecedor ?? d.Fornecedor ?? '').trim(),
    cnpj: String(d.cpfCnpj ?? d.CpfCnpj ?? '').replace(/\D/g, ''),
    documento: String(d.documento ?? d.Documento ?? '').trim(),
    data: isoData(d.data ?? d.Data),
    mes: Number(d.mes ?? d.Mes) || 0,
    valor,
  };
}

/** Só valores acima disto entram como "muito acima do comum" (evita alarde com valores pequenos). */
export const VALOR_MINIMO = 2000;
/** E pelo menos este múltiplo do valor típico (mediana) da categoria. */
export const VEZES_MINIMO = 5;
/** Acima de quanto das despesas do mesmo tipo (entre todos os senadores no ano). */
export const QUANTIL = 0.995;
/** Mesmo fornecedor e mesmo valor em tantos meses ou mais é contrato (aluguel, locação), não exceção. */
const MESES_RECORRENTE = 3;
/** Na mesma passagem, ida e volta podem ter o mesmo localizador e o mesmo valor. */
const SEM_REPETICAO = /passage/i;
/** Categorias com poucas despesas no ano não têm um "comum" confiável. */
const MIN_DESPESAS_CATEGORIA = 50;
const MAX_POR_ANO = 20;

const quantil = (ordenados: number[], q: number) => {
  const i = (ordenados.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (i - lo);
};

/** Por categoria, no ano e entre todos os senadores: o valor típico (mediana) e o limite de 99,5%. */
export function limitesPorCategoria(itens: ItemCeaps[]): Map<string, { mediana: number; limite: number; n: number }> {
  const porCat = new Map<string, number[]>();
  for (const it of itens) porCat.set(it.categoria, [...(porCat.get(it.categoria) ?? []), it.valor]);
  const out = new Map<string, { mediana: number; limite: number; n: number }>();
  for (const [cat, vs] of porCat) {
    if (vs.length < MIN_DESPESAS_CATEGORIA) continue;
    const o = [...vs].sort((a, b) => a - b);
    out.set(cat, { mediana: quantil(o, 0.5), limite: quantil(o, QUANTIL), n: o.length });
  }
  return out;
}

/** Documentos que não identificam nada ("0", "s/n"…) não servem para achar repetição. */
const documentoUtil = (d: string) => d.replace(/[^0-9a-z]/gi, '').length >= 3 && !/^(s\/?n|0+)$/i.test(d.trim()) && !/sem\s*n/i.test(d);

/** Fornecedores do senador no ano, do que mais recebeu ao que menos. */
export function fornecedores(itens: ItemCeaps[], max = 10): FornecedorCeaps[] {
  const porChave = new Map<string, { nomes: Map<string, number>; cnpj: string; valor: number; despesas: number }>();
  for (const it of itens) {
    const chave = it.cnpj || it.fornecedor.toUpperCase();
    const f = porChave.get(chave) ?? { nomes: new Map(), cnpj: it.cnpj, valor: 0, despesas: 0 };
    f.nomes.set(it.fornecedor, (f.nomes.get(it.fornecedor) ?? 0) + 1);
    f.valor += it.valor;
    f.despesas++;
    porChave.set(chave, f);
  }
  return [...porChave.values()]
    .map((f) => ({ nome: [...f.nomes].sort((a, b) => b[1] - a[1])[0][0] || 'Fornecedor não informado', cnpj: f.cnpj, valor: Math.round(f.valor), despesas: f.despesas }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, max);
}

/** As despesas do senador no ano que fogem do padrão, da mais destoante para a menos. */
export function foraDoPadrao(itens: ItemCeaps[], limites: ReturnType<typeof limitesPorCategoria>): DespesaForaPadrao[] {
  const out: DespesaForaPadrao[] = [];
  const base = (it: ItemCeaps) => ({ data: it.data, mes: it.mes, categoria: it.categoria, fornecedor: it.fornecedor, cnpj: it.cnpj, documento: it.documento, valor: Math.round(it.valor * 100) / 100 });

  // Pagamentos que se repetem mês a mês (mesmo fornecedor, mesmo valor) são contrato.
  const mesesDe = new Map<string, Set<number>>();
  const chaveContrato = (it: ItemCeaps) => `${it.cnpj || it.fornecedor.toUpperCase()}|${Math.round(it.valor)}`;
  for (const it of itens) mesesDe.set(chaveContrato(it), (mesesDe.get(chaveContrato(it)) ?? new Set()).add(it.mes));

  for (const it of itens) {
    const l = limites.get(it.categoria);
    if (!l || it.valor < VALOR_MINIMO || it.valor <= l.limite) continue;
    if ((mesesDe.get(chaveContrato(it))?.size ?? 0) >= MESES_RECORRENTE) continue;
    const vezes = it.valor / l.mediana;
    if (vezes < VEZES_MINIMO) continue;
    out.push({ ...base(it), motivo: 'valor', vezes: Math.round(vezes * 10) / 10, referencia: Math.round(l.mediana * 100) / 100 });
  }

  const repetidas = new Map<string, ItemCeaps[]>();
  // O mesmo recibo lançado de novo: mesmo fornecedor, documento, valor e data. Parcelas e
  // mensalidades usam o mesmo número em datas diferentes, e não contam.
  for (const it of itens) {
    if (!documentoUtil(it.documento) || SEM_REPETICAO.test(it.categoria)) continue;
    const chave = `${it.cnpj || it.fornecedor.toUpperCase()}|${it.documento.toUpperCase()}|${it.valor.toFixed(2)}|${it.data ?? it.mes}`;
    repetidas.set(chave, [...(repetidas.get(chave) ?? []), it]);
  }
  for (const grupo of repetidas.values()) {
    if (grupo.length < 2) continue;
    out.push({ ...base(grupo[0]), motivo: 'repetida', vezes: grupo.length, referencia: Math.round(grupo[0].valor * grupo.length * 100) / 100 });
  }

  // Repetidas primeiro (mais objetivas); depois as de valor, das que mais destoam.
  return out
    .sort((a, b) => (a.motivo === b.motivo ? b.vezes - a.vezes || b.valor - a.valor : a.motivo === 'repetida' ? -1 : 1))
    .slice(0, MAX_POR_ANO);
}
