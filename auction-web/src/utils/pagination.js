export function getPagination(defaultPage = 1, defaultLimit = 3) {
  const page = parseInt(defaultPage) || 1;
  const limit = defaultLimit;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function buildPaginationInfo(page, limit, totalCount) {
  const totalPages = Math.ceil(totalCount / limit);

  let from = (page - 1) * limit + 1;
  let to = page * limit;

  if (to > totalCount) to = totalCount;
  if (totalCount === 0) {
    from = 0;
    to = 0;
  }

  return { totalPages, from, to };
}



