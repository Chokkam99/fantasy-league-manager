const { createHash } = require('node:crypto')

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function isFiniteStoredNumber(value) {
  return value !== null && value !== '' && Number.isFinite(Number(value))
}

function cents(value) {
  return Math.round(finiteNumber(value) * 100)
}

function scopeFingerprint(leagueId) {
  return createHash('sha256').update(String(leagueId)).digest('hex').slice(0, 10)
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1)
}

function sortedCounts(map, keyName) {
  return [...map.entries()]
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([key, count]) => ({ [keyName]: key, count }))
}

function scoreKey(score, season) {
  return [
    score.league_id,
    score.member_id,
    score.week_number,
    season,
    finiteNumber(score.points),
  ].join('|')
}

function positivePrizeCents(prizeStructure) {
  if (!prizeStructure || typeof prizeStructure !== 'object' || Array.isArray(prizeStructure)) {
    return 0
  }
  return Object.values(prizeStructure).reduce((total, value) => {
    const amount = finiteNumber(value)
    return total + (amount > 0 ? cents(amount) : 0)
  }, 0)
}

function analyzeNullSeasonScores(scores, members) {
  const membersById = new Map(members.map((member) => [member.id, member]))
  const canonicalCounts = new Map()
  const inferredSeasons = new Map()
  const inferredWeeks = new Map()

  for (const score of scores) {
    if (score.season && isFiniteStoredNumber(score.points)) {
      increment(canonicalCounts, scoreKey(score, score.season))
    }
  }

  let exactDuplicateCount = 0
  let ambiguousDuplicateCount = 0
  let invalidMemberSeasonCount = 0
  let invalidPointCount = 0
  let missingMemberCount = 0
  let memberScopeMismatchCount = 0
  let nonDuplicateCount = 0
  const nullScores = scores.filter((score) => score.season === null)

  for (const score of nullScores) {
    if (!isFiniteStoredNumber(score.points)) {
      invalidPointCount += 1
      continue
    }
    const member = membersById.get(score.member_id)
    if (!member) {
      missingMemberCount += 1
      continue
    }
    if (!/^\d{4}$/.test(String(member.season || ''))) {
      invalidMemberSeasonCount += 1
      continue
    }
    if (member.league_id !== score.league_id) {
      memberScopeMismatchCount += 1
      continue
    }

    const matches = canonicalCounts.get(scoreKey(score, member.season)) || 0
    if (matches === 1) {
      exactDuplicateCount += 1
      increment(inferredSeasons, member.season)
      increment(inferredWeeks, String(score.week_number))
    } else if (matches > 1) {
      ambiguousDuplicateCount += 1
    } else {
      nonDuplicateCount += 1
    }
  }

  return {
    ambiguous_duplicate_count: ambiguousDuplicateCount,
    exact_duplicate_count: exactDuplicateCount,
    inferred_seasons: sortedCounts(inferredSeasons, 'season'),
    inferred_weeks: sortedCounts(inferredWeeks, 'week').map(({ week, count }) => ({
      count,
      week: Number(week),
    })),
    invalid_member_season_count: invalidMemberSeasonCount,
    invalid_point_count: invalidPointCount,
    member_scope_mismatch_count: memberScopeMismatchCount,
    missing_member_count: missingMemberCount,
    non_duplicate_count: nonDuplicateCount,
    null_season_total: nullScores.length,
    proposed_action:
      'Delete only null-season rows that have one same-league member with a season and one exact canonical score matching member, week, season, and points.',
    ready_for_separate_cleanup_approval:
      nullScores.length > 0 &&
      exactDuplicateCount === nullScores.length &&
      ambiguousDuplicateCount === 0 &&
      invalidMemberSeasonCount === 0 &&
      invalidPointCount === 0 &&
      missingMemberCount === 0 &&
      memberScopeMismatchCount === 0 &&
      nonDuplicateCount === 0,
  }
}

function analyzeScoreLifecycle(scores) {
  const completedNotFinal = scores.filter(
    (score) => score.week_status === 'completed' && score.is_final_score !== true,
  )
  const finalNotCompleted = scores.filter(
    (score) => score.is_final_score === true && score.week_status !== 'completed',
  )
  const completedBySeason = new Map()
  const completedBySeasonWeek = new Map()
  const groupStatuses = new Map()

  for (const score of completedNotFinal) {
    increment(completedBySeason, score.season || 'null')
    increment(
      completedBySeasonWeek,
      `${score.season || 'null'}|${score.week_number}`,
    )
    const groupKey = [score.league_id, score.season, score.week_number].join('|')
    const group = groupStatuses.get(groupKey) || { candidate: 0, total: 0 }
    group.candidate += 1
    groupStatuses.set(groupKey, group)
  }
  for (const score of scores) {
    const groupKey = [score.league_id, score.season, score.week_number].join('|')
    const group = groupStatuses.get(groupKey)
    if (group) group.total += 1
  }

  const candidateGroups = [...groupStatuses.values()]
  return {
    candidate_groups: candidateGroups.length,
    completed_but_not_final_by_season: sortedCounts(completedBySeason, 'season'),
    completed_but_not_final_by_season_week: [
      ...completedBySeasonWeek.entries(),
    ]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([scope, count]) => {
        const [season, week] = scope.split('|')
        return { count, season, week: Number(week) }
      }),
    completed_but_not_final_count: completedNotFinal.length,
    final_but_not_completed_count: finalNotCompleted.length,
    proposed_action:
      "Treat week_status='completed' as authoritative for these legacy rows and set is_final_score=true only; do not rewrite points, weeks, playoff flags, or completed rows.",
    ready_for_separate_cleanup_approval:
      completedNotFinal.length > 0 && finalNotCompleted.length === 0,
    uniform_candidate_groups: candidateGroups.filter(
      (group) => group.candidate === group.total,
    ).length,
  }
}

function analyzeSeasonActivation(leagues, seasons) {
  const leaguesById = new Map(leagues.map((league) => [league.id, league]))
  const historicalActiveBySeason = new Map()
  let currentSeasonRows = 0
  let currentSeasonInactive = 0
  let historicalActiveRows = 0
  let orphanSeasonRows = 0

  for (const season of seasons) {
    const league = leaguesById.get(season.league_id)
    if (!league) {
      orphanSeasonRows += 1
      continue
    }
    if (season.season === league.current_season) {
      currentSeasonRows += 1
      if (season.is_active !== true) currentSeasonInactive += 1
    } else if (season.is_active === true) {
      historicalActiveRows += 1
      increment(historicalActiveBySeason, season.season)
    }
  }

  const missingCurrentSeasonRows = leagues.filter(
    (league) =>
      !seasons.some(
        (season) =>
          season.league_id === league.id && season.season === league.current_season,
      ),
  ).length

  return {
    current_season_inactive_count: currentSeasonInactive,
    current_season_row_count: currentSeasonRows,
    historical_active_by_season: sortedCounts(historicalActiveBySeason, 'season'),
    historical_active_count: historicalActiveRows,
    missing_current_season_count: missingCurrentSeasonRows,
    orphan_season_count: orphanSeasonRows,
    proposed_action:
      'Set league_seasons.is_active to true exactly when season equals leagues.current_season, and false for every historical row. Keep archived_at and league_members.is_active semantics separate.',
    ready_for_separate_cleanup_approval:
      missingCurrentSeasonRows === 0 &&
      currentSeasonInactive === 0 &&
      orphanSeasonRows === 0 &&
      historicalActiveRows > 0,
  }
}

function analyzeMoneyPlans(seasons, members) {
  const activeMembersByScope = new Map()
  for (const member of members) {
    if (member.is_active === false || !member.season) continue
    increment(activeMembersByScope, `${member.league_id}|${member.season}`)
  }

  const discrepancies = []
  let balancedCount = 0
  for (const season of seasons) {
    const activePlayers =
      activeMembersByScope.get(`${season.league_id}|${season.season}`) || 0
    const expectedCents = activePlayers * cents(season.fee_amount)
    const draftCents = cents(season.draft_food_cost)
    const weeklyCents =
      Math.max(Math.trunc(finiteNumber(season.total_weeks)), 0) *
      cents(season.weekly_prize_amount)
    const finalCents = positivePrizeCents(season.prize_structure)
    const plannedCents = draftCents + weeklyCents + finalCents
    const deltaCents = expectedCents - plannedCents
    if (deltaCents === 0) {
      balancedCount += 1
      continue
    }
    discrepancies.push({
      active_players: activePlayers,
      delta_cents: deltaCents,
      expected_cents: expectedCents,
      planned_cents: plannedCents,
      scope_fingerprint: scopeFingerprint(season.league_id),
      season: season.season,
      status: deltaCents > 0 ? 'unallocated' : 'overallocated',
    })
  }

  return {
    balanced_plan_count: balancedCount,
    discrepancies: discrepancies.sort((left, right) =>
      `${left.scope_fingerprint}|${left.season}`.localeCompare(
        `${right.scope_fingerprint}|${right.season}`,
      ),
    ),
    proposed_action:
      'Do not auto-correct money plans. The commissioner must either assign each positive balance to a prize/cost or explicitly preserve it as intentional unallocated money.',
    requires_product_decision_count: discrepancies.length,
    total_plan_count: seasons.length,
  }
}

function analyzeHistoricalWinnerKeys(seasons) {
  const affected = []
  for (const season of seasons) {
    const rules =
      season.prize_structure && typeof season.prize_structure === 'object'
        ? season.prize_structure
        : {}
    const winners =
      season.final_winners && typeof season.final_winners === 'object'
        ? season.final_winners
        : {}
    const extraKeys = Object.keys(winners).filter(
      (key) => !(key in rules) || finiteNumber(rules[key]) <= 0,
    )
    if (extraKeys.length > 0) {
      affected.push({
        extra_key_count: extraKeys.length,
        scope_fingerprint: scopeFingerprint(season.league_id),
        season: season.season,
      })
    }
  }
  return {
    affected_seasons: affected,
    proposed_action:
      'No cleanup recommended now. Current reads ignore non-prize keys, and removing saved historical metadata has no functional benefit.',
  }
}

function analyzeCleanupCandidates({ leagues, members, scores, seasons }) {
  return {
    baseline_counts: {
      leagues: leagues.length,
      members: members.length,
      scores: scores.length,
      seasons: seasons.length,
    },
    candidates: {
      historical_winner_keys: analyzeHistoricalWinnerKeys(seasons),
      null_season_scores: analyzeNullSeasonScores(scores, members),
      score_lifecycle: analyzeScoreLifecycle(scores),
      season_activation: analyzeSeasonActivation(leagues, seasons),
      season_money_plans: analyzeMoneyPlans(seasons, members),
    },
  }
}

function isValidSeason(value) {
  return /^\d{4}$/.test(String(value || ''))
}

function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0
}

function classifyConstraint({ blockers = 0, cleanupViolations = 0, violations = 0 }) {
  if (blockers > 0 || violations > 0) return 'blocked'
  if (cleanupViolations > 0) return 'safe_after_approved_cleanup'
  return 'compatible_now'
}

function analyzeConstraintCompatibility({
  leagues,
  matchups,
  members,
  payments,
  scores,
  seasons,
}) {
  const leagueIds = new Set(leagues.map((league) => league.id))
  const seasonsByScope = new Map(
    seasons.map((season) => [`${season.league_id}|${season.season}`, season]),
  )
  const membersById = new Map(members.map((member) => [member.id, member]))
  const scoreKeys = new Set(
    scores
      .filter((score) => score.season)
      .map(
        (score) =>
          `${score.league_id}|${score.season}|${score.week_number}|${score.member_id}`,
      ),
  )

  const nullableScopes = {
    league_current_season: leagues.filter((league) => !league.current_season).length,
    member_league_id: members.filter((member) => !member.league_id).length,
    member_season: members.filter((member) => !member.season).length,
    payment_member_id: payments.filter((payment) => !payment.league_member_id).length,
    score_league_id: scores.filter((score) => !score.league_id).length,
    score_member_id: scores.filter((score) => !score.member_id).length,
    score_season: scores.filter((score) => !score.season).length,
  }

  const invalidSeasonIdentifiers = {
    league_current_season: leagues.filter(
      (league) => !isValidSeason(league.current_season),
    ).length,
    member_season: members.filter(
      (member) => member.season !== null && !isValidSeason(member.season),
    ).length,
    matchup_season: matchups.filter(
      (matchup) => !isValidSeason(matchup.season),
    ).length,
    score_season: scores.filter(
      (score) => score.season !== null && !isValidSeason(score.season),
    ).length,
    season_configuration: seasons.filter(
      (season) => !isValidSeason(season.season),
    ).length,
  }

  const configurationRanges = {
    missing_draft_cost: seasons.filter(
      (season) => season.draft_food_cost === null || season.draft_food_cost === '',
    ).length,
    missing_weekly_prize: seasons.filter(
      (season) => season.weekly_prize_amount === null || season.weekly_prize_amount === '',
    ).length,
    invalid_draft_cost: seasons.filter(
      (season) =>
        season.draft_food_cost !== null &&
        season.draft_food_cost !== '' &&
        (!isFiniteStoredNumber(season.draft_food_cost) || Number(season.draft_food_cost) < 0),
    ).length,
    invalid_fee_amount: seasons.filter(
      (season) => !isFiniteStoredNumber(season.fee_amount) || Number(season.fee_amount) < 0,
    ).length,
    invalid_playoff_spots: seasons.filter(
      (season) => !isPositiveInteger(season.playoff_spots),
    ).length,
    invalid_playoff_start: seasons.filter(
      (season) =>
        !isPositiveInteger(season.playoff_start_week) ||
        Number(season.playoff_start_week) > Number(season.total_weeks),
    ).length,
    invalid_total_weeks: seasons.filter(
      (season) =>
        !isPositiveInteger(season.total_weeks) || Number(season.total_weeks) > 25,
    ).length,
    invalid_weekly_prize: seasons.filter(
      (season) =>
        season.weekly_prize_amount !== null &&
        season.weekly_prize_amount !== '' &&
        (!isFiniteStoredNumber(season.weekly_prize_amount) ||
          Number(season.weekly_prize_amount) < 0),
    ).length,
    negative_or_nonfinite_prize_entries: seasons.reduce((total, season) => {
      const rules =
        season.prize_structure && typeof season.prize_structure === 'object'
          ? Object.values(season.prize_structure)
          : []
      return (
        total +
        rules.filter(
          (value) => !isFiniteStoredNumber(value) || Number(value) < 0,
        ).length
      )
    }, 0),
  }
  const configurationRangeViolations =
    configurationRanges.invalid_draft_cost +
    configurationRanges.invalid_fee_amount +
    configurationRanges.invalid_playoff_spots +
    configurationRanges.invalid_playoff_start +
    configurationRanges.invalid_total_weeks +
    configurationRanges.invalid_weekly_prize +
    configurationRanges.negative_or_nonfinite_prize_entries

  const membershipIntegrity = {
    empty_manager_name: members.filter(
      (member) => typeof member.manager_name !== 'string' || !member.manager_name.trim(),
    ).length,
    empty_team_name: members.filter(
      (member) => typeof member.team_name !== 'string' || !member.team_name.trim(),
    ).length,
    manager_name_over_80_chars: members.filter(
      (member) => typeof member.manager_name === 'string' && member.manager_name.length > 80,
    ).length,
    team_name_over_80_chars: members.filter(
      (member) => typeof member.team_name === 'string' && member.team_name.length > 80,
    ).length,
    invalid_payment_status: members.filter(
      (member) => !['paid', 'pending'].includes(member.payment_status),
    ).length,
    missing_league: members.filter(
      (member) => member.league_id && !leagueIds.has(member.league_id),
    ).length,
    missing_season_configuration: members.filter(
      (member) =>
        member.league_id &&
        member.season &&
        !seasonsByScope.has(`${member.league_id}|${member.season}`),
    ).length,
  }

  const scoreIntegrity = {
    invalid_points: scores.filter((score) => !isFiniteStoredNumber(score.points)).length,
    invalid_week_number: scores.filter(
      (score) => !isPositiveInteger(score.week_number) || Number(score.week_number) > 25,
    ).length,
    invalid_week_status: scores.filter(
      (score) => !['pending', 'completed'].includes(score.week_status),
    ).length,
    missing_member: scores.filter((score) => !membersById.has(score.member_id)).length,
    outside_configured_schedule: scores.filter((score) => {
      if (!score.season) return false
      const season = seasonsByScope.get(`${score.league_id}|${score.season}`)
      return !season || Number(score.week_number) > Number(season.total_weeks)
    }).length,
    playoff_flag_mismatch: scores.filter((score) => {
      if (!score.season || typeof score.is_playoff_week !== 'boolean') return false
      const season = seasonsByScope.get(`${score.league_id}|${score.season}`)
      if (!season || !isPositiveInteger(season.playoff_start_week)) return false
      return score.is_playoff_week !==
        (Number(score.week_number) >= Number(season.playoff_start_week))
    }).length,
    scope_mismatch: scores.filter((score) => {
      const member = membersById.get(score.member_id)
      if (!member) return false
      return (
        member.league_id !== score.league_id ||
        (score.season !== null && member.season !== score.season)
      )
    }).length,
    null_final_flag: scores.filter(
      (score) => typeof score.is_final_score !== 'boolean',
    ).length,
    null_playoff_flag: scores.filter(
      (score) => typeof score.is_playoff_week !== 'boolean',
    ).length,
    status_completed_but_not_final: scores.filter(
      (score) => score.week_status === 'completed' && score.is_final_score !== true,
    ).length,
    status_final_but_not_completed: scores.filter(
      (score) => score.is_final_score === true && score.week_status !== 'completed',
    ).length,
  }

  const unorderedMatchups = new Map()
  const memberAppearances = new Map()
  let matchupMissingMember = 0
  let matchupScopeMismatch = 0
  let matchupSameTeam = 0
  let matchupInvalidWeek = 0
  let matchupOutsideSchedule = 0
  let matchupMissingScores = 0
  let matchupCompletionMismatch = 0
  let matchupNullScoresLocked = 0

  for (const matchup of matchups) {
    const season = seasonsByScope.get(`${matchup.league_id}|${matchup.season}`)
    if (!isPositiveInteger(matchup.week_number) || Number(matchup.week_number) > 25) {
      matchupInvalidWeek += 1
    }
    if (!season || Number(matchup.week_number) > Number(season.total_weeks)) {
      matchupOutsideSchedule += 1
    }
    if (matchup.team1_member_id === matchup.team2_member_id) matchupSameTeam += 1

    const team1 = membersById.get(matchup.team1_member_id)
    const team2 = membersById.get(matchup.team2_member_id)
    if (!team1 || !team2) {
      matchupMissingMember += 1
    } else if (
      team1.league_id !== matchup.league_id ||
      team2.league_id !== matchup.league_id ||
      team1.season !== matchup.season ||
      team2.season !== matchup.season
    ) {
      matchupScopeMismatch += 1
    }

    const pair = [matchup.team1_member_id, matchup.team2_member_id].sort()
    increment(
      unorderedMatchups,
      `${matchup.league_id}|${matchup.season}|${matchup.week_number}|${pair[0]}|${pair[1]}`,
    )
    for (const memberId of pair) {
      increment(
        memberAppearances,
        `${matchup.league_id}|${matchup.season}|${matchup.week_number}|${memberId}`,
      )
    }

    const scorePrefix = `${matchup.league_id}|${matchup.season}|${matchup.week_number}`
    if (
      !scoreKeys.has(`${scorePrefix}|${matchup.team1_member_id}`) ||
      !scoreKeys.has(`${scorePrefix}|${matchup.team2_member_id}`)
    ) {
      matchupMissingScores += 1
    }
    if (
      Boolean(matchup.scores_locked) !== Boolean(matchup.week_completed_at)
    ) {
      matchupCompletionMismatch += 1
    }
    if (typeof matchup.scores_locked !== 'boolean') matchupNullScoresLocked += 1
  }

  const matchupIntegrity = {
    completion_flag_timestamp_mismatch: matchupCompletionMismatch,
    double_booked_member_scopes: [...memberAppearances.values()].filter(
      (count) => count > 1,
    ).length,
    duplicate_unordered_pair_scopes: [...unorderedMatchups.values()].filter(
      (count) => count > 1,
    ).length,
    invalid_week_number: matchupInvalidWeek,
    missing_member: matchupMissingMember,
    missing_score_pair: matchupMissingScores,
    null_scores_locked: matchupNullScoresLocked,
    outside_configured_schedule: matchupOutsideSchedule,
    same_team_matchup: matchupSameTeam,
    scope_mismatch: matchupScopeMismatch,
  }

  const paymentIntegrity = {
    invalid_amount: payments.filter(
      (payment) =>
        !isFiniteStoredNumber(payment.amount) || Number(payment.amount) <= 0,
    ).length,
    missing_member: payments.filter(
      (payment) =>
        payment.league_member_id && !membersById.has(payment.league_member_id),
    ).length,
    row_count: payments.length,
  }

  const seasonActivation = analyzeSeasonActivation(leagues, seasons)
  const recommendations = [
    {
      classification: classifyConstraint({
        violations:
          nullableScopes.member_league_id +
          nullableScopes.member_season +
          membershipIntegrity.missing_league +
          membershipIntegrity.missing_season_configuration,
      }),
      constraint: 'league_members league_id and season are NOT NULL and reference one league season',
      violations:
        nullableScopes.member_league_id +
        nullableScopes.member_season +
        membershipIntegrity.missing_league +
        membershipIntegrity.missing_season_configuration,
    },
    {
      classification: classifyConstraint({
        cleanupViolations: nullableScopes.score_season,
        violations:
          nullableScopes.score_league_id +
          nullableScopes.score_member_id +
          scoreIntegrity.missing_member +
          scoreIntegrity.scope_mismatch,
      }),
      constraint: 'weekly_scores season is NOT NULL and score scope matches its member',
      violations:
        nullableScopes.score_league_id +
        nullableScopes.score_member_id +
        nullableScopes.score_season +
        scoreIntegrity.missing_member +
        scoreIntegrity.scope_mismatch,
    },
    {
      classification: classifyConstraint({
        violations:
          invalidSeasonIdentifiers.league_current_season +
          invalidSeasonIdentifiers.member_season +
          invalidSeasonIdentifiers.matchup_season +
          invalidSeasonIdentifiers.score_season +
          invalidSeasonIdentifiers.season_configuration,
      }),
      constraint: 'stored NFL season identifiers are four digits',
      violations:
        invalidSeasonIdentifiers.league_current_season +
        invalidSeasonIdentifiers.member_season +
        invalidSeasonIdentifiers.matchup_season +
        invalidSeasonIdentifiers.score_season +
        invalidSeasonIdentifiers.season_configuration,
    },
    {
      classification: classifyConstraint({
        violations: configurationRangeViolations,
      }),
      constraint: 'season weeks, playoff values, and present money amounts use safe ranges',
      violations: configurationRangeViolations,
    },
    {
      classification: classifyConstraint({
        violations:
          configurationRanges.missing_draft_cost +
          configurationRanges.missing_weekly_prize,
      }),
      constraint: 'optional season money fields are made NOT NULL only after choosing legacy defaults',
      violations:
        configurationRanges.missing_draft_cost +
        configurationRanges.missing_weekly_prize,
    },
    {
      classification: classifyConstraint({
        violations:
          membershipIntegrity.empty_manager_name +
          membershipIntegrity.empty_team_name +
          membershipIntegrity.manager_name_over_80_chars +
          membershipIntegrity.team_name_over_80_chars +
          membershipIntegrity.invalid_payment_status,
      }),
      constraint: 'member display names are nonempty and payment status uses the supported enum',
      violations:
        membershipIntegrity.empty_manager_name +
        membershipIntegrity.empty_team_name +
        membershipIntegrity.manager_name_over_80_chars +
        membershipIntegrity.team_name_over_80_chars +
        membershipIntegrity.invalid_payment_status,
    },
    {
      classification: classifyConstraint({
        violations:
          scoreIntegrity.invalid_points +
          scoreIntegrity.invalid_week_number +
          scoreIntegrity.invalid_week_status +
          scoreIntegrity.outside_configured_schedule,
      }),
      constraint: 'score points are finite and score weeks fit the configured schedule',
      violations:
        scoreIntegrity.invalid_points +
        scoreIntegrity.invalid_week_number +
        scoreIntegrity.invalid_week_status +
        scoreIntegrity.outside_configured_schedule,
    },
    {
      classification: classifyConstraint({
        cleanupViolations: scoreIntegrity.status_completed_but_not_final,
        violations:
          scoreIntegrity.null_final_flag +
          scoreIntegrity.status_final_but_not_completed,
      }),
      constraint: 'completed score status and final flag are consistent',
      violations:
        scoreIntegrity.status_completed_but_not_final +
        scoreIntegrity.null_final_flag +
        scoreIntegrity.status_final_but_not_completed,
    },
    {
      classification:
        scoreIntegrity.playoff_flag_mismatch + scoreIntegrity.null_playoff_flag === 0
          ? 'compatible_but_requires_trigger_or_import_boundary'
          : 'blocked',
      constraint: 'score playoff flag derives from configured playoff start week',
      violations:
        scoreIntegrity.playoff_flag_mismatch + scoreIntegrity.null_playoff_flag,
    },
    {
      classification: classifyConstraint({
        violations:
          matchupIntegrity.duplicate_unordered_pair_scopes +
          matchupIntegrity.same_team_matchup,
      }),
      constraint: 'one unordered matchup pair per league, season, and week',
      violations:
        matchupIntegrity.duplicate_unordered_pair_scopes +
        matchupIntegrity.same_team_matchup,
    },
    {
      classification:
        matchupIntegrity.double_booked_member_scopes === 0
          ? 'compatible_but_requires_trigger_or_schedule_redesign'
          : 'blocked',
      constraint: 'a member appears in at most one matchup per week',
      violations: matchupIntegrity.double_booked_member_scopes,
    },
    {
      classification: classifyConstraint({
        violations:
          matchupIntegrity.invalid_week_number +
          matchupIntegrity.outside_configured_schedule +
          matchupIntegrity.missing_member +
          matchupIntegrity.scope_mismatch,
      }),
      constraint: 'matchup weeks and both member scopes are valid',
      violations:
        matchupIntegrity.invalid_week_number +
        matchupIntegrity.outside_configured_schedule +
        matchupIntegrity.missing_member +
        matchupIntegrity.scope_mismatch,
    },
    {
      classification: classifyConstraint({
        violations:
          matchupIntegrity.completion_flag_timestamp_mismatch +
          matchupIntegrity.null_scores_locked,
      }),
      constraint: 'matchup score lock and completion timestamp are consistent',
      violations:
        matchupIntegrity.completion_flag_timestamp_mismatch +
        matchupIntegrity.null_scores_locked,
    },
    {
      classification:
        matchupIntegrity.missing_score_pair === 0
          ? 'compatible_but_requires_trigger_or_transaction_boundary'
          : 'blocked',
      constraint: 'each persisted matchup has both corresponding weekly scores',
      violations: matchupIntegrity.missing_score_pair,
    },
    {
      classification: classifyConstraint({
        cleanupViolations: seasonActivation.historical_active_count,
        violations:
          seasonActivation.current_season_inactive_count +
          seasonActivation.missing_current_season_count,
      }),
      constraint: 'each league has exactly one active season matching current_season',
      violations:
        seasonActivation.historical_active_count +
        seasonActivation.current_season_inactive_count +
        seasonActivation.missing_current_season_count,
    },
    {
      classification:
        paymentIntegrity.row_count === 0 ? 'insufficient_production_data' :
          classifyConstraint({
            violations:
              nullableScopes.payment_member_id +
              paymentIntegrity.invalid_amount +
              paymentIntegrity.missing_member,
          }),
      constraint: 'legacy payments have a member and positive finite amount',
      violations:
        nullableScopes.payment_member_id +
        paymentIntegrity.invalid_amount +
        paymentIntegrity.missing_member,
    },
  ]

  const classificationCounts = new Map()
  for (const recommendation of recommendations) {
    increment(classificationCounts, recommendation.classification)
  }

  return {
    baseline_counts: {
      leagues: leagues.length,
      matchups: matchups.length,
      members: members.length,
      payments: payments.length,
      scores: scores.length,
      seasons: seasons.length,
    },
    findings: {
      configuration_ranges: configurationRanges,
      invalid_season_identifiers: invalidSeasonIdentifiers,
      matchup_integrity: matchupIntegrity,
      membership_integrity: membershipIntegrity,
      nullable_scopes: nullableScopes,
      payment_integrity: paymentIntegrity,
      score_integrity: scoreIntegrity,
      season_activation: seasonActivation,
    },
    recommendation_summary: sortedCounts(
      classificationCounts,
      'classification',
    ),
    recommendations,
  }
}

module.exports = {
  analyzeCleanupCandidates,
  analyzeConstraintCompatibility,
  scopeFingerprint,
}
