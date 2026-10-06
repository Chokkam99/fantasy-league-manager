interface PageResult<Row> {
  count?: number | null
  data: Row[] | null
  error: unknown
}

export const SUPABASE_PAGE_SIZE = 1000

/**
 * Read every row of a query that can exceed the Supabase API row cap
 * (1,000 rows by default), one range at a time. `buildPage` must apply a
 * total order so pages neither overlap nor skip rows, and should request an
 * exact count so a project cap below the page size cannot end the read early.
 */
export async function selectAllRows<Row>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<Row>>,
  pageSize = SUPABASE_PAGE_SIZE,
): Promise<{ data: Row[]; error: unknown }> {
  const rows: Row[] = []

  for (;;) {
    const page = await buildPage(rows.length, rows.length + pageSize - 1)
    if (page.error) return { data: rows, error: page.error }

    const data = page.data || []
    rows.push(...data)

    const total = typeof page.count === 'number' ? page.count : null
    const finished = total === null ? data.length < pageSize : rows.length >= total
    if (finished || data.length === 0) return { data: rows, error: null }
  }
}
