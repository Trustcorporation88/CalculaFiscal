import type { Status } from '@calculafiscal/motor-fiscal';
import { AJUDA_STATUS, ICONE_STATUS, ROTULO_STATUS } from './formato';

export function SeloStatus({ status }: { status: Status }) {
  return (
    <span className={`selo selo-${status.toLowerCase()}`} title={AJUDA_STATUS[status]}>
      <span aria-hidden="true">{ICONE_STATUS[status]}</span> {ROTULO_STATUS[status]}
    </span>
  );
}
