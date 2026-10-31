const transitions = {
  queued: ["uploading", "failed"],
  uploading: ["uploaded", "failed"],
  uploaded: [],
  failed: ["queued"],
};

export function attachmentTransition(state, next) {
  if (!transitions[state]?.includes(next)) {
    throw new Error("INVALID_ATTACHMENT_TRANSITION");
  }
  return next;
}

export function mergeMessagesByCreatedAtId(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]));

  for (const message of incoming) {
    if (
      typeof message.id !== "string" ||
      !message.id ||
      typeof message.created_at !== "string" ||
      !Number.isFinite(Date.parse(message.created_at))
    ) {
      throw new Error("INVALID_MESSAGE_CURSOR");
    }
    byId.set(message.id, message);
  }

  return [...byId.values()].sort((left, right) => {
    const time = Date.parse(left.created_at) - Date.parse(right.created_at);
    return time || left.id.localeCompare(right.id);
  });
}


/**
 * Compensate when an uploaded object cannot be linked to its message row.
 * Operations return Supabase-style { error } results; thrown errors also fail closed.
 */
export async function compensateAttachmentInsertFailure({
  removeStorageObject,
  deleteEmptyMessage,
  hasTextBody,
}) {
  async function attempt(operation) {
    try {
      const result = await operation();
      return !result?.error;
    } catch {
      return false;
    }
  }

  const storageRemoved = await attempt(removeStorageObject);
  // A text-bearing message remains a valid text message. File-only messages
  // must be removed when their attachment metadata cannot be persisted.
  const messageResolved = hasTextBody ? true : await attempt(deleteEmptyMessage);
  return { storageRemoved, messageResolved };
}
