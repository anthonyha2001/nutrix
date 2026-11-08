
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "appointments": {
                  Row: {
                    "cancel_reason": string | null,"created_at": string,"created_by": string | null,"dietitian_id": string | null,"ends_at": string,"id": string,"note": string | null,"online": boolean,"patient_id": string,"patient_note": string | null,"patient_package_id": string | null,"practice_id": string,"service_id": string | null,"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"updated_at": string,"nx_can_manage_appointment": boolean | null
                  }
                  ComputedFields: "nx_can_manage_appointment"
                  Insert: {
                    "cancel_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"dietitian_id"?: string | null,"ends_at": string,"id"?: string,"note"?: string | null,"online"?: boolean,"patient_id": string,"patient_note"?: string | null,"patient_package_id"?: string | null,"practice_id": string,"service_id"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"dietitian_id"?: string | null,"ends_at"?: string,"id"?: string,"note"?: string | null,"online"?: boolean,"patient_id"?: string,"patient_note"?: string | null,"patient_package_id"?: string | null,"practice_id"?: string,"service_id"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_dietitian_id_fkey"
      columns: ["dietitian_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_patient_package_id_fkey"
      columns: ["patient_package_id"]
isOneToOne: false
      referencedRelation: "package_usage"
      referencedColumns: ["patient_package_id"]
    },{
      foreignKeyName: "appointments_patient_package_id_fkey"
      columns: ["patient_package_id"]
isOneToOne: false
      referencedRelation: "patient_packages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"consultation_notes": {
                  Row: {
                    "appointment_id": string | null,"author_id": string | null,"body": string,"created_at": string,"id": string,"noted_on": string,"patient_id": string,"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"noted_on"?: string,"patient_id": string,"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "appointment_id"?: string | null,"author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"noted_on"?: string,"patient_id"?: string,"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consultation_notes_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
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
                },"daily_checkins": {
                  Row: {
                    "checked_in_at": string | null,"day": string,"energy": number | null,"followed_plan": number | null,"hunger": number | null,"mood": number | null,"note": string | null,"patient_id": string,"sleep_hours": number | null,"water_ml": number
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_in_at"?: string | null,"day": string,"energy"?: number | null,"followed_plan"?: number | null,"hunger"?: number | null,"mood"?: number | null,"note"?: string | null,"patient_id": string,"sleep_hours"?: number | null,"water_ml"?: number
                  }
                  Update: {
                    "checked_in_at"?: string | null,"day"?: string,"energy"?: number | null,"followed_plan"?: number | null,"hunger"?: number | null,"mood"?: number | null,"note"?: string | null,"patient_id"?: string,"sleep_hours"?: number | null,"water_ml"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_checkins_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"diary_entries": {
                  Row: {
                    "carbs_g": number,"created_at": string,"eaten_on": string,"fat_g": number,"fiber_g": number | null,"food_id": string | null,"grams": number,"id": string,"kcal": number,"name": string,"patient_id": string,"plan_meal_key": string | null,"protein_g": number,"serving": Json | null,"slot": string,"source": Database["public"]['Enums']["diary_source"]
                  }
                  ComputedFields: never
                  Insert: {
                    "carbs_g": number,"created_at"?: string,"eaten_on": string,"fat_g": number,"fiber_g"?: number | null,"food_id"?: string | null,"grams": number,"id"?: string,"kcal": number,"name": string,"patient_id": string,"plan_meal_key"?: string | null,"protein_g": number,"serving"?: Json | null,"slot": string,"source"?: Database["public"]['Enums']["diary_source"]
                  }
                  Update: {
                    "carbs_g"?: number,"created_at"?: string,"eaten_on"?: string,"fat_g"?: number,"fiber_g"?: number | null,"food_id"?: string | null,"grams"?: number,"id"?: string,"kcal"?: number,"name"?: string,"patient_id"?: string,"plan_meal_key"?: string | null,"protein_g"?: number,"serving"?: Json | null,"slot"?: string,"source"?: Database["public"]['Enums']["diary_source"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "diary_entries_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "diary_entries_patient_id_fkey"
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
                },"invoices": {
                  Row: {
                    "amount_usd": number,"appointment_id": string | null,"created_at": string,"created_by": string | null,"description": string,"id": string,"issued_on": string,"number": number,"patient_id": string,"patient_package_id": string | null,"practice_id": string,"void_reason": string | null,"voided_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_usd": number,"appointment_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description": string,"id"?: string,"issued_on"?: string,"number": number,"patient_id": string,"patient_package_id"?: string | null,"practice_id": string,"void_reason"?: string | null,"voided_at"?: string | null
                  }
                  Update: {
                    "amount_usd"?: number,"appointment_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"issued_on"?: string,"number"?: number,"patient_id"?: string,"patient_package_id"?: string | null,"practice_id"?: string,"void_reason"?: string | null,"voided_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_patient_package_id_fkey"
      columns: ["patient_package_id"]
isOneToOne: false
      referencedRelation: "package_usage"
      referencedColumns: ["patient_package_id"]
    },{
      foreignKeyName: "invoices_patient_package_id_fkey"
      columns: ["patient_package_id"]
isOneToOne: false
      referencedRelation: "patient_packages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_practice_id_fkey"
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
                },"messages": {
                  Row: {
                    "body": string,"created_at": string,"from_patient": boolean,"id": string,"patient_id": string,"read_at": string | null,"sender_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"from_patient": boolean,"id"?: string,"patient_id": string,"read_at"?: string | null,"sender_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"from_patient"?: boolean,"id"?: string,"patient_id"?: string,"read_at"?: string | null,"sender_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"package_types": {
                  Row: {
                    "archived_at": string | null,"consultations": number,"created_at": string,"id": string,"name": string,"practice_id": string,"price_usd": number,"valid_days": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"consultations": number,"created_at"?: string,"id"?: string,"name": string,"practice_id": string,"price_usd": number,"valid_days"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"consultations"?: number,"created_at"?: string,"id"?: string,"name"?: string,"practice_id"?: string,"price_usd"?: number,"valid_days"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "package_types_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
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
                },"patient_packages": {
                  Row: {
                    "cancelled_at": string | null,"consultations_total": number,"created_at": string,"created_by": string | null,"expires_on": string,"id": string,"name": string,"package_type_id": string | null,"patient_id": string,"practice_id": string,"price_usd": number,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"consultations_total": number,"created_at"?: string,"created_by"?: string | null,"expires_on": string,"id"?: string,"name": string,"package_type_id"?: string | null,"patient_id": string,"practice_id": string,"price_usd": number,"starts_on"?: string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"consultations_total"?: number,"created_at"?: string,"created_by"?: string | null,"expires_on"?: string,"id"?: string,"name"?: string,"package_type_id"?: string | null,"patient_id"?: string,"practice_id"?: string,"price_usd"?: number,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_packages_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_packages_package_type_id_fkey"
      columns: ["package_type_id"]
isOneToOne: false
      referencedRelation: "package_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_packages_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_packages_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
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
                },"payments": {
                  Row: {
                    "amount_usd": number,"id": string,"invoice_id": string,"lbp_amount": number | null,"lbp_rate": number | null,"method": Database["public"]['Enums']["payment_method"],"note": string | null,"paid_at": string,"practice_id": string,"received_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_usd": number,"id"?: string,"invoice_id": string,"lbp_amount"?: number | null,"lbp_rate"?: number | null,"method": Database["public"]['Enums']["payment_method"],"note"?: string | null,"paid_at"?: string,"practice_id": string,"received_by"?: string | null
                  }
                  Update: {
                    "amount_usd"?: number,"id"?: string,"invoice_id"?: string,"lbp_amount"?: number | null,"lbp_rate"?: number | null,"method"?: Database["public"]['Enums']["payment_method"],"note"?: string | null,"paid_at"?: string,"practice_id"?: string,"received_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoice_balances"
      referencedColumns: ["invoice_id"]
    },{
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_received_by_fkey"
      columns: ["received_by"]
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
                },"services": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"duration_min": number,"id": string,"name": string,"practice_id": string,"price_usd": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"duration_min"?: number,"id"?: string,"name": string,"practice_id": string,"price_usd"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"duration_min"?: number,"id"?: string,"name"?: string,"practice_id"?: string,"price_usd"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
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
            "invoice_balances": {
                  Row: {
                    "amount_usd": number,"due_usd": number | null,"invoice_id": string,"paid_usd": number | null,"patient_id": string,"practice_id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "amount_usd"?: number | null,"due_usd"?: never,"invoice_id"?: string | null,"paid_usd"?: never,"patient_id"?: string | null,"practice_id"?: string | null
                         }
                        Update: {
                           "amount_usd"?: number | null,"due_usd"?: never,"invoice_id"?: string | null,"paid_usd"?: never,"patient_id"?: string | null,"practice_id"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "invoices_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
      referencedColumns: ["id"]
    }
                  ]
                },"package_usage": {
                  Row: {
                    "patient_id": string,"patient_package_id": string,"practice_id": string,"remaining": number | null,"used": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "patient_id"?: string | null,"patient_package_id"?: string | null,"practice_id"?: string | null,"remaining"?: never,"used"?: never
                         }
                        Update: {
                           "patient_id"?: string | null,"patient_package_id"?: string | null,"practice_id"?: string | null,"remaining"?: never,"used"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "patient_packages_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_packages_practice_id_fkey"
      columns: ["practice_id"]
isOneToOne: false
      referencedRelation: "practices"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "activate_meal_plan":
{ Args: { "p_id": string }; Returns: undefined
                           },
"add_water":
{ Args: { "p_day": string,"p_ml": number }; Returns: number
                           },
"archive_meal_plan":
{ Args: { "p_id": string }; Returns: undefined
                           },
"book_appointment":
{ Args: { "p_dietitian_id"?: string,"p_duration_min"?: number,"p_note"?: string,"p_online"?: boolean,"p_patient_id": string,"p_service_id"?: string,"p_starts_at": string }; Returns: string
                           },
"can_see_clinical":
{ Args: { "p_patient_id": string }; Returns: boolean
                           },
"can_use_food":
{ Args: { "p_food_id": string }; Returns: boolean
                           },
"cancel_appointment":
{ Args: { "p_id": string,"p_reason"?: string }; Returns: undefined
                           },
"claim_for":
{ Args: { "p_email": string,"p_user_id": string }; Returns: number
                           },
"claim_mine":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"complete_appointment":
{ Args: { "p_attended"?: boolean,"p_bill"?: boolean,"p_id": string }; Returns: string
                           },
"confirm_appointment":
{ Args: { "p_id": string }; Returns: undefined
                           },
"copy_recipe":
{ Args: { "p_practice_id": string,"p_recipe_id": string }; Returns: string
                           },
"create_invoice":
{ Args: { "p_amount_usd": number,"p_description": string,"p_patient_id": string }; Returns: string
                           },
"create_practice":
{ Args: { "p_name": string }; Returns: string
                           },
"duplicate_template":
{ Args: { "p_id": string }; Returns: string
                           },
"is_billing":
{ Args: { "p_practice_id": string }; Returns: boolean
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
"log_food":
{ Args: { "p_eaten_on": string,"p_food_id": string,"p_grams": number,"p_plan_meal_key"?: string,"p_serving"?: Json,"p_slot": string,"p_source"?: Database["public"]['Enums']["diary_source"] }; Returns: string
                           },
"mark_thread_read":
{ Args: { "p_patient_id": string }; Returns: undefined
                           },
"my_patient_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_practice_role":
{ Args: { "p_practice_id": string }; Returns: Database["public"]['Enums']["practice_role"]
                           },
"nx_allergens":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"nx_can_manage_appointment":
{ Args: { "a": Omit<Database["public"]['Tables']["appointments"]['Row'], Database["public"]['Tables']["appointments"]['ComputedFields']> }; Returns: boolean
                           },
"nx_next_invoice_number":
{ Args: { "p_practice_id": string }; Returns: number
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
"record_payment":
{ Args: { "p_amount_usd"?: number,"p_invoice_id": string,"p_lbp_amount"?: number,"p_method": Database["public"]['Enums']["payment_method"],"p_note"?: string }; Returns: string
                           },
"refund_payment":
{ Args: { "p_payment_id": string }; Returns: undefined
                           },
"request_appointment":
{ Args: { "p_note"?: string,"p_starts_at": string }; Returns: string
                           },
"reschedule_appointment":
{ Args: { "p_duration_min"?: number,"p_id": string,"p_starts_at": string }; Returns: undefined
                           },
"save_checkin":
{ Args: { "p_day": string,"p_energy"?: number,"p_followed_plan"?: number,"p_hunger"?: number,"p_mood"?: number,"p_note"?: string,"p_sleep_hours"?: number }; Returns: undefined
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
"sell_package":
{ Args: { "p_package_type_id": string,"p_patient_id": string,"p_price_usd"?: number,"p_starts_on"?: string }; Returns: string
                           },
"template_from_plan":
{ Args: { "p_kind": Database["public"]['Enums']["template_kind"],"p_name": string,"p_plan_id": string }; Returns: string
                           },
"void_invoice":
{ Args: { "p_invoice_id": string,"p_reason"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "activity_level": "sedentary"|"light"|"moderate"|"active"|"very_active","appointment_status": "requested"|"confirmed"|"completed"|"no_show"|"cancelled","diary_source": "search"|"plan"|"swap","food_source": "usda"|"nutrix"|"practice","measurement_source": "manual"|"inbody"|"tanita"|"withings"|"apple_health"|"patient","payment_method": "cash_usd"|"cash_lbp"|"card"|"transfer"|"whish"|"omt","plan_status": "draft"|"active"|"archived","practice_role": "owner"|"dietitian"|"assistant","sex": "female"|"male","template_kind": "meal"|"day"|"week"|"program"
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
            "activity_level": ["sedentary", "light", "moderate", "active", "very_active"],"appointment_status": ["requested", "confirmed", "completed", "no_show", "cancelled"],"diary_source": ["search", "plan", "swap"],"food_source": ["usda", "nutrix", "practice"],"measurement_source": ["manual", "inbody", "tanita", "withings", "apple_health", "patient"],"payment_method": ["cash_usd", "cash_lbp", "card", "transfer", "whish", "omt"],"plan_status": ["draft", "active", "archived"],"practice_role": ["owner", "dietitian", "assistant"],"sex": ["female", "male"],"template_kind": ["meal", "day", "week", "program"]
          }
        }
} as const
