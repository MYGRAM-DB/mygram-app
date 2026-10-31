export function addReply(rows,parentId,reply){if(!rows.some(x=>x.id===parentId))throw Error("PARENT_NOT_FOUND");if(reply.parentId!==parentId||!reply.body.trim())throw Error("INVALID_REPLY");if(rows.some(x=>x.id===reply.id))throw Error("DUPLICATE_COMMENT");return [...rows,{...reply,body:reply.body.trim()}]}
export function editOwnedPost(post,actorId,body){if(post.authorId!==actorId)throw Error("FORBIDDEN");body=body.trim();if(!body||body.length>5000)throw Error("INVALID_POST_BODY");return {...post,body}}

export function mergePostsByCreatedAtId(current, incoming) {
  const byId = new Map(current.map((post) => [post.id, post]));
  for (const post of incoming) {
    if (
      typeof post.id !== "string" ||
      !post.id ||
      typeof post.created_at !== "string" ||
      !Number.isFinite(Date.parse(post.created_at))
    ) {
      throw new Error("INVALID_POST_CURSOR");
    }
    byId.set(post.id, post);
  }
  return [...byId.values()].sort((left, right) => {
    const time = Date.parse(right.created_at) - Date.parse(left.created_at);
    return time || right.id.localeCompare(left.id);
  });
}
