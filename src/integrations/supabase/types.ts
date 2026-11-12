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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_bans: {
        Row: {
          created_at: string
          created_by: string | null
          reason: string | null
          reason_visible: boolean
          until_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          reason?: string | null
          reason_visible?: boolean
          until_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          reason?: string | null
          reason_visible?: boolean
          until_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_bans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_bans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_moderation_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_moderation_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_moderation_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_moderation_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_moderation_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      action_events: {
        Row: {
          action: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_games: {
        Row: {
          display_name: string
          enabled: boolean
          id: string
          max_coins: number
          max_duration_seconds: number
          max_score: number
          max_xp: number
          score_per_second: number
        }
        Insert: {
          display_name: string
          enabled?: boolean
          id: string
          max_coins: number
          max_duration_seconds: number
          max_score: number
          max_xp: number
          score_per_second: number
        }
        Update: {
          display_name?: string
          enabled?: boolean
          id?: string
          max_coins?: number
          max_duration_seconds?: number
          max_score?: number
          max_xp?: number
          score_per_second?: number
        }
        Relationships: []
      }
      arcade_rounds: {
        Row: {
          client_duration_ms: number | null
          coins_awarded: number
          finished_at: string | null
          game_id: string
          id: string
          score: number | null
          seed: string
          started_at: string
          status: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          client_duration_ms?: number | null
          coins_awarded?: number
          finished_at?: string | null
          game_id: string
          id?: string
          score?: number | null
          seed?: string
          started_at?: string
          status?: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          client_duration_ms?: number | null
          coins_awarded?: number
          finished_at?: string | null
          game_id?: string
          id?: string
          score?: number | null
          seed?: string
          started_at?: string
          status?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "arcade_rounds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "arcade_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arcade_rounds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arcade_rounds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_scores: {
        Row: {
          achieved_at: string
          game_id: string
          high_score: number
          user_id: string
        }
        Insert: {
          achieved_at?: string
          game_id: string
          high_score: number
          user_id: string
        }
        Update: {
          achieved_at?: string
          game_id?: string
          high_score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_scores_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "arcade_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arcade_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arcade_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_xp_events: {
        Row: {
          amount: number
          created_at: string
          game_id: string
          id: string
          round_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          game_id: string
          id?: string
          round_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          game_id?: string
          id?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_xp_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "arcade_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arcade_xp_events_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "arcade_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arcade_xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arcade_xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          id: string
          kind: string
          name: string
          requirement: string
          sort: number
          threshold: number
        }
        Insert: {
          id: string
          kind: string
          name: string
          requirement: string
          sort: number
          threshold: number
        }
        Update: {
          id?: string
          kind?: string
          name?: string
          requirement?: string
          sort?: number
          threshold?: number
        }
        Relationships: []
      }
      chat_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          spot_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          spot_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          spot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_moderation_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          message_id: string | null
          metadata: Json
          reason: string | null
          report_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          reason?: string | null
          report_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          reason?: string | null
          report_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_moderation_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_moderation_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_moderation_log_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_moderation_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "chat_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_moderation_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_moderation_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reports: {
        Row: {
          created_at: string
          id: string
          message_excerpt: string | null
          message_id: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_excerpt?: string | null
          message_id?: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message_excerpt?: string | null
          message_id?: string | null
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_restrictions: {
        Row: {
          created_at: string
          created_by: string | null
          kind: string
          reason: string | null
          until_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          kind: string
          reason?: string | null
          until_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          kind?: string
          reason?: string | null
          until_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_restrictions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_restrictions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_restrictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_restrictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_send_events: {
        Row: {
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_send_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_send_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_ledger: {
        Row: {
          arcade_round_id: string | null
          created_at: string
          delta: number
          id: string
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          arcade_round_id?: string | null
          created_at?: string
          delta: number
          id?: string
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          arcade_round_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_activities: {
        Row: {
          active: boolean
          default_max: number
          emoji: string
          id: string
          label: string
          max_limit: number
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          default_max?: number
          emoji?: string
          id: string
          label: string
          max_limit?: number
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          default_max?: number
          emoji?: string
          id?: string
          label?: string
          max_limit?: number
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      crew_join_requests: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crew_id: string
          id?: string
          responded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_join_requests_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_members: {
        Row: {
          crew_id: string
          joined_at: string
          ready: boolean
          role: string
          user_id: string
        }
        Insert: {
          crew_id: string
          joined_at?: string
          ready?: boolean
          role?: string
          user_id: string
        }
        Update: {
          crew_id?: string
          joined_at?: string
          ready?: boolean
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_messages: {
        Row: {
          body: string
          created_at: string
          crew_id: string
          deleted_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          crew_id: string
          deleted_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          crew_id?: string
          deleted_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_messages_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          activity_id: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          description: string
          expires_at: string
          external_players: number
          headset_required: boolean
          id: string
          language: string
          leader_id: string
          max_players: number
          platform: string
          start_at: string | null
          start_mode: string
          status: string
          updated_at: string
        }
        Insert: {
          activity_id: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string
          expires_at: string
          external_players?: number
          headset_required?: boolean
          id?: string
          language: string
          leader_id: string
          max_players: number
          platform: string
          start_at?: string | null
          start_mode?: string
          status?: string
          updated_at?: string
        }
        Update: {
          activity_id?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string
          expires_at?: string
          external_players?: number
          headset_required?: boolean
          id?: string
          language?: string
          leader_id?: string
          max_players?: number
          platform?: string
          start_at?: string | null
          start_mode?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "crew_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          note: string | null
          user_id: string
          verified_by: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
          verified_by?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          last_run: string
          name: string
        }
        Insert: {
          last_run: string
          name: string
        }
        Update: {
          last_run?: string
          name?: string
        }
        Relationships: []
      }
      monthly_rankings: {
        Row: {
          approved_count: number
          computed_at: string
          month: string
          rank: number
          user_id: string
        }
        Insert: {
          approved_count: number
          computed_at?: string
          month: string
          rank: number
          user_id: string
        }
        Update: {
          approved_count?: number
          computed_at?: string
          month?: string
          rank?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_rankings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_rankings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          ref_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          ref_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          ref_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string
          created_at: string
          featured_badges: string[]
          id: string
          is_private: boolean
          premium_until: string | null
          show_avatar: boolean
          show_badges: boolean
          show_friends: boolean
          show_join_date: boolean
          username: string | null
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          featured_badges?: string[]
          id: string
          is_private?: boolean
          premium_until?: string | null
          show_avatar?: boolean
          show_badges?: boolean
          show_friends?: boolean
          show_join_date?: boolean
          username?: string | null
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          featured_badges?: string[]
          id?: string
          is_private?: boolean
          premium_until?: string | null
          show_avatar?: boolean
          show_badges?: boolean
          show_friends?: boolean
          show_join_date?: boolean
          username?: string | null
          xp?: number
        }
        Relationships: []
      }
      push_config: {
        Row: {
          dispatch_url: string
          id: number
          secret: string
          updated_at: string
        }
        Insert: {
          dispatch_url: string
          id?: number
          secret: string
          updated_at?: string
        }
        Update: {
          dispatch_url?: string
          id?: number
          secret?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_log: {
        Row: {
          id: number
          kind: string
          ref_id: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: never
          kind: string
          ref_id?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: never
          kind?: string
          ref_id?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_native_devices: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_native_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_native_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_preferences: {
        Row: {
          community: boolean
          enabled: boolean
          friend_accepted: boolean
          friend_request: boolean
          inbox: boolean
          private_message: boolean
          show_preview: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          community?: boolean
          enabled?: boolean
          friend_accepted?: boolean
          friend_request?: boolean
          inbox?: boolean
          private_message?: boolean
          show_preview?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          community?: boolean
          enabled?: boolean
          friend_accepted?: boolean
          friend_request?: boolean
          inbox?: boolean
          private_message?: boolean
          show_preview?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_corrections: {
        Row: {
          created_at: string
          id: string
          message: string
          spot_id: string
          status: Database["public"]["Enums"]["review_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          spot_id: string
          status?: Database["public"]["Enums"]["review_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          spot_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_corrections_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_corrections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_corrections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_likes: {
        Row: {
          spot_id: string
          user_id: string
        }
        Insert: {
          spot_id: string
          user_id: string
        }
        Update: {
          spot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_likes_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_photos: {
        Row: {
          created_at: string
          id: string
          path: string
          spot_id: string
          status: Database["public"]["Enums"]["review_status"]
          uploader_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          spot_id: string
          status?: Database["public"]["Enums"]["review_status"]
          uploader_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          spot_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spot_photos_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_photos_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_photos_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          spot_id: string
          status: Database["public"]["Enums"]["review_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          spot_id: string
          status?: Database["public"]["Enums"]["review_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          spot_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_reports_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_saves: {
        Row: {
          spot_id: string
          user_id: string
        }
        Insert: {
          spot_id: string
          user_id: string
        }
        Update: {
          spot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_saves_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_unlocks: {
        Row: {
          cost: number
          spot_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          cost: number
          spot_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          cost?: number
          spot_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_unlocks_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spots: {
        Row: {
          accuracy_verified_at: string | null
          accuracy_verified_by: string | null
          approved_at: string | null
          area: string
          author_id: string | null
          category: Database["public"]["Enums"]["spot_category"]
          created_at: string
          description: string
          hour: number | null
          id: string
          likes_count: number
          status: Database["public"]["Enums"]["spot_status"]
          title: string
          vehicle_type: string | null
          x: number
          y: number
        }
        Insert: {
          accuracy_verified_at?: string | null
          accuracy_verified_by?: string | null
          approved_at?: string | null
          area: string
          author_id?: string | null
          category: Database["public"]["Enums"]["spot_category"]
          created_at?: string
          description: string
          hour?: number | null
          id?: string
          likes_count?: number
          status?: Database["public"]["Enums"]["spot_status"]
          title: string
          vehicle_type?: string | null
          x: number
          y: number
        }
        Update: {
          accuracy_verified_at?: string | null
          accuracy_verified_by?: string | null
          approved_at?: string | null
          area?: string
          author_id?: string | null
          category?: Database["public"]["Enums"]["spot_category"]
          created_at?: string
          description?: string
          hour?: number | null
          id?: string
          likes_count?: number
          status?: Database["public"]["Enums"]["spot_status"]
          title?: string
          vehicle_type?: string | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "spots_accuracy_verified_by_fkey"
            columns: ["accuracy_verified_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spots_accuracy_verified_by_fkey"
            columns: ["accuracy_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spots_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spots_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_days: {
        Row: {
          day: string
          user_id: string
        }
        Insert: {
          day: string
          user_id: string
        }
        Update: {
          day?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activity_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          badge_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          admin_note: string | null
          created_at: string
          crew_id: string | null
          details: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          message_excerpt: string | null
          message_id: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          crew_id?: string | null
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message_excerpt?: string | null
          message_id?: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          crew_id?: string | null
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message_excerpt?: string | null
          message_id?: string | null
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "private_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          ref_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          ref_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          ref_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profile_cards: {
        Row: {
          avatar_path: string | null
          bio: string | null
          featured_badges: string[] | null
          full_access: boolean | null
          id: string | null
          is_private: boolean | null
          joined_at: string | null
          show_avatar: boolean | null
          show_badges: boolean | null
          show_friends: boolean | null
          show_join_date: boolean | null
          username: string | null
          xp: number | null
        }
        Insert: {
          avatar_path?: never
          bio?: never
          featured_badges?: never
          full_access?: never
          id?: string | null
          is_private?: boolean | null
          joined_at?: never
          show_avatar?: never
          show_badges?: never
          show_friends?: never
          show_join_date?: never
          username?: string | null
          xp?: never
        }
        Update: {
          avatar_path?: never
          bio?: never
          featured_badges?: never
          full_access?: never
          id?: string | null
          is_private?: boolean | null
          joined_at?: never
          show_avatar?: never
          show_badges?: never
          show_friends?: never
          show_join_date?: never
          username?: string | null
          xp?: never
        }
        Relationships: []
      }
    }
    Functions: {
      admin_ban_user: {
        Args: {
          _reason: string
          _reason_visible?: boolean
          _until: string
          _user: string
        }
        Returns: undefined
      }
      admin_broadcast: {
        Args: { _body: string; _title: string }
        Returns: number
      }
      admin_close_crew: {
        Args: { _crew: string; _reason?: string }
        Returns: undefined
      }
      admin_guard_target: { Args: { _user: string }; Returns: string }
      admin_list_reports: {
        Args: { _status?: string }
        Returns: {
          admin_note: string
          created_at: string
          crew_id: string
          details: string
          handled_at: string
          id: string
          message_excerpt: string
          reason: string
          reported_name: string
          reported_user_id: string
          reporter_id: string
          reporter_name: string
          status: string
        }[]
      }
      admin_moderation_log: {
        Args: { _user?: string }
        Returns: {
          action: string
          actor_name: string
          created_at: string
          id: string
          metadata: Json
          reason: string
          target_name: string
          target_user_id: string
        }[]
      }
      admin_search_users: {
        Args: { _q?: string }
        Returns: {
          ban_reason: string
          ban_until: string
          banned: boolean
          created_at: string
          id: string
          is_admin: boolean
          is_private: boolean
          open_reports: number
          username: string
          warnings: number
        }[]
      }
      admin_set_chat_restriction: {
        Args: {
          _kind: string
          _reason?: string
          _until_at?: string
          _user_id: string
        }
        Returns: undefined
      }
      admin_unban_user: {
        Args: { _reason?: string; _user: string }
        Returns: undefined
      }
      admin_update_report: {
        Args: { _note?: string; _report_id: string; _status: string }
        Returns: undefined
      }
      admin_upsert_crew_activity: {
        Args: {
          _active: boolean
          _default_max: number
          _emoji: string
          _id: string
          _label: string
          _max_limit: number
          _sort: number
        }
        Returns: undefined
      }
      admin_warn_user: {
        Args: { _reason: string; _user: string }
        Returns: undefined
      }
      arcade_leaderboard: {
        Args: { _game: string }
        Returns: {
          rank: number
          score: number
          user_id: string
          username: string
        }[]
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      award_badge: {
        Args: { _badge: string; _by?: string; _u: string }
        Returns: undefined
      }
      badge_metrics: { Args: { _u: string }; Returns: Json }
      badges_visible: { Args: { _u: string }; Returns: boolean }
      block_chat_user: { Args: { _blocked_id: string }; Returns: undefined }
      block_user: { Args: { _other: string }; Returns: undefined }
      can_view_avatar: { Args: { _folder: string }; Returns: boolean }
      cancel_friend_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      cancel_join_crew: { Args: { _crew: string }; Returns: undefined }
      chat_is_admin: { Args: never; Returns: boolean }
      chat_is_blocked: {
        Args: { _author: string; _viewer: string }
        Returns: boolean
      }
      check_all_badges: { Args: never; Returns: undefined }
      check_badges: { Args: { _u: string }; Returns: undefined }
      close_crew: { Args: { _crew: string }; Returns: undefined }
      compute_monthly_ranking: { Args: { _month: string }; Returns: undefined }
      create_crew: {
        Args: {
          _activity: string
          _description: string
          _external: number
          _headset: boolean
          _language: string
          _max: number
          _platform: string
          _start_at?: string
          _start_mode: string
        }
        Returns: string
      }
      crew_browse: {
        Args: {
          _activity?: string
          _language?: string
          _min_free?: number
          _platform?: string
        }
        Returns: Json
      }
      crew_card: { Args: { _id: string }; Returns: Json }
      crew_detail: { Args: { _crew: string }; Returns: Json }
      crew_expiry: {
        Args: { _created: string; _mode: string; _start: string }
        Returns: string
      }
      crew_i_am_leader: { Args: { _crew: string }; Returns: boolean }
      crew_i_am_member: { Args: { _crew: string }; Returns: boolean }
      crew_i_blocked_with: { Args: { _other: string }; Returns: boolean }
      crew_notify_members: {
        Args: { _actor: string; _crew: string; _except: string; _title: string }
        Returns: undefined
      }
      crew_occupied: { Args: { _crew: string }; Returns: number }
      crew_users_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      crew_validate: {
        Args: {
          _activity: string
          _external: number
          _language: string
          _max: number
          _mode: string
          _platform: string
          _start: string
        }
        Returns: undefined
      }
      delete_chat_message: { Args: { _message_id: string }; Returns: undefined }
      delete_crew: { Args: { _crew: string }; Returns: undefined }
      delete_crew_message: { Args: { _message: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: Json }
      delete_private_message: {
        Args: { _message_id: string }
        Returns: undefined
      }
      finalize_monthly_rankings: { Args: never; Returns: undefined }
      finish_arcade_round: {
        Args: { _duration_ms: number; _round: string; _score: number }
        Returns: Json
      }
      friends_of: { Args: { _user: string }; Returns: Json }
      grant_xp: {
        Args: { _amount: number; _reason: string; _ref: string; _user: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hit_rate_limit: {
        Args: { _action: string; _max: number; _window: string }
        Returns: undefined
      }
      is_account_banned: { Args: { _u: string }; Returns: boolean }
      leave_crew: { Args: { _crew: string }; Returns: undefined }
      mark_conversation_read: { Args: { _other: string }; Returns: undefined }
      mark_notifications_read: { Args: { _ids: string[] }; Returns: undefined }
      monthly_leaderboard: {
        Args: { _month?: string }
        Returns: {
          approved_count: number
          final: boolean
          period_end: string
          period_start: string
          rank: number
          reached_at: string
          user_id: string
          username: string
        }[]
      }
      my_account_ban: {
        Args: never
        Returns: {
          created_at: string
          permanent: boolean
          reason: string
          until_at: string
        }[]
      }
      my_arcade_stats: {
        Args: { _game: string }
        Returns: {
          high_score: number
          rank: number
          xp_earned: number
        }[]
      }
      my_badge_progress: { Args: never; Returns: Json }
      my_coin_balance: { Args: never; Returns: number }
      my_conversations: {
        Args: never
        Returns: {
          last_at: string
          last_body: string
          last_deleted: boolean
          last_from_me: boolean
          other_id: string
          unread: number
        }[]
      }
      my_crews: { Args: never; Returns: Json }
      my_friend_state: { Args: never; Returns: Json }
      my_spot_access: { Args: { _spot: string }; Returns: boolean }
      my_spot_unlock_preview: {
        Args: { _spot: string }
        Returns: {
          balance: number
          cost: number
          free_remaining: number
          unlocked: boolean
          unlocked_count: number
        }[]
      }
      notify_user: {
        Args: {
          _actor: string
          _body: string
          _kind: string
          _ref: string
          _title: string
          _user: string
        }
        Returns: undefined
      }
      purge_expired_moderation_data: { Args: never; Returns: number }
      push_admin_setup: {
        Args: { _dispatch_url: string; _secret: string }
        Returns: string
      }
      push_admin_status: { Args: { _secret: string }; Returns: Json }
      push_device_count: { Args: never; Returns: number }
      push_dispatch: {
        Args: { _payload: Json; _user: string }
        Returns: boolean
      }
      push_register_native: {
        Args: { _platform?: string; _token: string }
        Returns: undefined
      }
      push_remove_endpoints: {
        Args: { _endpoints: string[]; _secret: string }
        Returns: number
      }
      push_send_test: { Args: never; Returns: boolean }
      push_set_config: {
        Args: { _dispatch_url: string; _secret: string }
        Returns: string
      }
      push_set_preferences: {
        Args: {
          _community: boolean
          _enabled: boolean
          _friend_accepted: boolean
          _friend_request: boolean
          _inbox: boolean
          _private_message: boolean
          _show_preview: boolean
        }
        Returns: undefined
      }
      push_subscribe: {
        Args: {
          _auth: string
          _endpoint: string
          _p256dh: string
          _user_agent?: string
        }
        Returns: undefined
      }
      push_unregister_native: { Args: { _token: string }; Returns: undefined }
      push_unsubscribe: { Args: { _endpoint: string }; Returns: undefined }
      remove_crew_member: {
        Args: { _crew: string; _user: string }
        Returns: undefined
      }
      remove_friend: { Args: { _other: string }; Returns: undefined }
      report_chat_message: {
        Args: { _message_id: string; _reason: string }
        Returns: undefined
      }
      report_crew: {
        Args: { _crew: string; _details?: string; _reason: string }
        Returns: undefined
      }
      report_private_message: {
        Args: { _details?: string; _message_id: string; _reason: string }
        Returns: undefined
      }
      report_user: {
        Args: { _details?: string; _reason: string; _user: string }
        Returns: undefined
      }
      request_ban_review: { Args: { _message: string }; Returns: undefined }
      request_join_crew: { Args: { _crew: string }; Returns: string }
      require_active_user: { Args: never; Returns: string }
      require_admin: { Args: never; Returns: string }
      respond_crew_request: {
        Args: { _accept: boolean; _request: string }
        Returns: string
      }
      respond_friend_request: {
        Args: { _accept: boolean; _request_id: string }
        Returns: undefined
      }
      review_chat_report: {
        Args: { _note?: string; _report_id: string; _status: string }
        Returns: undefined
      }
      run_badge_maintenance: { Args: never; Returns: undefined }
      send_chat_message: {
        Args: { _body: string; _spot_id?: string }
        Returns: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          spot_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "chat_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_crew_message: {
        Args: { _body: string; _crew: string }
        Returns: {
          body: string
          created_at: string
          crew_id: string
          deleted_at: string | null
          id: string
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "crew_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_friend_request: { Args: { _to: string }; Returns: string }
      send_private_message: {
        Args: { _body: string; _to: string }
        Returns: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "private_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_crew_ready: {
        Args: { _crew: string; _ready: boolean }
        Returns: undefined
      }
      set_my_username: { Args: { _username: string }; Returns: string }
      set_spot_accuracy: {
        Args: { _spot: string; _verified: boolean }
        Returns: undefined
      }
      start_arcade_round: { Args: { _game: string }; Returns: Json }
      touch_activity: { Args: never; Returns: undefined }
      unblock_chat_user: { Args: { _blocked_id: string }; Returns: undefined }
      unblock_user: { Args: { _other: string }; Returns: undefined }
      unlock_spot: {
        Args: { _spot: string }
        Returns: {
          balance: number
          cost: number
          free_unlock_number: number
          unlocked: boolean
        }[]
      }
      update_crew: {
        Args: {
          _activity: string
          _crew: string
          _description: string
          _external: number
          _headset: boolean
          _language: string
          _max: number
          _platform: string
          _start_at?: string
          _start_mode: string
        }
        Returns: undefined
      }
      username_available: {
        Args: { _exclude?: string; _username: string }
        Returns: boolean
      }
      username_is_reserved: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      review_status: "pending" | "confirmed" | "rejected"
      spot_category:
        | "vehicle"
        | "weapon"
        | "collect"
        | "activity"
        | "place"
        | "other"
      spot_status: "pending" | "approved" | "rejected" | "hidden"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      review_status: ["pending", "confirmed", "rejected"],
      spot_category: [
        "vehicle",
        "weapon",
        "collect",
        "activity",
        "place",
        "other",
      ],
      spot_status: ["pending", "approved", "rejected", "hidden"],
    },
  },
} as const
