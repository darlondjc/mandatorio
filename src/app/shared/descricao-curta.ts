import { Pipe, PipeTransform } from '@angular/core';
import { descricaoCurta } from '../core/descricao';

/** {{ v.descricao | descricaoCurta }}: só o que distingue a votação (turno, destaque, requerimento…). */
@Pipe({ name: 'descricaoCurta' })
export class DescricaoCurtaPipe implements PipeTransform {
  transform(descricao: string | null | undefined): string | null {
    return descricaoCurta(descricao);
  }
}
