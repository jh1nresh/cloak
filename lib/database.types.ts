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
      users: {
        Row: {
          id: string;
          avatar_url: string;
          height_cm: number | null;
          weight_kg: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          avatar_url: string;
          height_cm?: number | null;
          weight_kg?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          avatar_url?: string;
          height_cm?: number | null;
          weight_kg?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tryons: {
        Row: {
          id: string;
          user_id: string | null;
          garment_id: string | null;
          garment_url: string | null;
          result_url: string | null;
          status: "queued" | "processing" | "finalizing" | "completed" | "failed";
          fashn_prediction_id: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          garment_id?: string | null;
          garment_url?: string | null;
          result_url?: string | null;
          status?: "queued" | "processing" | "finalizing" | "completed" | "failed";
          fashn_prediction_id?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          garment_id?: string | null;
          garment_url?: string | null;
          result_url?: string | null;
          status?: "queued" | "processing" | "finalizing" | "completed" | "failed";
          fashn_prediction_id?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tryons_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tryons_garment_id_fkey";
            columns: ["garment_id"];
            referencedRelation: "garments";
            referencedColumns: ["id"];
          }
        ];
      };
      garments: {
        Row: {
          id: string;
          source_url: string;
          image_url: string;
          title: string | null;
          brand: string | null;
          price: string | null;
          domain: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_url: string;
          image_url: string;
          title?: string | null;
          brand?: string | null;
          price?: string | null;
          domain?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source_url?: string;
          image_url?: string;
          title?: string | null;
          brand?: string | null;
          price?: string | null;
          domain?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          key: string;
          count: number;
          reset_at: string;
        };
        Insert: {
          key: string;
          count?: number;
          reset_at: string;
        };
        Update: {
          key?: string;
          count?: number;
          reset_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_rate_limit: {
        Args: {
          p_key: string;
          p_max_requests: number;
          p_window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          retry_after_seconds: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type User = Database["public"]["Tables"]["users"]["Row"];
export type TryOn = Database["public"]["Tables"]["tryons"]["Row"];
export type Garment = Database["public"]["Tables"]["garments"]["Row"];
