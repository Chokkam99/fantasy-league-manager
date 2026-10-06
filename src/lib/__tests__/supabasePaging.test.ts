import { selectAllRows } from '../supabasePaging'

const rows = Array.from({ length: 2500 }, (_, index) => ({ id: index }))

function pages(cap: number, withCount = true) {
  return jest.fn(async (from: number, to: number) => ({
    count: withCount ? rows.length : null,
    data: rows.slice(from, Math.min(to + 1, from + cap)),
    error: null,
  }))
}

it('reads past the default 1,000-row API cap in ordered ranges', async () => {
  const buildPage = pages(1000)
  const result = await selectAllRows(buildPage)
  expect(result).toEqual({ data: rows, error: null })
  expect(buildPage.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
})

it('keeps reading when the project caps responses below the page size', async () => {
  const result = await selectAllRows(pages(400))
  expect(result.data).toHaveLength(2500)
  expect(result.data.at(-1)).toEqual({ id: 2499 })
})

it('stops after a short page when no count is available', async () => {
  const buildPage = pages(1000, false)
  const result = await selectAllRows(buildPage)
  expect(result.data).toHaveLength(2500)
  expect(buildPage).toHaveBeenCalledTimes(3)
})

it('returns the first error instead of a partial success', async () => {
  const error = { code: '57014', message: 'timeout' }
  const buildPage = jest.fn()
    .mockResolvedValueOnce({ count: 2500, data: rows.slice(0, 1000), error: null })
    .mockResolvedValueOnce({ count: null, data: null, error })
  const result = await selectAllRows(buildPage)
  expect(result.error).toBe(error)
})

it('stops on an empty page even if the count promised more rows', async () => {
  const buildPage = jest.fn().mockResolvedValue({ count: 5, data: [], error: null })
  expect(await selectAllRows(buildPage)).toEqual({ data: [], error: null })
  expect(buildPage).toHaveBeenCalledTimes(1)
})
