import type { RolloverPreview } from '../../src/lib/seasonSetupDraft'

export const seasonSetupPreview: RolloverPreview = {
            can_start: true,
            espn_connection: {
              auto_sync_enabled: true,
              is_configured: true,
              league_id: '123456',
            },
            members: [
              {
                id: '123e4567-e89b-42d3-a456-426614174000',
                last_season: '2025',
                manager_id: '223e4567-e89b-42d3-a456-426614174000',
                manager_name: 'Christopher Jones',
                selected_by_default: true,
                team_name: 'Old Team',
              },
              {
                id: '123e4567-e89b-42d3-a456-426614174001',
                last_season: '2025',
                manager_id: '223e4567-e89b-42d3-a456-426614174001',
                manager_name: 'Jordan Lee',
                selected_by_default: true,
                team_name: 'Second Team',
              },
              {
                id: '123e4567-e89b-42d3-a456-426614174002',
                last_season: '2023',
                manager_id: '223e4567-e89b-42d3-a456-426614174002',
                manager_name: 'Past Player',
                selected_by_default: false,
                team_name: 'Past Team',
              },
            ],
            source_configuration: {
              divisions: null,
              draft_food_cost: 0,
              fee_amount: 0,
              playoff_spots: 2,
              playoff_start_week: 15,
              prize_structure: {},
              total_weeks: 17,
              weekly_prize_amount: 0,
            },
            source_season: '2025',
            target_exists: false,
            target_season: '2026',
          }
