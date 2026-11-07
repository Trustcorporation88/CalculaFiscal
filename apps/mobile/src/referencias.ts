import { D } from '@calculafiscal/motor-fiscal';
import { numero } from './calculo';

/**
 * Valores de referência para quem não sabe as próprias alíquotas. São médias ou tabelas da lei,
 * nunca o número da empresa: a tela sempre manda confirmar com o contador.
 */

/** LC 123/2006, Anexo I (comércio): faixas de receita bruta em 12 meses. */
export const FAIXAS_ANEXO_I = [
  { ate: 180_000, nominal: '0.04', deduzir: '0' },
  { ate: 360_000, nominal: '0.073', deduzir: '5940' },
  { ate: 720_000, nominal: '0.095', deduzir: '13860' },
  { ate: 1_800_000, nominal: '0.107', deduzir: '22500' },
  { ate: 3_600_000, nominal: '0.143', deduzir: '87300' },
  { ate: 4_800_000, nominal: '0.19', deduzir: '378000' },
] as const;

export type DasEstimado =
  | {
      readonly ok: true;
      /** Alíquota efetiva em percentual com vírgula, pronta para o campo ("5,65"). */
      readonly percentual: string;
      readonly faixa: number;
      readonly aviso: string | null;
    }
  | { readonly ok: false; readonly erro: string };

/** Alíquota efetiva do DAS no comércio: (RBT12 × alíquota − parcela a deduzir) ÷ RBT12. */
export function dasEfetivoComercio(faturamento12Meses: string): DasEstimado {
  const n = numero(faturamento12Meses);
  if (n === null || new D(n).lte(0)) {
    return { ok: false, erro: 'Informe o faturamento dos últimos 12 meses.' };
  }
  const rbt12 = new D(n);
  const indice = FAIXAS_ANEXO_I.findIndex((f) => rbt12.lte(f.ate));
  const faixa = FAIXAS_ANEXO_I[indice];
  if (!faixa) {
    return {
      ok: false,
      erro: 'Acima de R$ 4,8 milhões por ano a empresa não pode ficar no Simples.',
    };
  }
  const efetiva = rbt12.times(faixa.nominal).minus(faixa.deduzir).div(rbt12);
  return {
    ok: true,
    percentual: efetiva.times(100).toDecimalPlaces(2, D.ROUND_HALF_UP).toFixed(2).replace('.', ','),
    faixa: indice + 1,
    aviso:
      indice === 5
        ? 'Acima de R$ 3,6 milhões o ICMS sai do DAS e é pago à parte: confirme com o contador.'
        : null,
  };
}

/** Referências do regime regular (comércio), em percentual com vírgula. */
export const REFERENCIAS = {
  icmsSp: '18',
  icmsComSt: '0',
  pisCofinsPresumido: '3,65',
  pisCofinsReal: '9,25',
  /** IRPJ 15% × presunção de 8% + CSLL 9% × presunção de 12%, no comércio, sem o adicional. */
  irpjCsllPresumidoComercio: '2,28',
} as const;
