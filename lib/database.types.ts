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
          garment_url: string | null;
          result_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          garment_url?: string | null;
          result_url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          garment_url?: string | null;
          result_url?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tryons_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type User = Database["public"]["Tables"]["users"]["Row"];
export type TryOn = Database["public"]["Tables"]["tryons"]["Row"];
