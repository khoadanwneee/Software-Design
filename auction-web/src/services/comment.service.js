import * as productCommentModel from '../models/productComment.model.js';

export async function getCommentsWithReplies(productId, page, perPage) {
  const offset = (page - 1) * perPage;

  const [comments, totalComments] = await Promise.all([
    productCommentModel.getCommentsByProductId(productId, perPage, offset),
    productCommentModel.countCommentsByProductId(productId)
  ]);

  if (comments.length === 0)
    return { comments, totalComments };

  const commentIds = comments.map(c => c.id);
  const replies = await productCommentModel.getRepliesByCommentIds(commentIds);

  const repliesMap = new Map();
  for (const r of replies) {
    if (!repliesMap.has(r.parent_id)) {
      repliesMap.set(r.parent_id, []);
    }
    repliesMap.get(r.parent_id).push(r);
  }

  comments.forEach(c => {
    c.replies = repliesMap.get(c.id) || [];
  });

  return { comments, totalComments };
}