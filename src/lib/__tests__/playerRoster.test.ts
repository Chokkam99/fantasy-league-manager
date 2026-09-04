import type { FinanceSnapshot } from '@/lib/financeClient'
import {
  applyConfirmedPaymentStatus,
  buildPlayerRosterViewModel,
} from '@/lib/playerRoster'
import type { PlayerMembership } from '@/lib/players'

const memberships: PlayerMembership[] = [
  {
    id: 'alex-2025',
    is_active: true,
    manager_id: 'alex',
    manager_name: 'Alex',
    payment_status: 'paid',
    season: '2025',
    team_name: 'Old Alex',
  },
  {
    id: 'alex-2026',
    is_active: true,
    manager_id: 'alex',
    manager_name: 'Alex',
    payment_status: 'pending',
    season: '2026',
    team_name: 'New Alex',
  },
  {
    id: 'blair-2026',
    is_active: true,
    manager_id: 'blair',
    manager_name: 'Blair',
    payment_status: 'pending',
    season: '2026',
    team_name: 'Blair Team',
  },
  {
    id: 'casey-2025',
    is_active: true,
    manager_id: 'casey',
    manager_name: 'Casey',
    payment_status: 'paid',
    season: '2025',
    team_name: 'Casey History',
  },
]

const finance: FinanceSnapshot = {
  awards: [],
  is_commissioner: true,
  payments: [
    {
      expected_amount_cents: 10000,
      id: 'payment-alex',
      league_member_id: 'alex-2026',
      notes: null,
      paid_amount_cents: 5000,
      paid_at: null,
      payment_method: null,
      status: 'partial',
    },
  ],
  payouts: [],
  schema_ready: true,
  success: true,
  summary: null,
}

describe('player roster view model', () => {
  it('uses canonical finance status, stable alphabetical order, and season metrics', () => {
    const model = buildPlayerRosterViewModel({
      duesFilter: 'all',
      finance,
      isViewOnly: false,
      memberships,
      search: '',
      selectedSeason: '2026',
    })

    expect(model.currentPlayers.map((player) => player.managerName)).toEqual([
      'Alex',
      'Blair',
    ])
    expect(model.currentPlayers[0]).toMatchObject({
      duesStatus: 'partial',
      payment: { paid_amount_cents: 5000 },
      seasons: ['2026', '2025'],
    })
    expect(model).toMatchObject({
      paidPlayers: 0,
      partialPlayers: 1,
      pendingPlayers: 1,
      representedSeasons: 2,
      returningPlayers: 1,
    })
  })

  it('filters dues only for commissioners and searches current plus history', () => {
    const commissioner = buildPlayerRosterViewModel({
      duesFilter: 'partial',
      finance,
      isViewOnly: false,
      memberships,
      search: 'old alex',
      selectedSeason: '2026',
    })
    const viewer = buildPlayerRosterViewModel({
      duesFilter: 'paid',
      finance,
      isViewOnly: true,
      memberships,
      search: '',
      selectedSeason: '2026',
    })

    expect(commissioner.filteredCurrentPlayers).toHaveLength(1)
    expect(commissioner.filteredCurrentPlayers[0].managerName).toBe('Alex')
    expect(viewer.filteredCurrentPlayers).toHaveLength(2)
    expect(viewer.currentPlayers.map((player) => player.managerName)).toEqual([
      'Alex',
      'Blair',
    ])
  })

  it('keeps former players searchable by historical season', () => {
    const model = buildPlayerRosterViewModel({
      duesFilter: 'all',
      finance: null,
      isViewOnly: false,
      memberships,
      search: '2025',
      selectedSeason: '2026',
    })

    expect(model.filteredFormerPlayers.map((player) => player.managerName)).toEqual([
      'Casey',
    ])
  })
})

describe('confirmed payment updates', () => {
  it('updates dues and finance totals without reloading the roster', () => {
    const updated = applyConfirmedPaymentStatus({
      finance: {
        ...finance,
        payments: [
          {
            ...finance.payments![0],
            paid_amount_cents: 0,
            status: 'pending',
          },
        ],
      },
      memberId: 'alex-2026',
      memberships,
      status: 'paid',
    })

    expect(
      updated.memberships.find((member) => member.id === 'alex-2026')
        ?.payment_status,
    ).toBe('paid')
    expect(updated.finance?.payments?.[0]).toMatchObject({
      paid_amount_cents: 10000,
      status: 'paid',
    })
    expect(updated.finance?.summary).toMatchObject({
      collected_cents: 10000,
      outstanding_cents: 0,
    })
  })
})
