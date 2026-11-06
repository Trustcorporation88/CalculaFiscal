import { z } from 'zod';

const decimalStr = z.string().regex(/^-?\d+(\.\d+)?$/, 'decimal como string, ponto como separador');
const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data AAAA-MM-DD');

export const Status = z.enum([
  'EM_VIGOR',
  'PUBLICADO_EFEITO_FUTURO',
  'PROPOSTO',
  'PENDENTE',
  'ESTIMATIVA',
]);

export const Conferencia = z.enum(['OK', 'CONFERIR']);

export const Tributo = z.enum([
  'CBS',
  'IBS',
  'IBS_UF',
  'IBS_MUN',
  'IS',
  'ICMS',
  'ICMS_ST',
  'ISS',
  'PIS',
  'COFINS',
  'IPI',
  /** Parâmetros da transição (fatores e chaves liga/desliga), não alíquotas. */
  'TRANSICAO',
]);

export const Regra = z
  .object({
    id: z.string().regex(/^[a-z0-9.\-_]+$/),
    versao: z.number().int().positive(),
    tributo: Tributo,
    descricao: z.string().min(3),
    vigencia: z.object({ inicio: dataISO, fim: dataISO.nullable() }),
    abrangencia: z.object({
      ncm: z.array(z.string().regex(/^\d{2}(\.?\d{2}){0,3}$/)).default([]),
      nbs: z.array(z.string()).default([]),
      uf: z.array(z.string().length(2)).default([]),
      regime: z.array(z.enum(['SIMPLES_DAS', 'SIMPLES_REGULAR', 'PRESUMIDO', 'REAL'])).default([]),
      elo: z.array(z.enum(['PRODUCAO', 'IMPORTACAO', 'ATACADO', 'VAREJO', 'SERVICO'])).default([]),
    }),
    valor: z.object({
      aliquotaInicial: decimalStr.optional(),
      fatorConversao: decimalStr.optional(),
      aliquota: decimalStr,
      especifica: z.object({ valor: decimalStr, unidade: z.string() }).optional(),
    }),
    fonte: z.object({ norma: z.string(), artigo: z.string(), url: z.string().url().optional() }),
    /** Cenários em que a regra vale. Vazio = cenário base. */
    cenarios: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
    status: Status,
    conferencia: Conferencia,
    observacao: z.string().optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.vigencia.fim !== null && r.vigencia.fim < r.vigencia.inicio) {
      ctx.addIssue({ code: 'custom', message: 'fim da vigência antes do início' });
    }
  });

export type Regra = z.infer<typeof Regra>;
export const ArquivoRegras = z.object({ regras: z.array(Regra) });
