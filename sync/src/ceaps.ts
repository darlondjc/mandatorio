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

/** Só valores acima disto entram como "muito acima do comum" (evita alarde com centavos). */
export const VALOR_MINIMO = 1000;
/** E pelo menos este múltiplo do valor típico (mediana) da categoria. */
export const VEZES_MINIMO = 3;
/** Categorias com poucas despesas no ano não têm um "comum" confiável. */
const MIN_DESPESAS_CATEGORIA = 50;
const MAX_POR_ANO = 20;

const quantil = (ordenados: number[], q: number) => {
  const i = (ordenados.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (i - lo);
};

/** Por categoria, no ano e entre todos os senadores: o valor típico (mediana) e o de 99%. */
export function limitesPorCategoria(itens: ItemCeaps[]): Map<string, { mediana: number; p99: number; n: number }> {
  const porCat = new Map<string, number[]>();
  for (const it of itens) porCat.set(it.categoria, [...(porCat.get(it.categoria) ?? []), it.valor]);
  const out = new Map<string, { mediana: number; p99: number; n: number }>();
  for (const [cat, vs] of porCat) {
    if (vs.length < MIN_DESPESAS_CATEGORIA) continue;
    const o = [...vs].sort((a, b) => a - b);
    out.set(cat, { mediana: quantil(o, 0.5), p99: quantil(o, 0.99), n: o.length });
  }
  return out;
}

/** Documentos que não identificam nada ("0", "s/n"…) não servem para achar repetição. */
const documentoUtil = (d: string) => d.replace(/[^0-9a-z]/gi, '').length >= 3 && !/^(s\/?n|sem ?n|0+)$/i.test(d.trim());

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

  for (const it of itens) {
    const l = limites.get(it.categoria);
    if (!l || it.valor < VALOR_MINIMO || it.valor <= l.p99) continue;
    const vezes = it.valor / l.mediana;
    if (vezes < VEZES_MINIMO) continue;
    out.push({ ...base(it), motivo: 'valor', vezes: Math.round(vezes * 10) / 10, referencia: Math.round(l.mediana * 100) / 100 });
  }

  const repetidas = new Map<string, ItemCeaps[]>();
  for (const it of itens) {
    if (!documentoUtil(it.documento)) continue;
    const chave = `${it.cnpj || it.fornecedor.toUpperCase()}|${it.documento.toUpperCase()}|${it.valor.toFixed(2)}`;
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
