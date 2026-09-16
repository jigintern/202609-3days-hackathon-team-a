import { useMemo, useState } from 'react'
import { matchesQuery } from '../lib/search.js'

export function useSearchFilter(items, getFields) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(
    () => (items ?? []).filter((item) => matchesQuery(getFields(item), search)),
    [items, getFields, search],
  )

  return { search, setSearch, filtered }
}
