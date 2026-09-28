export function matchesQuery(fields, query) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return tokens.every((token) =>
    fields.some((value) => (value ?? '').toLowerCase().includes(token)),
  )
}
