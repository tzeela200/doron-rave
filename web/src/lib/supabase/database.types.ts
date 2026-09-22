// GENERATED from the live Supabase schema (project fvttcoavqmvzmqqgkmta) — do not edit by hand.
// Regenerate after every migration.

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
      artists: {
        Row: {
          contact_details: string
          created_at: string
          id: string
          is_archived: boolean
          legacy_name: string | null
          notes: string
          phone: string
          real_name: string
          stage_name: string
          system_notes: string
          updated_at: string
        }
        Insert: {
          contact_details?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          legacy_name?: string | null
          notes?: string
          phone?: string
          real_name?: string
          stage_name?: string
          system_notes?: string
          updated_at?: string
        }
        Update: {
          contact_details?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          legacy_name?: string | null
          notes?: string
          phone?: string
          real_name?: string
          stage_name?: string
          system_notes?: string
          updated_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          id: string
          is_archived: boolean
          mime_type: string | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          id?: string
          is_archived?: boolean
          mime_type?: string | null
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          id?: string
          is_archived?: boolean
          mime_type?: string | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          is_visible: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_visible?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_visible?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_required_items: {
        Row: {
          category_id: string | null
          created_at: string
          event_id: string
          id: string
          subcategory_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          subcategory_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          subcategory_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_required_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_required_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_required_items_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          average_ticket_price: number | null
          created_at: string
          event_date: string
          expected_ticket_count: number | null
          general_notes: string
          id: string
          is_archived: boolean
          location: string
          name: string
          updated_at: string
        }
        Insert: {
          average_ticket_price?: number | null
          created_at?: string
          event_date: string
          expected_ticket_count?: number | null
          general_notes?: string
          id?: string
          is_archived?: boolean
          location?: string
          name: string
          updated_at?: string
        }
        Update: {
          average_ticket_price?: number | null
          created_at?: string
          event_date?: string
          expected_ticket_count?: number | null
          general_notes?: string
          id?: string
          is_archived?: boolean
          location?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_coverage: {
        Row: {
          category_id: string | null
          created_at: string
          custom_label: string | null
          expense_id: string
          id: string
          is_archived: boolean
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          custom_label?: string | null
          expense_id: string
          id?: string
          is_archived?: boolean
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          custom_label?: string | null
          expense_id?: string
          id?: string
          is_archived?: boolean
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_coverage_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_coverage_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_coverage_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          agreed_amount: number
          artist_id: string | null
          category_id: string
          created_at: string
          event_id: string
          expense_date: string | null
          id: string
          internal_notes: string
          is_archived: boolean
          manual_status: string
          name: string
          paid_by: string
          performance_end_time: string | null
          performance_start_time: string | null
          planned_amount: number
          subcategory_id: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          agreed_amount?: number
          artist_id?: string | null
          category_id: string
          created_at?: string
          event_id: string
          expense_date?: string | null
          id?: string
          internal_notes?: string
          is_archived?: boolean
          manual_status?: string
          name: string
          paid_by?: string
          performance_end_time?: string | null
          performance_start_time?: string | null
          planned_amount?: number
          subcategory_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          agreed_amount?: number
          artist_id?: string | null
          category_id?: string
          created_at?: string
          event_id?: string
          expense_date?: string | null
          id?: string
          internal_notes?: string
          is_archived?: boolean
          manual_status?: string
          name?: string
          paid_by?: string
          performance_end_time?: string | null
          performance_start_time?: string | null
          planned_amount?: number
          subcategory_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_archived: boolean
          is_ticket_income: boolean
          name: string
          notes: string
          quantity: number
          total_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_archived?: boolean
          is_ticket_income?: boolean
          name: string
          notes?: string
          quantity?: number
          total_amount: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_archived?: boolean
          is_ticket_income?: boolean
          name?: string
          notes?: string
          quantity?: number
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          is_archived: boolean
          is_completed: boolean
          note_type: string
          reminder_date: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_archived?: boolean
          is_completed?: boolean
          note_type: string
          reminder_date?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_archived?: boolean
          is_completed?: boolean
          note_type?: string
          reminder_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          expense_id: string
          id: string
          is_archived: boolean
          note: string
          paid_date: string | null
          payment_method_id: string | null
          payment_status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date?: string | null
          expense_id: string
          id?: string
          is_archived?: boolean
          note?: string
          paid_date?: string | null
          payment_method_id?: string | null
          payment_status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          expense_id?: string
          id?: string
          is_archived?: boolean
          note?: string
          paid_date?: string | null
          payment_method_id?: string | null
          payment_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_archived: boolean
          is_visible: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_visible?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_visible?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tiers: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          price: number
          quantity: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          price: number
          quantity: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          price?: number
          quantity?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          contact_details: string
          created_at: string
          id: string
          is_archived: boolean
          name: string
          notes: string
          phone: string
          updated_at: string
        }
        Insert: {
          contact_details?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          notes?: string
          phone?: string
          updated_at?: string
        }
        Update: {
          contact_details?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          notes?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_active_events: {
        Row: {
          agreed_expenses: number | null
          artists_count: number | null
          average_ticket_price: number | null
          balance: number | null
          created_at: string | null
          days_until: number | null
          event_date: string | null
          expected_ticket_count: number | null
          expenses_count: number | null
          general_notes: string | null
          id: string | null
          income_total: number | null
          is_archived: boolean | null
          is_upcoming: boolean | null
          location: string | null
          name: string | null
          non_ticket_income: number | null
          paid_total: number | null
          planned_expenses: number | null
          remaining_to_pay: number | null
          ticket_income: number | null
          tickets_sold: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_event_expense_breakdown: {
        Row: {
          amount: number | null
          dimension: string | null
          event_id: string | null
          expense_count: number | null
          key_id: string | null
          label: string | null
          parent_id: string | null
          sort_order: number | null
        }
        Relationships: []
      }
      v_event_financial_totals: {
        Row: {
          agreed_expenses: number | null
          artists_count: number | null
          balance: number | null
          event_id: string | null
          expenses_count: number | null
          income_total: number | null
          non_ticket_income: number | null
          paid_total: number | null
          planned_expenses: number | null
          remaining_to_pay: number | null
          ticket_income: number | null
          tickets_sold: number | null
        }
        Relationships: []
      }
      v_event_overview: {
        Row: {
          agreed_expenses: number | null
          artists_count: number | null
          average_ticket_price: number | null
          balance: number | null
          created_at: string | null
          days_until: number | null
          event_date: string | null
          expected_ticket_count: number | null
          expenses_count: number | null
          general_notes: string | null
          id: string | null
          income_total: number | null
          is_archived: boolean | null
          is_upcoming: boolean | null
          location: string | null
          name: string | null
          non_ticket_income: number | null
          paid_total: number | null
          planned_expenses: number | null
          remaining_to_pay: number | null
          ticket_income: number | null
          tickets_sold: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_expense_payment_summary: {
        Row: {
          agreed_amount: number | null
          computed_status: string | null
          event_id: string | null
          expense_id: string | null
          has_overdue: boolean | null
          manual_status: string | null
          next_due_date: string | null
          paid_amount: number | null
          payments_count: number | null
          remaining_amount: number | null
        }
        Relationships: []
      }
      v_payments: {
        Row: {
          amount: number | null
          created_at: string | null
          due_date: string | null
          expense_id: string | null
          id: string | null
          is_overdue: boolean | null
          note: string | null
          paid_date: string | null
          payment_method_id: string | null
          payment_method_name: string | null
          payment_status: string | null
        }
        Relationships: []
      }
      v_home_summary: {
        Row: {
          active_events_count: number | null
          agreed_expenses: number | null
          income_total: number | null
          paid_total: number | null
          planned_expenses: number | null
          remaining_to_pay: number | null
          ticket_income: number | null
          tickets_sold: number | null
        }
        Relationships: []
      }
      v_vendor_usage: {
        Row: {
          events_count: number | null
          next_event_date: string | null
          next_event_id: string | null
          next_event_name: string | null
          total_agreed: number | null
          vendor_id: string | null
        }
        Relationships: []
      }
      v_artist_usage: {
        Row: {
          artist_id: string | null
          events_count: number | null
          next_event_date: string | null
          next_event_id: string | null
          next_event_name: string | null
          total_agreed: number | null
        }
        Relationships: []
      }
      v_upcoming_payments: {
        Row: {
          amount: number | null
          days_until_due: number | null
          due_date: string | null
          event_date: string | null
          event_id: string | null
          event_name: string | null
          expense_id: string | null
          expense_name: string | null
          is_overdue: boolean | null
          note: string | null
          payment_id: string | null
          payment_method_id: string | null
          payment_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      app_today: { Args: never; Returns: string }
      archive_expense: { Args: { p_expense_id: string }; Returns: undefined }
      artists_category_name: { Args: never; Returns: string }
      clone_event: { Args: { p: Json }; Returns: string }
      domain_error: { Args: { p_code: string }; Returns: undefined }
      is_artists_category: { Args: { p_category_id: string }; Returns: boolean }
      jnum: { Args: { k: string; p: Json }; Returns: number }
      jtext: { Args: { k: string; p: Json }; Returns: string }
      replace_expense_payments: {
        Args: { p_expense_id: string; p_payments: Json }
        Returns: undefined
      }
      save_expense: {
        Args: { p_coverage?: Json; p_expense: Json; p_simple_payment?: Json }
        Returns: string
      }
      save_event: { Args: { p: Json; p_tiers?: Json }; Returns: string }
      save_income: { Args: { p: Json }; Returns: string }
      save_payment: { Args: { p: Json }; Returns: string }
      set_event_required_items: {
        Args: { p_event_id: string; p_items: Json }
        Returns: undefined
      }
      set_ticket_tiers: {
        Args: { p_event_id: string; p_tiers: Json }
        Returns: undefined
      }
      upsert_payment_row: {
        Args: { p: Json; p_expense_id: string }
        Returns: string
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
