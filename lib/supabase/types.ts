export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          api_id: number;
          home_team: string;
          away_team: string;
          home_team_logo: string | null;
          away_team_logo: string | null;
          home_score: number | null;
          away_score: number | null;
          status: string;
          match_date: string;
          stage: string | null;
          group_name: string | null;
          locked_home_win_prob: number | null;
          locked_draw_prob: number | null;
          locked_away_win_prob: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          api_id: number;
          home_team: string;
          away_team: string;
          home_team_logo?: string | null;
          away_team_logo?: string | null;
          home_score?: number | null;
          away_score?: number | null;
          status?: string;
          match_date: string;
          stage?: string | null;
          group_name?: string | null;
          locked_home_win_prob?: number | null;
          locked_draw_prob?: number | null;
          locked_away_win_prob?: number | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          api_id?: number;
          home_team?: string;
          away_team?: string;
          home_team_logo?: string | null;
          away_team_logo?: string | null;
          home_score?: number | null;
          away_score?: number | null;
          status?: string;
          match_date?: string;
          stage?: string | null;
          group_name?: string | null;
          locked_home_win_prob?: number | null;
          locked_draw_prob?: number | null;
          locked_away_win_prob?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      odds: {
        Row: {
          id: string;
          game_id: string;
          home_win_prob: number;
          draw_prob: number;
          away_win_prob: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          home_win_prob: number;
          draw_prob: number;
          away_win_prob: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          home_win_prob?: number;
          draw_prob?: number;
          away_win_prob?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "odds_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: true;
            referencedRelation: "games";
            referencedColumns: ["id"];
          }
        ];
      };
      predictions: {
        Row: {
          id: string;
          user_id: string;
          game_id: string;
          home_score: number;
          away_score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_id: string;
          home_score: number;
          away_score: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          game_id?: string;
          home_score?: number;
          away_score?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          }
        ];
      };
      game_scores: {
        Row: {
          id: string;
          user_id: string;
          game_id: string;
          base_points: number;
          odds_bonus: number;
          total_points: number;
          breakdown: Json | null;
          calculated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_id: string;
          base_points: number;
          odds_bonus: number;
          breakdown?: Json | null;
          calculated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          game_id?: string;
          base_points?: number;
          odds_bonus?: number;
          breakdown?: Json | null;
          calculated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_scores_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Game = Database["public"]["Tables"]["games"]["Row"];
export type Odds = Database["public"]["Tables"]["odds"]["Row"];
export type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
export type GameScore = Database["public"]["Tables"]["game_scores"]["Row"];
