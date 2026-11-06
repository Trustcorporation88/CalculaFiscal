/** Um passo da memória de cálculo. É o mesmo na tela, no PDF, na planilha e na API. */
export interface PassoMemoria {
  readonly id: string;
  readonly descricao: string;
  readonly formula: string;
  readonly entradas: Readonly<Record<string, string>>;
  readonly resultado: string;
  /** Regras aplicadas (id@versão), para rastrear fonte, vigência e status. */
  readonly regras: readonly string[];
}
