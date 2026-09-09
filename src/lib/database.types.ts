// Generated from the linked Production public schema on 2026-08-27.
// Supabase marks defaulted RPC arguments as optional but does not emit SQL NULL
// in their TypeScript types, so the five intentionally nullable arguments below
// are widened to match their deployed function contracts.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      collections: {
        Row: {
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          slug: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      import_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          league_id: string
          matchup_count: number
          score_count: number
          season: string
          source: string
          started_at: string
          status: string
          trigger_mode: string
          week_number: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          league_id: string
          matchup_count?: number
          score_count?: number
          season: string
          source?: string
          started_at?: string
          status?: string
          trigger_mode: string
          week_number: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          league_id?: string
          matchup_count?: number
          score_count?: number
          season?: string
          source?: string
          started_at?: string
          status?: string
          trigger_mode?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_runs_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          card_type: string | null
          collection_id: string | null
          condition: string | null
          created_at: string | null
          custom_field_values: Json | null
          description: string | null
          id: string
          image_url: string | null
          issue_date: string | null
          name: string
          notes: string | null
          quantity: number | null
          slug: string | null
          status_tier: string | null
          updated_at: string | null
        }
        Insert: {
          card_type?: string | null
          collection_id?: string | null
          condition?: string | null
          created_at?: string | null
          custom_field_values?: Json | null
          description?: string | null
          id?: string
          image_url?: string | null
          issue_date?: string | null
          name: string
          notes?: string | null
          quantity?: number | null
          slug?: string | null
          status_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          card_type?: string | null
          collection_id?: string | null
          condition?: string | null
          created_at?: string | null
          custom_field_values?: Json | null
          description?: string | null
          id?: string
          image_url?: string | null
          issue_date?: string | null
          name?: string
          notes?: string | null
          quantity?: number | null
          slug?: string | null
          status_tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          division: string | null
          id: string
          is_active: boolean | null
          joined_at: string | null
          league_id: string
          manager_id: string | null
          manager_name: string
          payment_status: string
          season: string
          team_name: string
          updated_at: string | null
        }
        Insert: {
          division?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          league_id: string
          manager_id?: string | null
          manager_name: string
          payment_status?: string
          season: string
          team_name: string
          updated_at?: string | null
        }
        Update: {
          division?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          league_id?: string
          manager_id?: string | null
          manager_name?: string
          payment_status?: string
          season?: string
          team_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_season_scope_fkey"
            columns: ["league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["league_id", "season"]
          },
        ]
      }
      league_seasons: {
        Row: {
          archived_at: string | null
          created_at: string | null
          divisions: Json | null
          draft_food_cost: number | null
          fee_amount: number
          final_winners: Json | null
          id: string
          is_active: boolean
          league_id: string
          playoff_spots: number
          playoff_start_week: number
          prize_structure: Json | null
          season: string
          total_weeks: number
          updated_at: string | null
          weekly_prize_amount: number | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          divisions?: Json | null
          draft_food_cost?: number | null
          fee_amount?: number
          final_winners?: Json | null
          id?: string
          is_active?: boolean
          league_id: string
          playoff_spots?: number
          playoff_start_week?: number
          prize_structure?: Json | null
          season: string
          total_weeks?: number
          updated_at?: string | null
          weekly_prize_amount?: number | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          divisions?: Json | null
          draft_food_cost?: number | null
          fee_amount?: number
          final_winners?: Json | null
          id?: string
          is_active?: boolean
          league_id?: string
          playoff_spots?: number
          playoff_start_week?: number
          prize_structure?: Json | null
          season?: string
          total_weeks?: number
          updated_at?: string | null
          weekly_prize_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_share_links: {
        Row: {
          created_at: string
          id: string
          league_id: string
          revoked_at: string | null
          season: string
          token_digest: string
          token_prefix: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          revoked_at?: string | null
          season: string
          token_digest: string
          token_prefix: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          revoked_at?: string | null
          season?: string
          token_digest?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_share_links_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          archived_at: string | null
          auto_sync_enabled: boolean | null
          created_at: string | null
          current_season: string
          espn_league_id: string | null
          espn_s2: string | null
          espn_swid: string | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          name: string
          platform_config: Json | null
          platform_league_id: string | null
          platform_type: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          auto_sync_enabled?: boolean | null
          created_at?: string | null
          current_season?: string
          espn_league_id?: string | null
          espn_s2?: string | null
          espn_swid?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          name: string
          platform_config?: Json | null
          platform_league_id?: string | null
          platform_type?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          auto_sync_enabled?: boolean | null
          created_at?: string | null
          current_season?: string
          espn_league_id?: string | null
          espn_s2?: string | null
          espn_swid?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          name?: string
          platform_config?: Json | null
          platform_league_id?: string | null
          platform_type?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      managers: {
        Row: {
          archived_at: string | null
          created_at: string
          display_name: string
          id: string
          identity_key: string
          league_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          display_name: string
          id?: string
          identity_key: string
          league_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          display_name?: string
          id?: string
          identity_key?: string
          league_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "managers_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      matchups: {
        Row: {
          created_at: string | null
          id: string
          league_id: string
          scores_locked: boolean
          season: string
          team1_member_id: string
          team2_member_id: string
          updated_at: string | null
          week_completed_at: string | null
          week_number: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          league_id: string
          scores_locked?: boolean
          season: string
          team1_member_id: string
          team2_member_id: string
          updated_at?: string | null
          week_completed_at?: string | null
          week_number: number
        }
        Update: {
          created_at?: string | null
          id?: string
          league_id?: string
          scores_locked?: boolean
          season?: string
          team1_member_id?: string
          team2_member_id?: string
          updated_at?: string | null
          week_completed_at?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "matchups_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_season_scope_fkey"
            columns: ["league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["league_id", "season"]
          },
          {
            foreignKeyName: "matchups_team1_member_id_fkey"
            columns: ["team1_member_id"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_team1_scope_fkey"
            columns: ["team1_member_id", "league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id", "league_id", "season"]
          },
          {
            foreignKeyName: "matchups_team2_member_id_fkey"
            columns: ["team2_member_id"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_team2_scope_fkey"
            columns: ["team2_member_id", "league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id", "league_id", "season"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          league_member_id: string | null
          notes: string | null
          paid_date: string | null
          payment_method: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          league_member_id?: string | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          league_member_id?: string | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_league_member_id_fkey"
            columns: ["league_member_id"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_awards: {
        Row: {
          award_key: string
          award_type: string
          category_key: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          league_id: string
          planned_amount_cents: number
          season: string
          updated_at: string
          week_number: number | null
        }
        Insert: {
          award_key: string
          award_type: string
          category_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          league_id: string
          planned_amount_cents?: number
          season: string
          updated_at?: string
          week_number?: number | null
        }
        Update: {
          award_key?: string
          award_type?: string
          category_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          league_id?: string
          planned_amount_cents?: number
          season?: string
          updated_at?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_awards_league_season_fkey"
            columns: ["league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["league_id", "season"]
          },
        ]
      }
      prize_payouts: {
        Row: {
          amount_cents: number
          award_id: string
          created_at: string
          id: string
          league_id: string
          league_member_id: string
          manager_id: string
          notes: string | null
          paid_at: string | null
          season: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          award_id: string
          created_at?: string
          id?: string
          league_id: string
          league_member_id: string
          manager_id: string
          notes?: string | null
          paid_at?: string | null
          season: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          award_id?: string
          created_at?: string
          id?: string
          league_id?: string
          league_member_id?: string
          manager_id?: string
          notes?: string | null
          paid_at?: string | null
          season?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_payouts_award_scope_fkey"
            columns: ["award_id", "league_id", "season"]
            isOneToOne: false
            referencedRelation: "prize_awards"
            referencedColumns: ["id", "league_id", "season"]
          },
          {
            foreignKeyName: "prize_payouts_manager_scope_fkey"
            columns: ["manager_id", "league_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id", "league_id"]
          },
          {
            foreignKeyName: "prize_payouts_member_scope_fkey"
            columns: ["league_member_id", "league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id", "league_id", "season"]
          },
        ]
      }
      player_payout_statuses: {
        Row: {
          created_at: string
          id: string
          league_id: string
          league_member_id: string
          paid_at: string | null
          season: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          league_member_id: string
          paid_at?: string | null
          season: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          league_member_id?: string
          paid_at?: string | null
          season?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_payout_statuses_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_payout_statuses_league_member_id_fkey"
            columns: ["league_member_id"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_payout_statuses_member_scope_fkey"
            columns: ["league_member_id", "league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id", "league_id", "season"]
          },
        ]
      }
      season_payments: {
        Row: {
          created_at: string
          expected_amount_cents: number
          id: string
          league_id: string
          league_member_id: string
          manager_id: string
          notes: string | null
          paid_amount_cents: number
          paid_at: string | null
          payment_method: string | null
          season: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_amount_cents?: number
          id?: string
          league_id: string
          league_member_id: string
          manager_id: string
          notes?: string | null
          paid_amount_cents?: number
          paid_at?: string | null
          payment_method?: string | null
          season: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_amount_cents?: number
          id?: string
          league_id?: string
          league_member_id?: string
          manager_id?: string
          notes?: string | null
          paid_amount_cents?: number
          paid_at?: string | null
          payment_method?: string | null
          season?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_payments_league_season_fkey"
            columns: ["league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["league_id", "season"]
          },
          {
            foreignKeyName: "season_payments_manager_scope_fkey"
            columns: ["manager_id", "league_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id", "league_id"]
          },
          {
            foreignKeyName: "season_payments_member_scope_fkey"
            columns: ["league_member_id", "league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id", "league_id", "season"]
          },
        ]
      }
      weekly_scores: {
        Row: {
          created_at: string | null
          id: string
          is_final_score: boolean
          is_playoff_week: boolean
          league_id: string
          member_id: string
          points: number
          season: string
          week_number: number
          week_status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_final_score?: boolean
          is_playoff_week?: boolean
          league_id: string
          member_id: string
          points: number
          season: string
          week_number: number
          week_status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_final_score?: boolean
          is_playoff_week?: boolean
          league_id?: string
          member_id?: string
          points?: number
          season?: string
          week_number?: number
          week_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_scores_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_scores_member_scope_fkey"
            columns: ["member_id", "league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id", "league_id", "season"]
          },
        ]
      }
    }
    Views: {
      matchup_results_with_scores: {
        Row: {
          created_at: string | null
          id: string | null
          is_tie: boolean | null
          league_id: string | null
          season: string | null
          team1_member_id: string | null
          team1_score: number | null
          team2_member_id: string | null
          team2_score: number | null
          updated_at: string | null
          week_number: number | null
          winner_member_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matchups_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_season_scope_fkey"
            columns: ["league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["league_id", "season"]
          },
          {
            foreignKeyName: "matchups_team1_member_id_fkey"
            columns: ["team1_member_id"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_team1_scope_fkey"
            columns: ["team1_member_id", "league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id", "league_id", "season"]
          },
          {
            foreignKeyName: "matchups_team2_member_id_fkey"
            columns: ["team2_member_id"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_team2_scope_fkey"
            columns: ["team2_member_id", "league_id", "season"]
            isOneToOne: false
            referencedRelation: "league_members"
            referencedColumns: ["id", "league_id", "season"]
          },
        ]
      }
    }
    Functions: {
      update_season_money_atomically: {
        Args: { p_league_id: string; p_season: string; p_settings: Json; p_expected: Json }
        Returns: Json
      }
      import_espn_season_atomically: {
        Args: {
          p_league_id: string; p_season: string; p_current_season: string
          p_configuration: Json; p_teams: Json; p_weeks: Json
          p_expected_members: Json; p_expected_seasons: Json; p_expected_scores: Json
          p_platform_config: Json; p_expected_platform: Json
        }
        Returns: Json
      }
      create_league_atomically: {
        Args: {
          p_configuration: Json
          p_espn_connection: Json | null
          p_league_id: string
          p_members: Json
          p_name: string
          p_season: string
        }
        Returns: Json
      }
      assign_prize_recipient: {
        Args: {
          p_award_id: string
          p_league_id: string
          p_member_id?: string | null
          p_season: string
        }
        Returns: Json
      }
      generate_random_string: { Args: { length: number }; Returns: string }
      get_season_standings: {
        Args: {
          p_include_playoffs?: boolean
          p_league_id: string
          p_season: string
        }
        Returns: {
          avg_points: number
          games_played: number
          losses: number
          manager_name: string
          member_id: string
          points_for: number
          team_name: string
          ties: number
          weekly_wins: number
          wins: number
        }[]
      }
      get_team_record: {
        Args: { p_league_id: string; p_member_id: string; p_season: string }
        Returns: {
          losses: number
          ties: number
          wins: number
        }[]
      }
      import_espn_week_atomically: {
        Args: {
          p_league_id: string
          p_matchups: Json
          p_scores: Json
          p_season: string
          p_trigger_mode: string
          p_week: number
        }
        Returns: Json
      }
      mutate_manual_week_atomically: {
        Args: {
          p_action: string
          p_league_id: string
          p_scores: Json
          p_season: string
          p_week: number | null
        }
        Returns: Json
      }
      revoke_league_share_link: {
        Args: { p_league_id: string; p_season: string }
        Returns: Json
      }
      rollover_league_season_atomically: {
        Args: {
          p_configuration: Json
          p_league_id: string
          p_members: Json
          p_source_season: string
          p_target_season: string
        }
        Returns: Json
      }
      rotate_league_share_link: {
        Args: {
          p_league_id: string
          p_season: string
          p_token_digest: string
          p_token_prefix: string
        }
        Returns: Json
      }
      set_league_archive_status: {
        Args: { p_archived: boolean; p_league_id: string }
        Returns: Json
      }
      set_player_payout_status: {
        Args: {
          p_league_id: string
          p_member_id: string
          p_season: string
          p_status: string
        }
        Returns: Json
      }
      set_prize_payout_status: {
        Args: {
          p_league_id: string
          p_payout_id: string
          p_season: string
          p_status: string
        }
        Returns: Json
      }
      set_season_archive_status: {
        Args: { p_archived: boolean; p_league_id: string; p_season: string }
        Returns: Json
      }
      set_season_payment_details: {
        Args: {
          p_league_id: string
          p_member_id: string
          p_notes?: string | null
          p_paid_amount_cents?: number | null
          p_payment_method?: string | null
          p_season: string
          p_status: string
        }
        Returns: Json
      }
      sync_season_prize_awards: {
        Args: {
          p_league_id: string
          p_prize_structure: Json
          p_season: string
          p_total_weeks: number
          p_weekly_prize_amount: number
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
