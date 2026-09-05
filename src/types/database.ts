// Generated from the live Supabase project (jyhaavppeilbxzikuhfg) via generate_typescript_types.
// Regenerate after every migration: `supabase gen types typescript --project-id jyhaavppeilbxzikuhfg > src/types/database.ts`
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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      anchorage_conditions: {
        Row: {
          computed_at: string
          confidence_level: string
          confidence_triggers: Json
          exposure_tag: string | null
          gust_max_p90_kn: number | null
          hours_evaluated: number | null
          id: number
          min_ukc_estimate_m: number | null
          risk_flag: string
          risk_reasons: Json
          run_id: string
          seabed_type: string | null
          shelter_exposure: Json | null
          squall_risk: string
          stay_end: string
          stay_start: string
          swell_dir_predominant_deg: number | null
          swell_max_m: number | null
          tide_max_m: number | null
          tide_min_m: number | null
          tide_range_m: number | null
          wave_max_m: number | null
          waypoint_id: string
          wind_dir_predominant_deg: number | null
          wind_dir_range_deg: number | null
          wind_max_p90_kn: number | null
          wind_p50_kn: number | null
        }
        Insert: {
          computed_at?: string
          confidence_level?: string
          confidence_triggers?: Json
          exposure_tag?: string | null
          gust_max_p90_kn?: number | null
          hours_evaluated?: number | null
          id?: never
          min_ukc_estimate_m?: number | null
          risk_flag?: string
          risk_reasons?: Json
          run_id: string
          seabed_type?: string | null
          shelter_exposure?: Json | null
          squall_risk?: string
          stay_end: string
          stay_start: string
          swell_dir_predominant_deg?: number | null
          swell_max_m?: number | null
          tide_max_m?: number | null
          tide_min_m?: number | null
          tide_range_m?: number | null
          wave_max_m?: number | null
          waypoint_id: string
          wind_dir_predominant_deg?: number | null
          wind_dir_range_deg?: number | null
          wind_max_p90_kn?: number | null
          wind_p50_kn?: number | null
        }
        Update: {
          computed_at?: string
          confidence_level?: string
          confidence_triggers?: Json
          exposure_tag?: string | null
          gust_max_p90_kn?: number | null
          hours_evaluated?: number | null
          id?: never
          min_ukc_estimate_m?: number | null
          risk_flag?: string
          risk_reasons?: Json
          run_id?: string
          seabed_type?: string | null
          shelter_exposure?: Json | null
          squall_risk?: string
          stay_end?: string
          stay_start?: string
          swell_dir_predominant_deg?: number | null
          swell_max_m?: number | null
          tide_max_m?: number | null
          tide_min_m?: number | null
          tide_range_m?: number | null
          wave_max_m?: number | null
          waypoint_id?: string
          wind_dir_predominant_deg?: number | null
          wind_dir_range_deg?: number | null
          wind_max_p90_kn?: number | null
          wind_p50_kn?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anchorage_conditions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "conditions_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchorage_conditions_waypoint_id_fkey"
            columns: ["waypoint_id"]
            isOneToOne: false
            referencedRelation: "waypoints"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      chart_features: {
        Row: {
          cell_id: string | null
          depth_m: number | null
          feature_type: string
          fetched_at: string
          geom: unknown
          id: number
          properties: Json | null
          source: string
        }
        Insert: {
          cell_id?: string | null
          depth_m?: number | null
          feature_type: string
          fetched_at?: string
          geom: unknown
          id?: never
          properties?: Json | null
          source: string
        }
        Update: {
          cell_id?: string | null
          depth_m?: number | null
          feature_type?: string
          fetched_at?: string
          geom?: unknown
          id?: never
          properties?: Json | null
          source?: string
        }
        Relationships: []
      }
      conditions_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          kind: string
          passage_id: string
          previous_run_id: string | null
          sources_used: Json | null
          status: string
          trigger: string
          waypoints_evaluated: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          passage_id: string
          previous_run_id?: string | null
          sources_used?: Json | null
          status?: string
          trigger?: string
          waypoints_evaluated?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          passage_id?: string
          previous_run_id?: string | null
          sources_used?: Json | null
          status?: string
          trigger?: string
          waypoints_evaluated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conditions_runs_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conditions_runs_previous_run_id_fkey"
            columns: ["previous_run_id"]
            isOneToOne: false
            referencedRelation: "conditions_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_atmospheric: {
        Row: {
          cape_p50_jkg: number | null
          fetched_at: string
          forecast_time: string
          gust_p50_kn: number | null
          gust_p90_kn: number | null
          id: number
          init_time: string
          kind: string
          lead_time_hours: number | null
          member_count: number | null
          mslp_p10_hpa: number | null
          mslp_p50_hpa: number | null
          mslp_p90_hpa: number | null
          precip_p50_mm: number | null
          precip_prob_pct: number | null
          source: string
          target_id: number
          temp_p50_c: number | null
          visibility_p50_m: number | null
          wind_dir_mean_deg: number | null
          wind_dir_members_deg: number[] | null
          wind_dir_spread_deg: number | null
          wind_members_kn: number[] | null
          wind_p10_kn: number | null
          wind_p50_kn: number | null
          wind_p90_kn: number | null
        }
        Insert: {
          cape_p50_jkg?: number | null
          fetched_at?: string
          forecast_time: string
          gust_p50_kn?: number | null
          gust_p90_kn?: number | null
          id?: never
          init_time: string
          kind: string
          lead_time_hours?: number | null
          member_count?: number | null
          mslp_p10_hpa?: number | null
          mslp_p50_hpa?: number | null
          mslp_p90_hpa?: number | null
          precip_p50_mm?: number | null
          precip_prob_pct?: number | null
          source: string
          target_id: number
          temp_p50_c?: number | null
          visibility_p50_m?: number | null
          wind_dir_mean_deg?: number | null
          wind_dir_members_deg?: number[] | null
          wind_dir_spread_deg?: number | null
          wind_members_kn?: number[] | null
          wind_p10_kn?: number | null
          wind_p50_kn?: number | null
          wind_p90_kn?: number | null
        }
        Update: {
          cape_p50_jkg?: number | null
          fetched_at?: string
          forecast_time?: string
          gust_p50_kn?: number | null
          gust_p90_kn?: number | null
          id?: never
          init_time?: string
          kind?: string
          lead_time_hours?: number | null
          member_count?: number | null
          mslp_p10_hpa?: number | null
          mslp_p50_hpa?: number | null
          mslp_p90_hpa?: number | null
          precip_p50_mm?: number | null
          precip_prob_pct?: number | null
          source?: string
          target_id?: number
          temp_p50_c?: number | null
          visibility_p50_m?: number | null
          wind_dir_mean_deg?: number | null
          wind_dir_members_deg?: number[] | null
          wind_dir_spread_deg?: number | null
          wind_members_kn?: number[] | null
          wind_p10_kn?: number | null
          wind_p50_kn?: number | null
          wind_p90_kn?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_atmospheric_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "ingest_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_marine: {
        Row: {
          current_dir_deg: number | null
          current_speed_kn: number | null
          fetched_at: string
          forecast_time: string
          id: number
          init_time: string
          lead_time_hours: number | null
          sea_level_msl_m: number | null
          source: string
          sst_c: number | null
          swell_dir_deg: number | null
          swell_height_m: number | null
          swell_period_s: number | null
          target_id: number
          wave_dir_deg: number | null
          wave_height_m: number | null
          wave_period_s: number | null
          wind_wave_height_m: number | null
        }
        Insert: {
          current_dir_deg?: number | null
          current_speed_kn?: number | null
          fetched_at?: string
          forecast_time: string
          id?: never
          init_time: string
          lead_time_hours?: number | null
          sea_level_msl_m?: number | null
          source?: string
          sst_c?: number | null
          swell_dir_deg?: number | null
          swell_height_m?: number | null
          swell_period_s?: number | null
          target_id: number
          wave_dir_deg?: number | null
          wave_height_m?: number | null
          wave_period_s?: number | null
          wind_wave_height_m?: number | null
        }
        Update: {
          current_dir_deg?: number | null
          current_speed_kn?: number | null
          fetched_at?: string
          forecast_time?: string
          id?: never
          init_time?: string
          lead_time_hours?: number | null
          sea_level_msl_m?: number | null
          source?: string
          sst_c?: number | null
          swell_dir_deg?: number | null
          swell_height_m?: number | null
          swell_period_s?: number | null
          target_id?: number
          wave_dir_deg?: number | null
          wave_height_m?: number | null
          wave_period_s?: number | null
          wind_wave_height_m?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_marine_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "ingest_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_tidal: {
        Row: {
          datum: string
          fetched_at: string
          forecast_time: string
          id: number
          source: string
          station_distance_km: number | null
          station_id: string
          station_name: string | null
          target_id: number
          tide_height_m: number | null
          tide_state: string | null
        }
        Insert: {
          datum?: string
          fetched_at?: string
          forecast_time: string
          id?: never
          source: string
          station_distance_km?: number | null
          station_id: string
          station_name?: string | null
          target_id: number
          tide_height_m?: number | null
          tide_state?: string | null
        }
        Update: {
          datum?: string
          fetched_at?: string
          forecast_time?: string
          id?: never
          source?: string
          station_distance_km?: number | null
          station_id?: string
          station_name?: string | null
          target_id?: number
          tide_height_m?: number | null
          tide_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_tidal_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "ingest_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_targets: {
        Row: {
          active: boolean
          created_at: string
          geom: unknown
          grid_lat: number
          grid_lon: number
          horizon_end: string | null
          id: number
          last_error: string | null
          last_fetched_at: string | null
          last_init_time: string | null
          layer: string
          next_fetch_at: string
          station_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          geom?: unknown
          grid_lat: number
          grid_lon: number
          horizon_end?: string | null
          id?: never
          last_error?: string | null
          last_fetched_at?: string | null
          last_init_time?: string | null
          layer: string
          next_fetch_at?: string
          station_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          geom?: unknown
          grid_lat?: number
          grid_lon?: number
          horizon_end?: string | null
          id?: never
          last_error?: string | null
          last_fetched_at?: string | null
          last_init_time?: string | null
          layer?: string
          next_fetch_at?: string
          station_id?: string | null
        }
        Relationships: []
      }
      leg_conditions: {
        Row: {
          atmos_init_time: string | null
          cape_p50_jkg: number | null
          comparison_source: string | null
          comparison_wind_dir_deg: number | null
          comparison_wind_kn: number | null
          confidence_level: string
          confidence_triggers: Json
          created_at: string
          current_dir_deg: number | null
          current_speed_kn: number | null
          data_gaps: Json
          eta: string
          fraction: number
          from_waypoint_id: string
          gust_p90_kn: number | null
          gust_source: string | null
          id: string
          lat: number
          lead_time_hours: number | null
          lon: number
          mslp_p50_hpa: number | null
          precip_prob_pct: number | null
          risk_flag: string
          risk_reasons: Json
          run_id: string
          seq: number
          source_disagreement: boolean
          speed_loss_pct: number | null
          squall_risk: string
          swell_dir_deg: number | null
          swell_height_m: number | null
          swell_period_s: number | null
          to_waypoint_id: string
          visibility_p50_m: number | null
          wave_dir_deg: number | null
          wave_height_m: number | null
          wave_period_s: number | null
          wind_dir_delta_deg: number | null
          wind_dir_mean_deg: number | null
          wind_dir_spread_deg: number | null
          wind_p10_kn: number | null
          wind_p50_kn: number | null
          wind_p90_kn: number | null
          wind_speed_delta_kn: number | null
        }
        Insert: {
          atmos_init_time?: string | null
          cape_p50_jkg?: number | null
          comparison_source?: string | null
          comparison_wind_dir_deg?: number | null
          comparison_wind_kn?: number | null
          confidence_level: string
          confidence_triggers?: Json
          created_at?: string
          current_dir_deg?: number | null
          current_speed_kn?: number | null
          data_gaps?: Json
          eta: string
          fraction: number
          from_waypoint_id: string
          gust_p90_kn?: number | null
          gust_source?: string | null
          id?: string
          lat: number
          lead_time_hours?: number | null
          lon: number
          mslp_p50_hpa?: number | null
          precip_prob_pct?: number | null
          risk_flag: string
          risk_reasons?: Json
          run_id: string
          seq: number
          source_disagreement?: boolean
          speed_loss_pct?: number | null
          squall_risk?: string
          swell_dir_deg?: number | null
          swell_height_m?: number | null
          swell_period_s?: number | null
          to_waypoint_id: string
          visibility_p50_m?: number | null
          wave_dir_deg?: number | null
          wave_height_m?: number | null
          wave_period_s?: number | null
          wind_dir_delta_deg?: number | null
          wind_dir_mean_deg?: number | null
          wind_dir_spread_deg?: number | null
          wind_p10_kn?: number | null
          wind_p50_kn?: number | null
          wind_p90_kn?: number | null
          wind_speed_delta_kn?: number | null
        }
        Update: {
          atmos_init_time?: string | null
          cape_p50_jkg?: number | null
          comparison_source?: string | null
          comparison_wind_dir_deg?: number | null
          comparison_wind_kn?: number | null
          confidence_level?: string
          confidence_triggers?: Json
          created_at?: string
          current_dir_deg?: number | null
          current_speed_kn?: number | null
          data_gaps?: Json
          eta?: string
          fraction?: number
          from_waypoint_id?: string
          gust_p90_kn?: number | null
          gust_source?: string | null
          id?: string
          lat?: number
          lead_time_hours?: number | null
          lon?: number
          mslp_p50_hpa?: number | null
          precip_prob_pct?: number | null
          risk_flag?: string
          risk_reasons?: Json
          run_id?: string
          seq?: number
          source_disagreement?: boolean
          speed_loss_pct?: number | null
          squall_risk?: string
          swell_dir_deg?: number | null
          swell_height_m?: number | null
          swell_period_s?: number | null
          to_waypoint_id?: string
          visibility_p50_m?: number | null
          wave_dir_deg?: number | null
          wave_height_m?: number | null
          wave_period_s?: number | null
          wind_dir_delta_deg?: number | null
          wind_dir_mean_deg?: number | null
          wind_dir_spread_deg?: number | null
          wind_p10_kn?: number | null
          wind_p50_kn?: number | null
          wind_p90_kn?: number | null
          wind_speed_delta_kn?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leg_conditions_from_waypoint_id_fkey"
            columns: ["from_waypoint_id"]
            isOneToOne: false
            referencedRelation: "waypoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leg_conditions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "conditions_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leg_conditions_to_waypoint_id_fkey"
            columns: ["to_waypoint_id"]
            isOneToOne: false
            referencedRelation: "waypoints"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          briefing_id: string | null
          created_at: string
          emailed_at: string | null
          id: string
          kind: string
          owner_id: string
          passage_id: string | null
          payload: Json
          read_at: string | null
          run_id: string | null
          title: string
        }
        Insert: {
          body: string
          briefing_id?: string | null
          created_at?: string
          emailed_at?: string | null
          id?: string
          kind: string
          owner_id: string
          passage_id?: string | null
          payload?: Json
          read_at?: string | null
          run_id?: string | null
          title: string
        }
        Update: {
          body?: string
          briefing_id?: string | null
          created_at?: string
          emailed_at?: string | null
          id?: string
          kind?: string
          owner_id?: string
          passage_id?: string | null
          payload?: Json
          read_at?: string | null
          run_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "passage_briefings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "conditions_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      passage_briefings: {
        Row: {
          confidence_level: string
          confidence_triggers: Json
          disagreement_notes: string | null
          generated_at: string
          id: string
          input_hash: string
          input_snapshot: Json
          is_recheck: boolean
          material_changes: Json | null
          model_used: string
          passage_id: string
          prompt_version: string
          recommended_action: string | null
          run_id: string
          scope: string
          suggested_departure_windows: Json | null
          summary_text: string | null
          superseded_by: string | null
          validator_passed: boolean
          validator_result: Json | null
        }
        Insert: {
          confidence_level: string
          confidence_triggers?: Json
          disagreement_notes?: string | null
          generated_at?: string
          id?: string
          input_hash: string
          input_snapshot: Json
          is_recheck?: boolean
          material_changes?: Json | null
          model_used: string
          passage_id: string
          prompt_version: string
          recommended_action?: string | null
          run_id: string
          scope?: string
          suggested_departure_windows?: Json | null
          summary_text?: string | null
          superseded_by?: string | null
          validator_passed?: boolean
          validator_result?: Json | null
        }
        Update: {
          confidence_level?: string
          confidence_triggers?: Json
          disagreement_notes?: string | null
          generated_at?: string
          id?: string
          input_hash?: string
          input_snapshot?: Json
          is_recheck?: boolean
          material_changes?: Json | null
          model_used?: string
          passage_id?: string
          prompt_version?: string
          recommended_action?: string | null
          run_id?: string
          scope?: string
          suggested_departure_windows?: Json | null
          summary_text?: string | null
          superseded_by?: string | null
          validator_passed?: boolean
          validator_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "passage_briefings_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passage_briefings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "conditions_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passage_briefings_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "passage_briefings"
            referencedColumns: ["id"]
          },
        ]
      }
      passage_ingest_targets: {
        Row: {
          passage_id: string
          target_id: number
        }
        Insert: {
          passage_id: string
          target_id: number
        }
        Update: {
          passage_id?: string
          target_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "passage_ingest_targets_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passage_ingest_targets_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "ingest_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      passages: {
        Row: {
          actual_departure: string | null
          created_at: string
          frontal_activity_flag: boolean
          id: string
          name: string
          notes: string | null
          owner_id: string
          planned_departure: string
          status: string
          tropical_activity_flag: boolean
          updated_at: string
          vessel_id: string
        }
        Insert: {
          actual_departure?: string | null
          created_at?: string
          frontal_activity_flag?: boolean
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          planned_departure: string
          status?: string
          tropical_activity_flag?: boolean
          updated_at?: string
          vessel_id: string
        }
        Update: {
          actual_departure?: string | null
          created_at?: string
          frontal_activity_flag?: boolean
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          planned_departure?: string
          status?: string
          tropical_activity_flag?: boolean
          updated_at?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passages_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      vessels: {
        Row: {
          air_draft_m: number | null
          beam_m: number | null
          created_at: string
          cruise_speed_kn: number
          draft_m: number | null
          id: string
          length_m: number | null
          max_current_kn: number | null
          max_gust_kn: number | null
          max_speed_kn: number | null
          max_wave_m: number | null
          max_wind_kn: number | null
          min_ukc_m: number
          name: string
          notes: string | null
          owner_id: string
          polar_data: Json | null
          updated_at: string
          vessel_class: string | null
        }
        Insert: {
          air_draft_m?: number | null
          beam_m?: number | null
          created_at?: string
          cruise_speed_kn: number
          draft_m?: number | null
          id?: string
          length_m?: number | null
          max_current_kn?: number | null
          max_gust_kn?: number | null
          max_speed_kn?: number | null
          max_wave_m?: number | null
          max_wind_kn?: number | null
          min_ukc_m?: number
          name: string
          notes?: string | null
          owner_id?: string
          polar_data?: Json | null
          updated_at?: string
          vessel_class?: string | null
        }
        Update: {
          air_draft_m?: number | null
          beam_m?: number | null
          created_at?: string
          cruise_speed_kn?: number
          draft_m?: number | null
          id?: string
          length_m?: number | null
          max_current_kn?: number | null
          max_gust_kn?: number | null
          max_speed_kn?: number | null
          max_wave_m?: number | null
          max_wind_kn?: number | null
          min_ukc_m?: number
          name?: string
          notes?: string | null
          owner_id?: string
          polar_data?: Json | null
          updated_at?: string
          vessel_class?: string | null
        }
        Relationships: []
      }
      waypoint_conditions: {
        Row: {
          atmos_forecast_time: string | null
          atmos_init_time: string | null
          atmos_source: string | null
          cape_p50_jkg: number | null
          charted_depth_m: number | null
          comparison_source: string | null
          comparison_wind_dir_deg: number | null
          comparison_wind_kn: number | null
          computed_at: string
          confidence_level: string
          confidence_triggers: Json
          current_dir_deg: number | null
          current_speed_kn: number | null
          disagreement_detail: Json | null
          eta: string
          eta_planned: string | null
          gust_p90_kn: number | null
          gust_source: string | null
          hazard_flags: Json | null
          id: number
          lead_time_hours: number | null
          marine_init_time: string | null
          marine_source: string | null
          mslp_p50_hpa: number | null
          precip_prob_pct: number | null
          risk_flag: string
          risk_reasons: Json
          run_id: string
          source_disagreement: boolean
          speed_loss_pct: number | null
          squall_risk: string
          swell_dir_deg: number | null
          swell_height_m: number | null
          swell_period_s: number | null
          tidal_source: string | null
          tide_datum: string | null
          tide_height_m: number | null
          tide_state: string | null
          tide_station_id: string | null
          ukc_basis: string | null
          ukc_estimate_m: number | null
          visibility_p50_m: number | null
          wave_dir_deg: number | null
          wave_height_m: number | null
          wave_period_s: number | null
          waypoint_id: string
          wind_dir_delta_deg: number | null
          wind_dir_mean_deg: number | null
          wind_dir_spread_deg: number | null
          wind_p10_kn: number | null
          wind_p50_kn: number | null
          wind_p90_kn: number | null
          wind_speed_delta_kn: number | null
        }
        Insert: {
          atmos_forecast_time?: string | null
          atmos_init_time?: string | null
          atmos_source?: string | null
          cape_p50_jkg?: number | null
          charted_depth_m?: number | null
          comparison_source?: string | null
          comparison_wind_dir_deg?: number | null
          comparison_wind_kn?: number | null
          computed_at?: string
          confidence_level?: string
          confidence_triggers?: Json
          current_dir_deg?: number | null
          current_speed_kn?: number | null
          disagreement_detail?: Json | null
          eta: string
          eta_planned?: string | null
          gust_p90_kn?: number | null
          gust_source?: string | null
          hazard_flags?: Json | null
          id?: never
          lead_time_hours?: number | null
          marine_init_time?: string | null
          marine_source?: string | null
          mslp_p50_hpa?: number | null
          precip_prob_pct?: number | null
          risk_flag?: string
          risk_reasons?: Json
          run_id: string
          source_disagreement?: boolean
          speed_loss_pct?: number | null
          squall_risk?: string
          swell_dir_deg?: number | null
          swell_height_m?: number | null
          swell_period_s?: number | null
          tidal_source?: string | null
          tide_datum?: string | null
          tide_height_m?: number | null
          tide_state?: string | null
          tide_station_id?: string | null
          ukc_basis?: string | null
          ukc_estimate_m?: number | null
          visibility_p50_m?: number | null
          wave_dir_deg?: number | null
          wave_height_m?: number | null
          wave_period_s?: number | null
          waypoint_id: string
          wind_dir_delta_deg?: number | null
          wind_dir_mean_deg?: number | null
          wind_dir_spread_deg?: number | null
          wind_p10_kn?: number | null
          wind_p50_kn?: number | null
          wind_p90_kn?: number | null
          wind_speed_delta_kn?: number | null
        }
        Update: {
          atmos_forecast_time?: string | null
          atmos_init_time?: string | null
          atmos_source?: string | null
          cape_p50_jkg?: number | null
          charted_depth_m?: number | null
          comparison_source?: string | null
          comparison_wind_dir_deg?: number | null
          comparison_wind_kn?: number | null
          computed_at?: string
          confidence_level?: string
          confidence_triggers?: Json
          current_dir_deg?: number | null
          current_speed_kn?: number | null
          disagreement_detail?: Json | null
          eta?: string
          eta_planned?: string | null
          gust_p90_kn?: number | null
          gust_source?: string | null
          hazard_flags?: Json | null
          id?: never
          lead_time_hours?: number | null
          marine_init_time?: string | null
          marine_source?: string | null
          mslp_p50_hpa?: number | null
          precip_prob_pct?: number | null
          risk_flag?: string
          risk_reasons?: Json
          run_id?: string
          source_disagreement?: boolean
          speed_loss_pct?: number | null
          squall_risk?: string
          swell_dir_deg?: number | null
          swell_height_m?: number | null
          swell_period_s?: number | null
          tidal_source?: string | null
          tide_datum?: string | null
          tide_height_m?: number | null
          tide_state?: string | null
          tide_station_id?: string | null
          ukc_basis?: string | null
          ukc_estimate_m?: number | null
          visibility_p50_m?: number | null
          wave_dir_deg?: number | null
          wave_height_m?: number | null
          wave_period_s?: number | null
          waypoint_id?: string
          wind_dir_delta_deg?: number | null
          wind_dir_mean_deg?: number | null
          wind_dir_spread_deg?: number | null
          wind_p10_kn?: number | null
          wind_p50_kn?: number | null
          wind_p90_kn?: number | null
          wind_speed_delta_kn?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "waypoint_conditions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "conditions_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waypoint_conditions_waypoint_id_fkey"
            columns: ["waypoint_id"]
            isOneToOne: false
            referencedRelation: "waypoints"
            referencedColumns: ["id"]
          },
        ]
      }
      waypoints: {
        Row: {
          anchorage_exposure_tag: string | null
          arrived: boolean
          arrived_at: string | null
          charted_depth_m: number | null
          charted_depth_source: string | null
          created_at: string
          eta: string | null
          geom: unknown
          id: string
          is_anchorage: boolean
          is_complex_coastal: boolean
          lat: number
          leg_bearing_deg: number | null
          leg_distance_nm: number | null
          lon: number
          name: string | null
          passage_id: string
          planned_departure_from_here: string | null
          planned_speed_kn: number | null
          sequence: number
          source: string
          updated_at: string
        }
        Insert: {
          anchorage_exposure_tag?: string | null
          arrived?: boolean
          arrived_at?: string | null
          charted_depth_m?: number | null
          charted_depth_source?: string | null
          created_at?: string
          eta?: string | null
          geom?: unknown
          id?: string
          is_anchorage?: boolean
          is_complex_coastal?: boolean
          lat: number
          leg_bearing_deg?: number | null
          leg_distance_nm?: number | null
          lon: number
          name?: string | null
          passage_id: string
          planned_departure_from_here?: string | null
          planned_speed_kn?: number | null
          sequence: number
          source?: string
          updated_at?: string
        }
        Update: {
          anchorage_exposure_tag?: string | null
          arrived?: boolean
          arrived_at?: string | null
          charted_depth_m?: number | null
          charted_depth_source?: string | null
          created_at?: string
          eta?: string | null
          geom?: unknown
          id?: string
          is_anchorage?: boolean
          is_complex_coastal?: boolean
          lat?: number
          leg_bearing_deg?: number | null
          leg_distance_nm?: number | null
          lon?: number
          name?: string | null
          passage_id?: string
          planned_departure_from_here?: string | null
          planned_speed_kn?: number | null
          sequence?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waypoints_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      forecast_comparison: {
        Row: {
          comparison_init_time: string | null
          comparison_source: string | null
          comparison_wind_dir_deg: number | null
          comparison_wind_kn: number | null
          forecast_time: string | null
          primary_init_time: string | null
          primary_source: string | null
          primary_wind_dir_deg: number | null
          primary_wind_p10_kn: number | null
          primary_wind_p50_kn: number | null
          primary_wind_p90_kn: number | null
          target_id: number | null
          wind_dir_delta_deg: number | null
          wind_speed_delta_kn: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_atmospheric_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "ingest_targets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      angular_delta_deg: { Args: { a: number; b: number }; Returns: number }
      briefing_config: { Args: never; Returns: Json }
      chart_features_geojson: {
        Args: {
          max_lat: number
          max_lon: number
          max_rows?: number
          min_lat: number
          min_lon: number
        }
        Returns: Json
      }
      cron_secret: { Args: never; Returns: string }
      nearest_target: {
        Args: { p_geom: unknown; p_layer: string }
        Returns: number
      }
      owns_passage: { Args: { p_passage_id: string }; Returns: boolean }
      purge_forecast_cache: {
        Args: never
        Returns: {
          atmospheric_deleted: number
          marine_deleted: number
          tidal_deleted: number
        }[]
      }
      tidesatlas_api_key: { Args: never; Returns: string }
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
    Enums: {},
  },
} as const
