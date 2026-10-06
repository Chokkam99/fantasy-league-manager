/** @jest-environment node */
import { reportCronHeartbeat } from '../cronHeartbeat'

function fetchMock(status = 200) {
  return jest.fn().mockResolvedValue({ ok: status < 400, status }) as unknown as jest.MockedFunction<typeof fetch>
}

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => jest.restoreAllMocks())

it('does nothing when no heartbeat monitor is configured', async () => {
  const fetchImpl = fetchMock()
  await reportCronHeartbeat(undefined, 'success', fetchImpl)
  await reportCronHeartbeat('', 'fail', fetchImpl)
  expect(fetchImpl).not.toHaveBeenCalled()
})

it('pings the base URL on success and /fail on failure', async () => {
  const fetchImpl = fetchMock()
  await reportCronHeartbeat('https://hc-ping.com/abc-123', 'success', fetchImpl)
  await reportCronHeartbeat('https://hc-ping.com/abc-123/', 'fail', fetchImpl)
  expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
    'https://hc-ping.com/abc-123',
    'https://hc-ping.com/abc-123/fail',
  ])
})

it('ignores insecure or malformed URLs without throwing', async () => {
  const fetchImpl = fetchMock()
  await reportCronHeartbeat('http://hc-ping.com/abc', 'success', fetchImpl)
  await reportCronHeartbeat('not a url', 'success', fetchImpl)
  expect(fetchImpl).not.toHaveBeenCalled()
})

it('never lets a monitoring outage break the import', async () => {
  const fetchImpl = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch
  await expect(reportCronHeartbeat('https://hc-ping.com/abc', 'success', fetchImpl)).resolves.toBeUndefined()
  await expect(reportCronHeartbeat('https://hc-ping.com/abc', 'fail', fetchMock(500))).resolves.toBeUndefined()
  expect(console.warn).toHaveBeenCalledTimes(2)
})
