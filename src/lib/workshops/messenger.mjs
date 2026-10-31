export function mergeMessages(current,incoming){const map=new Map(current.map(m=>[m.id,m]));for(const m of incoming){if(!m.id||!Number.isInteger(m.sequence))throw Error("INVALID_MESSAGE");if(!map.has(m.id)||m.sequence>=map.get(m.id).sequence)map.set(m.id,m)}return [...map.values()].sort((a,b)=>a.sequence-b.sequence)}
const transitions={queued:["uploading","failed"],uploading:["uploaded","failed"],uploaded:[],failed:["queued"]};
export function attachmentTransition(state,next){if(!transitions[state]?.includes(next))throw Error("INVALID_ATTACHMENT_TRANSITION");return next}
export function mergeMessagesByCreatedAtId(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    if (typeof message.id !== "string" || !message.id ||
        typeof message.created_at !== "string" ||
        !Number.isFinite(Date.parse(message.created_at))) {
      throw new Error("INVALID_MESSAGE_CURSOR");
    }
    byId.set(message.id, message);
  }
  return [...byId.values()].sort((left, right) => {
    const time = Date.parse(left.created_at) - Date.parse(right.created_at);
    return time || left.id.localeCompare(right.id);
  });
}
