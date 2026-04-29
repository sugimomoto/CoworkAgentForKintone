// Cowork Agent for kintone — Agent アバター (本文左の小さな円)

import { PebbleSprout, type PebbleSproutState } from '../PebbleSprout';

export function AgentAvatar({
  size = 22,
  state = 'idle',
}: {
  size?: number;
  state?: PebbleSproutState;
}): JSX.Element {
  return <PebbleSprout size={size} state={state} />;
}
