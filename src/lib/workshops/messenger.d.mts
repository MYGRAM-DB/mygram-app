export interface TimestampedMessage {
  id: string;
  created_at: string;
}

export function mergeMessagesByCreatedAtId<T extends TimestampedMessage>(
  current: readonly T[],
  incoming: readonly T[],
): T[];
