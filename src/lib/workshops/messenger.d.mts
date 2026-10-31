export interface TimestampedMessage {
  id: string;
  created_at: string;
}

export function mergeMessagesByCreatedAtId<T extends TimestampedMessage>(
  current: readonly T[],
  incoming: readonly T[],
): T[];


export function compensateAttachmentInsertFailure(input: {
  removeStorageObject: () => Promise<{ error?: unknown | null }>;
  deleteEmptyMessage: () => Promise<{ error?: unknown | null }>;
  hasTextBody: boolean;
}): Promise<{ storageRemoved: boolean; messageResolved: boolean }>;
