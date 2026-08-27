import { runScheduledImportTargets } from '@/lib/espn/scheduled-import'

describe('scheduled ESPN import orchestration', () => {
  it('runs one correction before the primary completed week', async () => {
    const importTarget = jest.fn(async ({ week }: { week: number }) => week)

    await expect(runScheduledImportTargets(8, importTarget)).resolves.toEqual([
      {
        result: 7,
        success: true,
        target: {
          purpose: 'correction',
          trigger_mode: 'scheduled_correction',
          week: 7,
        },
      },
      {
        result: 8,
        success: true,
        target: {
          purpose: 'primary',
          trigger_mode: 'scheduled',
          week: 8,
        },
      },
    ])
    expect(importTarget.mock.calls.map(([target]) => target.week)).toEqual([7, 8])
  })

  it('continues to the primary import when the correction pass fails', async () => {
    const correctionError = new Error('Old ESPN week unavailable')
    const importTarget = jest.fn(async ({ week }: { week: number }) => {
      if (week === 7) throw correctionError
      return week
    })

    const outcomes = await runScheduledImportTargets(8, importTarget)

    expect(outcomes[0]).toMatchObject({
      error: correctionError,
      success: false,
      target: { purpose: 'correction', week: 7 },
    })
    expect(outcomes[1]).toMatchObject({
      result: 8,
      success: true,
      target: { purpose: 'primary', week: 8 },
    })
  })
})
