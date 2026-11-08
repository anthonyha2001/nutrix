
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "consultation_notes": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"id": string,"noted_on": string,"patient_id": string,"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"noted_on"?: string,"patient_id": string,"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"noted_on"?: string,"patient_id"?: string,"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consultation_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consultation_notes_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"food_servings": {
                  Row: {
                    "food_id": string,"grams": number,"id": string,"label": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "food_id": string,"grams": number,"id"?: string,"label": string,"sort"?: number
                  }
                  Update: {
                    "food_id"?: string,"grams"?: number,"id"?: string,"label"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "food_servings_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    }
                  ]
                },"foods": {
                  Row: {
                    "aliases": (string)[],"allergens": (string)[],"archived_at": string | null,"brand": string | null,"carbs_g": number,"category": string,"created_at": string,"created_by": string | null,"fat_g": number,"fiber_g": number | null,"id": string,"instructions": string | null,"is_recipe": boolean,"kcal": number,"name": string,"practice_id": string | null,"protein_g": number,"recipe_servings": number | null,"recipe_yield_g": number | null,"sodium_mg": number | null,"source": Database["public"]['Enums']["food_source"],"source_ref": string | null,"sugar_g": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"allergens"?: (string)[],"archived_at"?: string | null,"brand"?: string | null,"carbs_g"?: number,"category"?: string,"created_at"?: string,"created_by"?: string | null,"fat_g"?: number,"fiber_g"?: number | null,"id"?: string,"instructions"?: string | null,"is_recipe"?: boolean,"kcal"?: number,"name": string,"practice_id"?: string | null,"protein_g"?: number,"recipe_servings"?: number | null,"recipe_yield_g"?: number | null,"sodium_mg"?: number | null,"source": Database["public"]['Enums']["food_source"],"source_ref"?: string | null,"sugar_g"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "aliases"?: (string)[],"allergens"?: (string)[],"archived_at"?: string | null,"brand"?: string | null,"carbs_g"?: number,"category"?: string,"created_at"?: string,"created_by"?: string | null,"fat_g"?: number,"fiber_g"?: number | null,"id"?: string,"instructions"?: string | null,"is_recipe"?: boolean,"kcal"?: number,"name"?: string,"practice_id"?: string | null,"protein_g"?: number,"recipe_servings"?: number | null,"recipe_yield_g"?: number | null,"sodium_mg"?: number | null,"source"?: Database["public"]['Enums']["food_source"],"source_ref"?: string | null,"sugar_g"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "foods_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "foods_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"id": string,"invited_by": string | null,"practice_id": string,"role": Database["public"]['Enums']["practice_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"id"?: string,"invited_by"?: string | null,"practice_id": string,"role": Database["public"]['Enums']["practice_role"]
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"id"?: string,"invited_by"?: string | null,"practice_id"?: string,"role"?: Database["public"]['Enums']["practice_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
      referencedColumns: ["id"]
    }
                  ]
                },"meal_plans": {
                  Row: {
                    "activated_at": string | null,"content": NonNullable<Json>,"created_at": string,"created_by": string | null,"ends_on": string | null,"id": string,"name": string,"notes": string | null,"patient_id": string,"source_template_id": string | null,"starts_on": string | null,"status": Database["public"]['Enums']["plan_status"],"targets": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"ends_on"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"patient_id": string,"source_template_id"?: string | null,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["plan_status"],"targets"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "activated_at"?: string | null,"content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"ends_on"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"patient_id"?: string,"source_template_id"?: string | null,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["plan_status"],"targets"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_plans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_plans_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_plans_source_template_id_fkey"
      columns: ["source_template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["id"]
    }
                  ]
                },"measurements": {
                  Row: {
                    "bmr_kcal": number | null,"body_fat_pct": number | null,"body_water_pct": number | null,"created_at": string,"external_id": string | null,"hip_cm": number | null,"id": string,"measured_on": string,"muscle_mass_kg": number | null,"notes": string | null,"patient_id": string,"recorded_by": string | null,"source": Database["public"]['Enums']["measurement_source"],"visceral_fat": number | null,"waist_cm": number | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bmr_kcal"?: number | null,"body_fat_pct"?: number | null,"body_water_pct"?: number | null,"created_at"?: string,"external_id"?: string | null,"hip_cm"?: number | null,"id"?: string,"measured_on"?: string,"muscle_mass_kg"?: number | null,"notes"?: string | null,"patient_id": string,"recorded_by"?: string | null,"source"?: Database["public"]['Enums']["measurement_source"],"visceral_fat"?: number | null,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "bmr_kcal"?: number | null,"body_fat_pct"?: number | null,"body_water_pct"?: number | null,"created_at"?: string,"external_id"?: string | null,"hip_cm"?: number | null,"id"?: string,"measured_on"?: string,"muscle_mass_kg"?: number | null,"notes"?: string | null,"patient_id"?: string,"recorded_by"?: string | null,"source"?: Database["public"]['Enums']["measurement_source"],"visceral_fat"?: number | null,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "measurements_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "measurements_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_allergies": {
                  Row: {
                    "allergen": string,"created_at": string,"id": string,"kind": string,"label": string | null,"notes": string | null,"patient_id": string,"severity": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allergen": string,"created_at"?: string,"id"?: string,"kind"?: string,"label"?: string | null,"notes"?: string | null,"patient_id": string,"severity"?: string
                  }
                  Update: {
                    "allergen"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"label"?: string | null,"notes"?: string | null,"patient_id"?: string,"severity"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_allergies_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_health": {
                  Row: {
                    "activity_level": Database["public"]['Enums']["activity_level"] | null,"goal": string | null,"height_cm": number | null,"lifestyle": string | null,"medical_history": string | null,"medications": string | null,"nutrition_history": string | null,"patient_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_level"?: Database["public"]['Enums']["activity_level"] | null,"goal"?: string | null,"height_cm"?: number | null,"lifestyle"?: string | null,"medical_history"?: string | null,"medications"?: string | null,"nutrition_history"?: string | null,"patient_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "activity_level"?: Database["public"]['Enums']["activity_level"] | null,"goal"?: string | null,"height_cm"?: number | null,"lifestyle"?: string | null,"medical_history"?: string | null,"medications"?: string | null,"nutrition_history"?: string | null,"patient_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_health_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: true
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_health_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patients": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"date_of_birth": string | null,"dietitian_id": string | null,"email": string | null,"full_name": string,"id": string,"phone": string | null,"practice_id": string,"sex": Database["public"]['Enums']["sex"] | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"date_of_birth"?: string | null,"dietitian_id"?: string | null,"email"?: string | null,"full_name": string,"id"?: string,"phone"?: string | null,"practice_id": string,"sex"?: Database["public"]['Enums']["sex"] | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"date_of_birth"?: string | null,"dietitian_id"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"phone"?: string | null,"practice_id"?: string,"sex"?: Database["public"]['Enums']["sex"] | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patients_dietitian_id_fkey"
      columns: ["dietitian_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patients_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patients_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"practice_users": {
                  Row: {
                    "created_at": string,"practice_id": string,"role": Database["public"]['Enums']["practice_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"practice_id": string,"role": Database["public"]['Enums']["practice_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"practice_id"?: string,"role"?: Database["public"]['Enums']["practice_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "practice_users_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "practice_users_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"practices": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"lbp_rate": number,"name": string,"slug": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"lbp_rate"?: number,"name": string,"slug": string,"timezone"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"lbp_rate"?: number,"name"?: string,"slug"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recipe_ingredients": {
                  Row: {
                    "food_id": string,"grams": number,"id": string,"note": string | null,"recipe_id": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "food_id": string,"grams": number,"id"?: string,"note"?: string | null,"recipe_id": string,"sort"?: number
                  }
                  Update: {
                    "food_id"?: string,"grams"?: number,"id"?: string,"note"?: string | null,"recipe_id"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_ingredients_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    }
                  ]
                },"templates": {
                  Row: {
                    "category": string | null,"content": NonNullable<Json>,"created_at": string,"description": string | null,"id": string,"is_favorite": boolean,"kind": Database["public"]['Enums']["template_kind"],"name": string,"owner_id": string,"practice_id": string,"tags": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"content"?: NonNullable<Json>,"created_at"?: string,"description"?: string | null,"id"?: string,"is_favorite"?: boolean,"kind": Database["public"]['Enums']["template_kind"],"name": string,"owner_id": string,"practice_id": string,"tags"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "category"?: string | null,"content"?: NonNullable<Json>,"created_at"?: string,"description"?: string | null,"id"?: string,"is_favorite"?: boolean,"kind"?: Database["public"]['Enums']["template_kind"],"name"?: string,"owner_id"?: string,"practice_id"?: string,"tags"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "templates_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "templates_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "activate_meal_plan":
{ Args: { "p_id": string }; Returns: undefined
                           },
"archive_meal_plan":
{ Args: { "p_id": string }; Returns: undefined
                           },
"can_see_clinical":
{ Args: { "p_patient_id": string }; Returns: boolean
                           },
"can_use_food":
{ Args: { "p_food_id": string }; Returns: boolean
                           },
"claim_for":
{ Args: { "p_email": string,"p_user_id": string }; Returns: number
                           },
"claim_mine":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"copy_recipe":
{ Args: { "p_practice_id": string,"p_recipe_id": string }; Returns: string
                           },
"create_practice":
{ Args: { "p_name": string }; Returns: string
                           },
"duplicate_template":
{ Args: { "p_id": string }; Returns: string
                           },
"is_clinician":
{ Args: { "p_practice_id": string }; Returns: boolean
                           },
"is_patient_self":
{ Args: { "p_patient_id": string }; Returns: boolean
                           },
"is_practice_staff":
{ Args: { "p_practice_id": string }; Returns: boolean
                           },
"my_practice_role":
{ Args: { "p_practice_id": string }; Returns: Database["public"]['Enums']["practice_role"]
                           },
"nx_allergens":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"nx_snapshot":
{ Args: { "p_content": Json }; Returns: Json
                           },
"nx_snapshot_item":
{ Args: { "p_depth"?: number,"p_item": Json }; Returns: Json
                           },
"nx_totals":
{ Args: { "p_items": Json }; Returns: Json
                           },
"plan_from_template":
{ Args: { "p_patient_id": string,"p_template_id": string }; Returns: string
                           },
"recompute_recipe":
{ Args: { "p_recipe_id": string }; Returns: undefined
                           },
"save_food":
{ Args: { "p_allergens"?: (string)[],"p_brand"?: string,"p_carbs"?: number,"p_category"?: string,"p_fat"?: number,"p_fiber"?: number,"p_id"?: string,"p_kcal"?: number,"p_name"?: string,"p_practice_id": string,"p_protein"?: number,"p_servings"?: Json,"p_sodium"?: number,"p_sugar"?: number }; Returns: string
                           },
"save_meal_plan":
{ Args: { "p_content"?: Json,"p_ends_on"?: string,"p_id"?: string,"p_name"?: string,"p_notes"?: string,"p_patient_id": string,"p_starts_on"?: string,"p_targets"?: Json }; Returns: string
                           },
"save_recipe":
{ Args: { "p_category"?: string,"p_id"?: string,"p_ingredients"?: Json,"p_instructions"?: string,"p_name"?: string,"p_practice_id": string,"p_servings"?: number,"p_yield_g"?: number }; Returns: string
                           },
"save_template":
{ Args: { "p_category"?: string,"p_content"?: Json,"p_description"?: string,"p_id"?: string,"p_kind"?: Database["public"]['Enums']["template_kind"],"p_name"?: string,"p_practice_id": string }; Returns: string
                           },
"search_foods":
{ Args: { "p_category"?: string,"p_limit"?: number,"p_query": string }; Returns: {
              "aliases": (string)[],
"allergens": (string)[],
"archived_at": string | null,
"brand": string | null,
"carbs_g": number,
"category": string,
"created_at": string,
"created_by": string | null,
"fat_g": number,
"fiber_g": number | null,
"id": string,
"instructions": string | null,
"is_recipe": boolean,
"kcal": number,
"name": string,
"practice_id": string | null,
"protein_g": number,
"recipe_servings": number | null,
"recipe_yield_g": number | null,
"sodium_mg": number | null,
"source": Database["public"]['Enums']["food_source"],
"source_ref": string | null,
"sugar_g": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "foods"
        isOneToOne: false
        isSetofReturn: true
      } },
"template_from_plan":
{ Args: { "p_kind": Database["public"]['Enums']["template_kind"],"p_name": string,"p_plan_id": string }; Returns: string
                           }
          }
          Enums: {
            "activity_level": "sedentary"|"light"|"moderate"|"active"|"very_active","food_source": "usda"|"nutrix"|"practice","measurement_source": "manual"|"inbody"|"tanita"|"withings"|"apple_health"|"patient","plan_status": "draft"|"active"|"archived","practice_role": "owner"|"dietitian"|"assistant","sex": "female"|"male","template_kind": "meal"|"day"|"week"|"program"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "activity_level": ["sedentary", "light", "moderate", "active", "very_active"],"food_source": ["usda", "nutrix", "practice"],"measurement_source": ["manual", "inbody", "tanita", "withings", "apple_health", "patient"],"plan_status": ["draft", "active", "archived"],"practice_role": ["owner", "dietitian", "assistant"],"sex": ["female", "male"],"template_kind": ["meal", "day", "week", "program"]
          }
        }
} as const
