// Database types for the foundation schema. Hand-written for the skeleton;
// once local Supabase is running, replace with generated types:
//   npm run gen:types

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type PracticeRole = "owner" | "dietitian" | "assistant";
type Sex = "female" | "male";

export type Database = {
  public: {
    Tables: {
      practices: {
        Row: { id: string; name: string; slug: string; timezone: string; lbp_rate: number; created_by: string | null; created_at: string };
        Insert: { id?: string; name: string; slug: string; timezone?: string; lbp_rate?: number; created_by?: string | null; created_at?: string };
        Update: { name?: string; timezone?: string; lbp_rate?: number };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; email: string; full_name: string; phone: string | null; created_at: string; updated_at: string };
        Insert: { id: string; email?: string; full_name?: string; phone?: string | null };
        Update: { full_name?: string; phone?: string | null };
        Relationships: [];
      };
      practice_users: {
        Row: { practice_id: string; user_id: string; role: PracticeRole; created_at: string };
        Insert: { practice_id: string; user_id: string; role: PracticeRole };
        Update: { role?: PracticeRole };
        Relationships: [
          { foreignKeyName: "practice_users_practice_id_fkey"; columns: ["practice_id"]; isOneToOne: false; referencedRelation: "practices"; referencedColumns: ["id"] },
          { foreignKeyName: "practice_users_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      invites: {
        Row: { id: string; practice_id: string; email: string; role: PracticeRole; invited_by: string | null; created_at: string; accepted_at: string | null };
        Insert: { practice_id: string; email: string; role: PracticeRole; invited_by?: string | null };
        Update: never;
        Relationships: [
          { foreignKeyName: "invites_practice_id_fkey"; columns: ["practice_id"]; isOneToOne: false; referencedRelation: "practices"; referencedColumns: ["id"] },
        ];
      };
      patients: {
        Row: {
          id: string;
          practice_id: string;
          dietitian_id: string | null;
          user_id: string | null;
          full_name: string;
          email: string | null;
          phone: string | null;
          date_of_birth: string | null;
          sex: Sex | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          practice_id: string;
          full_name: string;
          dietitian_id?: string | null;
          email?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          sex?: Sex | null;
        };
        Update: {
          dietitian_id?: string | null;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          sex?: Sex | null;
          archived_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "patients_practice_id_fkey"; columns: ["practice_id"]; isOneToOne: false; referencedRelation: "practices"; referencedColumns: ["id"] },
          { foreignKeyName: "patients_dietitian_id_fkey"; columns: ["dietitian_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "patients_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_practice: { Args: { p_name: string }; Returns: string };
      claim_mine: { Args: Record<string, never>; Returns: number };
      my_practice_role: { Args: { p_practice_id: string }; Returns: PracticeRole };
      is_practice_staff: { Args: { p_practice_id: string }; Returns: boolean };
      can_see_clinical: { Args: { p_patient_id: string }; Returns: boolean };
      is_patient_self: { Args: { p_patient_id: string }; Returns: boolean };
    };
    Enums: { practice_role: PracticeRole; sex: Sex };
    CompositeTypes: Record<never, never>;
  };
};
