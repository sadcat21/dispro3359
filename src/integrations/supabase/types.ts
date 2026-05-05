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
      "6666666666": {
        Row: {
          id: string
        }
        Insert: {
          id?: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      accounting_session_items: {
        Row: {
          actual_amount: number
          created_at: string
          difference: number | null
          expected_amount: number
          id: string
          item_type: string
          notes: string | null
          session_id: string
        }
        Insert: {
          actual_amount?: number
          created_at?: string
          difference?: number | null
          expected_amount?: number
          id?: string
          item_type: string
          notes?: string | null
          session_id: string
        }
        Update: {
          actual_amount?: number
          created_at?: string
          difference?: number | null
          expected_amount?: number
          id?: string
          item_type?: string
          notes?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "accounting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_sessions: {
        Row: {
          branch_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          is_treasury_posted: boolean
          manager_id: string
          notes: string | null
          period_end: string
          period_start: string
          review_session_id: string | null
          session_date: string
          status: string
          worker_id: string
        }
        Insert: {
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_treasury_posted?: boolean
          manager_id: string
          notes?: string | null
          period_end: string
          period_start: string
          review_session_id?: string | null
          session_date?: string
          status?: string
          worker_id: string
        }
        Update: {
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_treasury_posted?: boolean
          manager_id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          review_session_id?: string | null
          session_date?: string
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_sessions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_sessions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_sessions_review_session_id_fkey"
            columns: ["review_session_id"]
            isOneToOne: false
            referencedRelation: "manager_review_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_sessions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_sessions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action_type: string
          branch_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          worker_id: string
        }
        Insert: {
          action_type: string
          branch_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          worker_id: string
        }
        Update: {
          action_type?: string
          branch_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          action_type: string
          branch_id: string | null
          created_at: string
          distance_meters: number | null
          id: string
          latitude: number | null
          longitude: number | null
          recorded_at: string
          worker_id: string
        }
        Insert: {
          action_type: string
          branch_id?: string | null
          created_at?: string
          distance_meters?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          recorded_at?: string
          worker_id: string
        }
        Update: {
          action_type?: string
          branch_id?: string | null
          created_at?: string
          distance_meters?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          recorded_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_logs: {
        Row: {
          backup_type: string
          completed_at: string | null
          created_at: string
          date_from: string | null
          date_to: string | null
          error_message: string | null
          google_sheet_id: string | null
          google_sheet_url: string | null
          id: string
          selected_tables: string[] | null
          status: string
          table_details: Json | null
          tables_count: number | null
          total_rows: number | null
          triggered_by: string | null
        }
        Insert: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          error_message?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          id?: string
          selected_tables?: string[] | null
          status?: string
          table_details?: Json | null
          tables_count?: number | null
          total_rows?: number | null
          triggered_by?: string | null
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          error_message?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          id?: string
          selected_tables?: string[] | null
          status?: string
          table_details?: Json | null
          tables_count?: number | null
          total_rows?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      branch_pallets: {
        Row: {
          branch_id: string
          id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          id?: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_pallets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          admin_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          wilaya: string
        }
        Insert: {
          address?: string | null
          admin_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          wilaya: string
        }
        Update: {
          address?: string | null
          admin_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          wilaya?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          account_id: string | null
          account_type: string
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          from_account_id: string | null
          from_account_type: string | null
          id: string
          movement_type: string
          notes: string | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          running_balance: number | null
          signed_amount: number | null
          to_account_id: string | null
          to_account_type: string | null
          worker_id: string | null
        }
        Insert: {
          account_id?: string | null
          account_type: string
          amount: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          from_account_id?: string | null
          from_account_type?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          running_balance?: number | null
          signed_amount?: number | null
          to_account_id?: string | null
          to_account_type?: string | null
          worker_id?: string | null
        }
        Update: {
          account_id?: string | null
          account_type?: string
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          from_account_id?: string | null
          from_account_type?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          running_balance?: number | null
          signed_amount?: number | null
          to_account_id?: string | null
          to_account_type?: string | null
          worker_id?: string | null
        }
        Relationships: []
      }
      cash_movements_archive: {
        Row: {
          account_id: string | null
          account_type: string
          amount: number
          archived_at: string
          archived_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          from_account_id: string | null
          from_account_type: string | null
          id: string
          movement_type: string
          notes: string | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          running_balance: number | null
          signed_amount: number | null
          to_account_id: string | null
          to_account_type: string | null
          worker_id: string | null
        }
        Insert: {
          account_id?: string | null
          account_type: string
          amount: number
          archived_at?: string
          archived_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          from_account_id?: string | null
          from_account_type?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          running_balance?: number | null
          signed_amount?: number | null
          to_account_id?: string | null
          to_account_type?: string | null
          worker_id?: string | null
        }
        Update: {
          account_id?: string | null
          account_type?: string
          amount?: number
          archived_at?: string
          archived_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          from_account_id?: string | null
          from_account_type?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          running_balance?: number | null
          signed_amount?: number | null
          to_account_id?: string | null
          to_account_type?: string | null
          worker_id?: string | null
        }
        Relationships: []
      }
      coin_exchange_returns: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          received_by: string
          task_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          received_by: string
          task_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          received_by?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_exchange_returns_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_exchange_returns_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_exchange_returns_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "coin_exchange_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_exchange_tasks: {
        Row: {
          branch_id: string | null
          coin_amount: number
          completed_at: string | null
          created_at: string
          id: string
          manager_id: string
          notes: string | null
          remaining_amount: number | null
          returned_amount: number
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          branch_id?: string | null
          coin_amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          manager_id: string
          notes?: string | null
          remaining_amount?: number | null
          returned_amount?: number
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          branch_id?: string | null
          coin_amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          manager_id?: string
          notes?: string | null
          remaining_amount?: number | null
          returned_amount?: number
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_exchange_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_exchange_tasks_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_exchange_tasks_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_exchange_tasks_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_exchange_tasks_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_muted: boolean | null
          joined_at: string
          last_read_at: string | null
          worker_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          worker_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string
          id: string
          last_message_at: string | null
          messages: Json
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string | null
          messages?: Json
          name?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string | null
          messages?: Json
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description_ar: string | null
          id: string
          is_system: boolean | null
          name_ar: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          id?: string
          is_system?: boolean | null
          name_ar: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          id?: string
          is_system?: boolean | null
          name_ar?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_accounts: {
        Row: {
          address: string | null
          approved_at: string | null
          approved_by: string | null
          business_type: string | null
          created_at: string
          customer_id: string | null
          full_name: string
          id: string
          password_hash: string
          phone: string
          rejection_reason: string | null
          status: string
          store_name: string
          updated_at: string
          username: string
          wilaya: string | null
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_type?: string | null
          created_at?: string
          customer_id?: string | null
          full_name: string
          id?: string
          password_hash: string
          phone: string
          rejection_reason?: string | null
          status?: string
          store_name: string
          updated_at?: string
          username: string
          wilaya?: string | null
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_type?: string | null
          created_at?: string
          customer_id?: string | null
          full_name?: string
          id?: string
          password_hash?: string
          phone?: string
          rejection_reason?: string | null
          status?: string
          store_name?: string
          updated_at?: string
          username?: string
          wilaya?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_accounts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_accounts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_approval_requests: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          operation_type: string
          payload: Json
          rejection_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          operation_type: string
          payload: Json
          rejection_reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          operation_type?: string
          payload?: Json
          rejection_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_approval_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_approval_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_approval_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_approval_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credits: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          credit_type: string
          customer_id: string
          id: string
          is_used: boolean
          notes: string | null
          order_id: string | null
          product_id: string | null
          product_quantity: number | null
          product_reason: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          used_at: string | null
          used_in_order_id: string | null
          worker_id: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          credit_type?: string
          customer_id: string
          id?: string
          is_used?: boolean
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          product_quantity?: number | null
          product_reason?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          used_at?: string | null
          used_in_order_id?: string | null
          worker_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          credit_type?: string
          customer_id?: string
          id?: string
          is_used?: boolean
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          product_quantity?: number | null
          product_reason?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          used_at?: string | null
          used_in_order_id?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_used_in_order_id_fkey"
            columns: ["used_in_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_debts: {
        Row: {
          branch_id: string | null
          collection_amount: number | null
          collection_days: string[] | null
          collection_type: string | null
          created_at: string
          customer_id: string
          due_date: string | null
          id: string
          notes: string | null
          order_id: string | null
          paid_amount: number
          remaining_amount: number | null
          status: string
          total_amount: number
          updated_at: string
          worker_id: string
        }
        Insert: {
          branch_id?: string | null
          collection_amount?: number | null
          collection_days?: string[] | null
          collection_type?: string | null
          created_at?: string
          customer_id: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_amount?: number
          remaining_amount?: number | null
          status?: string
          total_amount?: number
          updated_at?: string
          worker_id: string
        }
        Update: {
          branch_id?: string | null
          collection_amount?: number | null
          collection_days?: string[] | null
          collection_type?: string | null
          created_at?: string
          customer_id?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_amount?: number
          remaining_amount?: number | null
          status?: string
          total_amount?: number
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_debts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_debts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_debts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_debts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_debts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_special_prices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          price_type: string
          product_id: string
          special_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          price_type?: string
          product_id: string
          special_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          price_type?: string
          product_id?: string
          special_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_special_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_special_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_special_prices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_special_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          customer_type: string | null
          default_delivery_worker_id: string | null
          default_payment_type: string | null
          default_price_subtype: string | null
          id: string
          internal_name: string | null
          is_registered: boolean | null
          is_trusted: boolean | null
          latitude: number | null
          location_type: string | null
          longitude: number | null
          name: string
          name_fr: string | null
          pending_changes: Json | null
          phone: string | null
          sales_rep_name: string | null
          sales_rep_phone: string | null
          sector_id: string | null
          status: string
          store_name: string | null
          store_name_fr: string | null
          trust_notes: string | null
          updated_at: string
          wilaya: string | null
          zone_id: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          default_delivery_worker_id?: string | null
          default_payment_type?: string | null
          default_price_subtype?: string | null
          id?: string
          internal_name?: string | null
          is_registered?: boolean | null
          is_trusted?: boolean | null
          latitude?: number | null
          location_type?: string | null
          longitude?: number | null
          name: string
          name_fr?: string | null
          pending_changes?: Json | null
          phone?: string | null
          sales_rep_name?: string | null
          sales_rep_phone?: string | null
          sector_id?: string | null
          status?: string
          store_name?: string | null
          store_name_fr?: string | null
          trust_notes?: string | null
          updated_at?: string
          wilaya?: string | null
          zone_id?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          default_delivery_worker_id?: string | null
          default_payment_type?: string | null
          default_price_subtype?: string | null
          id?: string
          internal_name?: string | null
          is_registered?: boolean | null
          is_trusted?: boolean | null
          latitude?: number | null
          location_type?: string | null
          longitude?: number | null
          name?: string
          name_fr?: string | null
          pending_changes?: Json | null
          phone?: string | null
          sales_rep_name?: string | null
          sales_rep_phone?: string | null
          sector_id?: string | null
          status?: string
          store_name?: string | null
          store_name_fr?: string | null
          trust_notes?: string | null
          updated_at?: string
          wilaya?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_default_delivery_worker_id_fkey"
            columns: ["default_delivery_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_default_delivery_worker_id_fkey"
            columns: ["default_delivery_worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "sector_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_collections: {
        Row: {
          action: string
          amount_collected: number
          approved_at: string | null
          approved_by: string | null
          collection_date: string
          created_at: string
          debt_id: string
          id: string
          next_due_date: string | null
          notes: string | null
          payment_method: string | null
          rejection_reason: string | null
          status: string
          worker_id: string
        }
        Insert: {
          action?: string
          amount_collected?: number
          approved_at?: string | null
          approved_by?: string | null
          collection_date?: string
          created_at?: string
          debt_id: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          payment_method?: string | null
          rejection_reason?: string | null
          status?: string
          worker_id: string
        }
        Update: {
          action?: string
          amount_collected?: number
          approved_at?: string | null
          approved_by?: string | null
          collection_date?: string
          created_at?: string
          debt_id?: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          payment_method?: string | null
          rejection_reason?: string | null
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_collections_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_collections_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_collections_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "customer_debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_collections_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_collections_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_movements: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          debt_id: string | null
          debtor_id: string
          debtor_type: string
          id: string
          movement_type: string
          notes: string | null
          payment_method: string | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          running_debt_balance: number | null
          signed_amount: number | null
          worker_id: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          debt_id?: string | null
          debtor_id: string
          debtor_type: string
          id?: string
          movement_type: string
          notes?: string | null
          payment_method?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          running_debt_balance?: number | null
          signed_amount?: number | null
          worker_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          debt_id?: string | null
          debtor_id?: string
          debtor_type?: string
          id?: string
          movement_type?: string
          notes?: string | null
          payment_method?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          running_debt_balance?: number | null
          signed_amount?: number | null
          worker_id?: string | null
        }
        Relationships: []
      }
      debt_movements_archive: {
        Row: {
          amount: number
          archived_at: string
          archived_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          debt_id: string | null
          debtor_id: string
          debtor_type: string
          id: string
          movement_type: string
          notes: string | null
          payment_method: string | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          running_debt_balance: number | null
          signed_amount: number | null
          worker_id: string | null
        }
        Insert: {
          amount: number
          archived_at?: string
          archived_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          debt_id?: string | null
          debtor_id: string
          debtor_type: string
          id?: string
          movement_type: string
          notes?: string | null
          payment_method?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          running_debt_balance?: number | null
          signed_amount?: number | null
          worker_id?: string | null
        }
        Update: {
          amount?: number
          archived_at?: string
          archived_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          debt_id?: string | null
          debtor_id?: string
          debtor_type?: string
          id?: string
          movement_type?: string
          notes?: string | null
          payment_method?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          running_debt_balance?: number | null
          signed_amount?: number | null
          worker_id?: string | null
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          collected_at: string
          created_at: string
          debt_id: string
          id: string
          notes: string | null
          payment_method: string
          worker_id: string
        }
        Insert: {
          amount: number
          collected_at?: string
          created_at?: string
          debt_id: string
          id?: string
          notes?: string | null
          payment_method?: string
          worker_id: string
        }
        Update: {
          amount?: number
          collected_at?: string
          created_at?: string
          debt_id?: string
          id?: string
          notes?: string | null
          payment_method?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "customer_debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_route_sectors: {
        Row: {
          created_at: string
          id: string
          route_id: string
          sector_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          route_id: string
          sector_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          route_id?: string
          sector_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_route_sectors_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_route_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_routes: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_routes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_routes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_routes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      document_collections: {
        Row: {
          action: string
          approved_at: string | null
          approved_by: string | null
          collection_date: string
          created_at: string
          id: string
          next_due_date: string | null
          notes: string | null
          order_id: string
          rejection_reason: string | null
          status: string
          worker_id: string
        }
        Insert: {
          action?: string
          approved_at?: string | null
          approved_by?: string | null
          collection_date?: string
          created_at?: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          order_id: string
          rejection_reason?: string | null
          status?: string
          worker_id: string
        }
        Update: {
          action?: string
          approved_at?: string | null
          approved_by?: string | null
          collection_date?: string
          created_at?: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          order_id?: string
          rejection_reason?: string | null
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_collections_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_collections_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_collections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_collections_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_collections_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_points_log: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          notes: string | null
          penalty_id: string | null
          point_date: string
          point_type: string
          points: number
          source_entity: string | null
          source_entity_id: string | null
          task_id: string | null
          worker_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          penalty_id?: string | null
          point_date?: string
          point_type?: string
          points?: number
          source_entity?: string | null
          source_entity_id?: string | null
          task_id?: string | null
          worker_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          penalty_id?: string | null
          point_date?: string
          point_type?: string
          points?: number
          source_entity?: string | null
          source_entity_id?: string | null
          task_id?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_points_log_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_points_log_penalty_id_fkey"
            columns: ["penalty_id"]
            isOneToOne: false
            referencedRelation: "reward_penalties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_points_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "reward_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_points_log_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_points_log_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          name_fr: string | null
          visible_to_roles: string[] | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          name_fr?: string | null
          visible_to_roles?: string[] | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          name_fr?: string | null
          visible_to_roles?: string[] | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string | null
          category_id: string
          created_at: string | null
          description: string | null
          expense_date: string
          id: string
          payment_method: string | null
          receipt_url: string | null
          receipt_urls: string[] | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          category_id: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          receipt_urls?: string[] | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category_id?: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          receipt_urls?: string[] | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_order_items: {
        Row: {
          created_at: string
          delivery_date: string | null
          factory_order_id: string
          id: string
          lot_number: string | null
          manufacturing_date: string | null
          manufacturing_time: string | null
          notes: string | null
          pallet_quantity: number
          product_id: string
          product_quantity: number
        }
        Insert: {
          created_at?: string
          delivery_date?: string | null
          factory_order_id: string
          id?: string
          lot_number?: string | null
          manufacturing_date?: string | null
          manufacturing_time?: string | null
          notes?: string | null
          pallet_quantity?: number
          product_id: string
          product_quantity?: number
        }
        Update: {
          created_at?: string
          delivery_date?: string | null
          factory_order_id?: string
          id?: string
          lot_number?: string | null
          manufacturing_date?: string | null
          manufacturing_time?: string | null
          notes?: string | null
          pallet_quantity?: number
          product_id?: string
          product_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "factory_order_items_factory_order_id_fkey"
            columns: ["factory_order_id"]
            isOneToOne: false
            referencedRelation: "factory_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_order_items_factory_order_id_fkey"
            columns: ["factory_order_id"]
            isOneToOne: false
            referencedRelation: "v_factory_orders_localized"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_orders: {
        Row: {
          assistant_approved_at: string | null
          assistant_approved_by: string | null
          branch_approved_at: string | null
          branch_approved_by: string | null
          branch_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          closed_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          frozen_at: string | null
          frozen_by: string | null
          id: string
          in_production_at: string | null
          linked_receipt_id: string | null
          notes: string | null
          order_type: string
          pallet_count: number | null
          ready_for_delivery_at: string | null
          reference_no: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          rejection_stage: string | null
          status: string
          system_manager_approved_at: string | null
          system_manager_approved_by: string | null
          updated_at: string
        }
        Insert: {
          assistant_approved_at?: string | null
          assistant_approved_by?: string | null
          branch_approved_at?: string | null
          branch_approved_by?: string | null
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          closed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          in_production_at?: string | null
          linked_receipt_id?: string | null
          notes?: string | null
          order_type?: string
          pallet_count?: number | null
          ready_for_delivery_at?: string | null
          reference_no?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_note?: string | null
          rejection_stage?: string | null
          status?: string
          system_manager_approved_at?: string | null
          system_manager_approved_by?: string | null
          updated_at?: string
        }
        Update: {
          assistant_approved_at?: string | null
          assistant_approved_by?: string | null
          branch_approved_at?: string | null
          branch_approved_by?: string | null
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          closed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          in_production_at?: string | null
          linked_receipt_id?: string | null
          notes?: string | null
          order_type?: string
          pallet_count?: number | null
          ready_for_delivery_at?: string | null
          reference_no?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_note?: string | null
          rejection_stage?: string | null
          status?: string
          system_manager_approved_at?: string | null
          system_manager_approved_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factory_orders_assistant_approved_by_fkey"
            columns: ["assistant_approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_assistant_approved_by_fkey"
            columns: ["assistant_approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_branch_approved_by_fkey"
            columns: ["branch_approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_branch_approved_by_fkey"
            columns: ["branch_approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_system_manager_approved_by_fkey"
            columns: ["system_manager_approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_system_manager_approved_by_fkey"
            columns: ["system_manager_approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      final_review_items: {
        Row: {
          actual_qty: number
          created_at: string
          diff_type: string
          difference: number
          expected_qty: number
          final_review_session_id: string
          id: string
          notes: string | null
          product_id: string
          reason_code: string | null
        }
        Insert: {
          actual_qty?: number
          created_at?: string
          diff_type: string
          difference?: number
          expected_qty?: number
          final_review_session_id: string
          id?: string
          notes?: string | null
          product_id: string
          reason_code?: string | null
        }
        Update: {
          actual_qty?: number
          created_at?: string
          diff_type?: string
          difference?: number
          expected_qty?: number
          final_review_session_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          reason_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "final_review_items_final_review_session_id_fkey"
            columns: ["final_review_session_id"]
            isOneToOne: false
            referencedRelation: "final_review_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_review_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      final_review_sessions: {
        Row: {
          accounting_session_id: string | null
          branch_id: string | null
          created_at: string
          deficit_count: number | null
          id: string
          locked_at: string | null
          manager_confirmed_at: string | null
          matched_count: number | null
          notes: string | null
          review_date: string
          started_at: string
          status: string
          surplus_count: number | null
          total_actual: number | null
          total_expected: number | null
          updated_at: string
          warehouse_manager_id: string
          worker_confirmed_at: string | null
          worker_id: string
        }
        Insert: {
          accounting_session_id?: string | null
          branch_id?: string | null
          created_at?: string
          deficit_count?: number | null
          id?: string
          locked_at?: string | null
          manager_confirmed_at?: string | null
          matched_count?: number | null
          notes?: string | null
          review_date?: string
          started_at?: string
          status?: string
          surplus_count?: number | null
          total_actual?: number | null
          total_expected?: number | null
          updated_at?: string
          warehouse_manager_id: string
          worker_confirmed_at?: string | null
          worker_id: string
        }
        Update: {
          accounting_session_id?: string | null
          branch_id?: string | null
          created_at?: string
          deficit_count?: number | null
          id?: string
          locked_at?: string | null
          manager_confirmed_at?: string | null
          matched_count?: number | null
          notes?: string | null
          review_date?: string
          started_at?: string
          status?: string
          surplus_count?: number | null
          total_actual?: number | null
          total_expected?: number | null
          updated_at?: string
          warehouse_manager_id?: string
          worker_confirmed_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_review_sessions_accounting_session_id_fkey"
            columns: ["accounting_session_id"]
            isOneToOne: false
            referencedRelation: "accounting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_review_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_review_sessions_warehouse_manager_id_fkey"
            columns: ["warehouse_manager_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_review_sessions_warehouse_manager_id_fkey"
            columns: ["warehouse_manager_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_review_sessions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_review_sessions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      handover_items: {
        Row: {
          amount: number
          created_at: string
          customer_name: string | null
          handover_id: string
          id: string
          notes: string | null
          order_id: string | null
          payment_method: string
          treasury_entry_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          handover_id: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method: string
          treasury_entry_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          handover_id?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string
          treasury_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handover_items_handover_id_fkey"
            columns: ["handover_id"]
            isOneToOne: false
            referencedRelation: "manager_handovers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_items_treasury_entry_id_fkey"
            columns: ["treasury_entry_id"]
            isOneToOne: false
            referencedRelation: "manager_treasury"
            referencedColumns: ["id"]
          },
        ]
      }
      loading_session_items: {
        Row: {
          created_at: string
          custom_load_note: string | null
          gift_quantity: number
          gift_unit: string | null
          id: string
          is_custom_load: boolean
          notes: string | null
          previous_quantity: number
          product_id: string
          quantity: number
          session_id: string
          surplus_quantity: number
        }
        Insert: {
          created_at?: string
          custom_load_note?: string | null
          gift_quantity?: number
          gift_unit?: string | null
          id?: string
          is_custom_load?: boolean
          notes?: string | null
          previous_quantity?: number
          product_id: string
          quantity?: number
          session_id: string
          surplus_quantity?: number
        }
        Update: {
          created_at?: string
          custom_load_note?: string | null
          gift_quantity?: number
          gift_unit?: string | null
          id?: string
          is_custom_load?: boolean
          notes?: string | null
          previous_quantity?: number
          product_id?: string
          quantity?: number
          session_id?: string
          surplus_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "loading_session_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      loading_sessions: {
        Row: {
          branch_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          manager_id: string
          notes: string | null
          status: string
          unloading_details: Json | null
          worker_id: string
        }
        Insert: {
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          manager_id: string
          notes?: string | null
          status?: string
          unloading_details?: Json | null
          worker_id: string
        }
        Update: {
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          manager_id?: string
          notes?: string | null
          status?: string
          unloading_details?: Json | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loading_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loading_sessions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loading_sessions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loading_sessions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loading_sessions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_handovers: {
        Row: {
          amount: number
          bank_account_id: string | null
          bank_transfer_reference: string | null
          branch_id: string | null
          cash_invoice1: number
          cash_invoice2: number
          check_count: number | null
          checks_amount: number
          created_at: string
          delivery_method: string
          handover_date: string
          id: string
          intermediary_name: string | null
          manager_id: string
          notes: string | null
          payment_method: string
          receipt_count: number | null
          receipt_image_url: string | null
          receipts_amount: number
          received_by: string | null
          receiver_name: string | null
          stamp_amount: number
          transfer_count: number | null
          transfers_amount: number
          unified_cash: boolean
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          bank_transfer_reference?: string | null
          branch_id?: string | null
          cash_invoice1?: number
          cash_invoice2?: number
          check_count?: number | null
          checks_amount?: number
          created_at?: string
          delivery_method?: string
          handover_date?: string
          id?: string
          intermediary_name?: string | null
          manager_id: string
          notes?: string | null
          payment_method: string
          receipt_count?: number | null
          receipt_image_url?: string | null
          receipts_amount?: number
          received_by?: string | null
          receiver_name?: string | null
          stamp_amount?: number
          transfer_count?: number | null
          transfers_amount?: number
          unified_cash?: boolean
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          bank_transfer_reference?: string | null
          branch_id?: string | null
          cash_invoice1?: number
          cash_invoice2?: number
          check_count?: number | null
          checks_amount?: number
          created_at?: string
          delivery_method?: string
          handover_date?: string
          id?: string
          intermediary_name?: string | null
          manager_id?: string
          notes?: string | null
          payment_method?: string
          receipt_count?: number | null
          receipt_image_url?: string | null
          receipts_amount?: number
          received_by?: string | null
          receiver_name?: string | null
          stamp_amount?: number
          transfer_count?: number | null
          transfers_amount?: number
          unified_cash?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "manager_handovers_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "treasury_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_handovers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_handovers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_handovers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_handovers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_handovers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_review_sessions: {
        Row: {
          branch_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          manager_id: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          status: string
        }
        Insert: {
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          manager_id: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
        }
        Update: {
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          manager_id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_review_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_review_sessions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_review_sessions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_treasury: {
        Row: {
          amount: number
          branch_id: string | null
          check_bank: string | null
          check_date: string | null
          check_number: string | null
          created_at: string
          customer_name: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          manager_id: string
          notes: string | null
          payment_method: string
          receipt_number: string | null
          session_id: string | null
          source_type: string
          transfer_reference: string | null
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          check_bank?: string | null
          check_date?: string | null
          check_number?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          manager_id: string
          notes?: string | null
          payment_method: string
          receipt_number?: string | null
          session_id?: string | null
          source_type?: string
          transfer_reference?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          check_bank?: string | null
          check_date?: string | null
          check_number?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          manager_id?: string
          notes?: string | null
          payment_method?: string
          receipt_number?: string | null
          session_id?: string | null
          source_type?: string
          transfer_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_treasury_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_treasury_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_treasury_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_treasury_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "accounting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_workers: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          manager_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          manager_id: string
          worker_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          manager_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_workers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_workers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_workers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_workers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_invoice_requests: {
        Row: {
          assistant_approved_at: string | null
          assistant_approved_by: string | null
          branch_approved_at: string | null
          branch_approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by_role: string | null
          customer_id: string
          id: string
          invoice_file_name: string | null
          invoice_file_url: string | null
          invoice_number: string | null
          invoice_scope: string | null
          invoice_uploaded_at: string | null
          invoice_uploaded_by: string | null
          is_merged_parent: boolean | null
          merged_into_request_id: string | null
          merged_request_ids: string[] | null
          notes: string | null
          order_id: string | null
          payment_method: string | null
          postponed_at: string | null
          postponed_by: string | null
          products: Json
          received_at: string | null
          received_by_assistant_at: string | null
          received_by_assistant_id: string | null
          sent_at: string
          status: string
          total_amount: number | null
          whatsapp_contact: string | null
          worker_id: string
        }
        Insert: {
          assistant_approved_at?: string | null
          assistant_approved_by?: string | null
          branch_approved_at?: string | null
          branch_approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by_role?: string | null
          customer_id: string
          id?: string
          invoice_file_name?: string | null
          invoice_file_url?: string | null
          invoice_number?: string | null
          invoice_scope?: string | null
          invoice_uploaded_at?: string | null
          invoice_uploaded_by?: string | null
          is_merged_parent?: boolean | null
          merged_into_request_id?: string | null
          merged_request_ids?: string[] | null
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          postponed_at?: string | null
          postponed_by?: string | null
          products?: Json
          received_at?: string | null
          received_by_assistant_at?: string | null
          received_by_assistant_id?: string | null
          sent_at?: string
          status?: string
          total_amount?: number | null
          whatsapp_contact?: string | null
          worker_id: string
        }
        Update: {
          assistant_approved_at?: string | null
          assistant_approved_by?: string | null
          branch_approved_at?: string | null
          branch_approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by_role?: string | null
          customer_id?: string
          id?: string
          invoice_file_name?: string | null
          invoice_file_url?: string | null
          invoice_number?: string | null
          invoice_scope?: string | null
          invoice_uploaded_at?: string | null
          invoice_uploaded_by?: string | null
          is_merged_parent?: boolean | null
          merged_into_request_id?: string | null
          merged_request_ids?: string[] | null
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          postponed_at?: string | null
          postponed_by?: string | null
          products?: Json
          received_at?: string | null
          received_by_assistant_at?: string | null
          received_by_assistant_id?: string | null
          sent_at?: string
          status?: string
          total_amount?: number | null
          whatsapp_contact?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_invoice_requests_assistant_approved_by_fkey"
            columns: ["assistant_approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoice_requests_assistant_approved_by_fkey"
            columns: ["assistant_approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoice_requests_branch_approved_by_fkey"
            columns: ["branch_approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoice_requests_branch_approved_by_fkey"
            columns: ["branch_approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoice_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoice_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoice_requests_merged_into_request_id_fkey"
            columns: ["merged_into_request_id"]
            isOneToOne: false
            referencedRelation: "manual_invoice_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoice_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoice_requests_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoice_requests_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_bonus_summary: {
        Row: {
          bonus_amount: number | null
          branch_id: string | null
          capped_amount: number | null
          created_at: string
          id: string
          month: string
          penalty_points: number
          point_value: number | null
          reward_points: number
          status: string
          total_points: number
          updated_at: string
          worker_id: string
        }
        Insert: {
          bonus_amount?: number | null
          branch_id?: string | null
          capped_amount?: number | null
          created_at?: string
          id?: string
          month: string
          penalty_points?: number
          point_value?: number | null
          reward_points?: number
          status?: string
          total_points?: number
          updated_at?: string
          worker_id: string
        }
        Update: {
          bonus_amount?: number | null
          branch_id?: string | null
          capped_amount?: number | null
          created_at?: string
          id?: string
          month?: string
          penalty_points?: number
          point_value?: number | null
          reward_points?: number
          status?: string
          total_points?: number
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_bonus_summary_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_bonus_summary_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_bonus_summary_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      navbar_preferences: {
        Row: {
          created_at: string
          id: string
          tab_paths: string[]
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tab_paths?: string[]
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tab_paths?: string[]
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "navbar_preferences_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "navbar_preferences_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_ledger: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          gift_quantity: number
          gift_quantity_unit: string | null
          id: string
          movement_type: string
          notes: string | null
          offer_id: string | null
          offer_tier_id: string | null
          product_id: string
          promo_id: string | null
          reference_id: string | null
          reference_type: string | null
          running_gift_balance: number | null
          running_sale_balance: number | null
          sale_quantity: number
          sale_quantity_unit: string | null
          signed_gift: number | null
          signed_sale: number | null
          source_session_id: string | null
          worker_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          gift_quantity?: number
          gift_quantity_unit?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          offer_id?: string | null
          offer_tier_id?: string | null
          product_id: string
          promo_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          running_gift_balance?: number | null
          running_sale_balance?: number | null
          sale_quantity?: number
          sale_quantity_unit?: string | null
          signed_gift?: number | null
          signed_sale?: number | null
          source_session_id?: string | null
          worker_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          gift_quantity?: number
          gift_quantity_unit?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          offer_id?: string | null
          offer_tier_id?: string | null
          product_id?: string
          promo_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          running_gift_balance?: number | null
          running_sale_balance?: number | null
          sale_quantity?: number
          sale_quantity_unit?: string | null
          signed_gift?: number | null
          signed_sale?: number | null
          source_session_id?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_ledger_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_offer_tier_id_fkey"
            columns: ["offer_tier_id"]
            isOneToOne: false
            referencedRelation: "product_offer_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "loading_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          new_value: string | null
          old_value: string | null
          order_id: string
          performed_by: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id: string
          performed_by?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          gift_offer_id: string | null
          gift_pieces: number
          gift_quantity: number
          id: string
          invoice_payment_method: string | null
          order_id: string
          payment_type: string | null
          pieces_per_box: number | null
          price_subtype: string | null
          pricing_unit: string | null
          product_id: string
          quantity: number
          total_price: number | null
          unit_price: number | null
          weight_per_box: number | null
        }
        Insert: {
          created_at?: string
          gift_offer_id?: string | null
          gift_pieces?: number
          gift_quantity?: number
          id?: string
          invoice_payment_method?: string | null
          order_id: string
          payment_type?: string | null
          pieces_per_box?: number | null
          price_subtype?: string | null
          pricing_unit?: string | null
          product_id: string
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
          weight_per_box?: number | null
        }
        Update: {
          created_at?: string
          gift_offer_id?: string | null
          gift_pieces?: number
          gift_quantity?: number
          id?: string
          invoice_payment_method?: string | null
          order_id?: string
          payment_type?: string | null
          pieces_per_box?: number | null
          price_subtype?: string | null
          pricing_unit?: string | null
          product_id?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
          weight_per_box?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_gift_offer_id_fkey"
            columns: ["gift_offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_worker_id: string | null
          branch_id: string | null
          check_due_date: string | null
          created_at: string
          created_by: string
          created_by_customer: string | null
          customer_id: string
          delivery_date: string | null
          doc_collection_days: string[] | null
          doc_collection_type: string | null
          doc_due_date: string | null
          document_status: string | null
          document_verification: Json | null
          id: string
          invoice_number: string | null
          invoice_payment_method: string | null
          invoice_received_at: string | null
          invoice_sent_at: string | null
          notes: string | null
          partial_amount: number | null
          payment_status: string | null
          payment_type: string | null
          postpone_count: number
          prepaid_amount: number | null
          status: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          assigned_worker_id?: string | null
          branch_id?: string | null
          check_due_date?: string | null
          created_at?: string
          created_by: string
          created_by_customer?: string | null
          customer_id: string
          delivery_date?: string | null
          doc_collection_days?: string[] | null
          doc_collection_type?: string | null
          doc_due_date?: string | null
          document_status?: string | null
          document_verification?: Json | null
          id?: string
          invoice_number?: string | null
          invoice_payment_method?: string | null
          invoice_received_at?: string | null
          invoice_sent_at?: string | null
          notes?: string | null
          partial_amount?: number | null
          payment_status?: string | null
          payment_type?: string | null
          postpone_count?: number
          prepaid_amount?: number | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          assigned_worker_id?: string | null
          branch_id?: string | null
          check_due_date?: string | null
          created_at?: string
          created_by?: string
          created_by_customer?: string | null
          customer_id?: string
          delivery_date?: string | null
          doc_collection_days?: string[] | null
          doc_collection_type?: string | null
          doc_due_date?: string | null
          document_status?: string | null
          document_verification?: Json | null
          id?: string
          invoice_number?: string | null
          invoice_payment_method?: string | null
          invoice_received_at?: string | null
          invoice_sent_at?: string | null
          notes?: string | null
          partial_amount?: number | null
          payment_status?: string | null
          payment_type?: string | null
          postpone_count?: number
          prepaid_amount?: number | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_worker_id_fkey"
            columns: ["assigned_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_assigned_worker_id_fkey"
            columns: ["assigned_worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_customer_fkey"
            columns: ["created_by_customer"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      pallet_movements: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          quantity: number
          reference_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          quantity: number
          reference_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pallet_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pallet_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pallet_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      pallet_settings: {
        Row: {
          boxes_per_layer: number
          boxes_per_pallet: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          product_id: string | null
          updated_at: string
        }
        Insert: {
          boxes_per_layer?: number
          boxes_per_pallet?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          product_id?: string | null
          updated_at?: string
        }
        Update: {
          boxes_per_layer?: number
          boxes_per_pallet?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pallet_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pallet_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pallet_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pallet_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          code: string
          created_at: string
          description_ar: string | null
          id: string
          name_ar: string
          resource: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description_ar?: string | null
          id?: string
          name_ar: string
          resource?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description_ar?: string | null
          id?: string
          name_ar?: string
          resource?: string | null
        }
        Relationships: []
      }
      pricing_groups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offer_periods: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          offer_id: string
          period_end: string
          period_start: string
          period_type: string
          sold_quantity_pieces: number
          tier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          offer_id: string
          period_end: string
          period_start: string
          period_type?: string
          sold_quantity_pieces?: number
          tier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          offer_id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          sold_quantity_pieces?: number
          tier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_offer_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_offer_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_offer_periods_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_offer_periods_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "product_offer_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offer_tiers: {
        Row: {
          conditions: Json | null
          created_at: string
          discount_amount: number | null
          discount_percentage: number | null
          discount_prices: Json | null
          gift_product_id: string | null
          gift_quantity: number
          gift_quantity_unit: string | null
          gift_type: string
          id: string
          is_stackable: boolean
          max_quantity: number | null
          min_quantity: number
          min_quantity_unit: string | null
          offer_id: string
          tier_order: number
          worker_reward_amount: number | null
          worker_reward_type: string | null
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          discount_prices?: Json | null
          gift_product_id?: string | null
          gift_quantity?: number
          gift_quantity_unit?: string | null
          gift_type?: string
          id?: string
          is_stackable?: boolean
          max_quantity?: number | null
          min_quantity?: number
          min_quantity_unit?: string | null
          offer_id: string
          tier_order?: number
          worker_reward_amount?: number | null
          worker_reward_type?: string | null
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          discount_prices?: Json | null
          gift_product_id?: string | null
          gift_quantity?: number
          gift_quantity_unit?: string | null
          gift_type?: string
          id?: string
          is_stackable?: boolean
          max_quantity?: number | null
          min_quantity?: number
          min_quantity_unit?: string | null
          offer_id?: string
          tier_order?: number
          worker_reward_amount?: number | null
          worker_reward_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_offer_tiers_gift_product_id_fkey"
            columns: ["gift_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_offer_tiers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offers: {
        Row: {
          branch_id: string | null
          condition_type: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_amount: number | null
          discount_percentage: number | null
          discount_prices: Json | null
          end_date: string | null
          gift_product_id: string | null
          gift_quantity: number
          gift_quantity_unit: string | null
          gift_type: string
          id: string
          is_active: boolean
          is_auto_apply: boolean
          is_stackable: boolean
          max_quantity: number | null
          min_quantity: number
          min_quantity_unit: string | null
          name: string
          priority: number
          product_id: string
          start_date: string | null
          updated_at: string
          worker_reward_amount: number | null
          worker_reward_type: string | null
        }
        Insert: {
          branch_id?: string | null
          condition_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          discount_prices?: Json | null
          end_date?: string | null
          gift_product_id?: string | null
          gift_quantity?: number
          gift_quantity_unit?: string | null
          gift_type?: string
          id?: string
          is_active?: boolean
          is_auto_apply?: boolean
          is_stackable?: boolean
          max_quantity?: number | null
          min_quantity?: number
          min_quantity_unit?: string | null
          name: string
          priority?: number
          product_id: string
          start_date?: string | null
          updated_at?: string
          worker_reward_amount?: number | null
          worker_reward_type?: string | null
        }
        Update: {
          branch_id?: string | null
          condition_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          discount_prices?: Json | null
          end_date?: string | null
          gift_product_id?: string | null
          gift_quantity?: number
          gift_quantity_unit?: string | null
          gift_type?: string
          id?: string
          is_active?: boolean
          is_auto_apply?: boolean
          is_stackable?: boolean
          max_quantity?: number | null
          min_quantity?: number
          min_quantity_unit?: string | null
          name?: string
          priority?: number
          product_id?: string
          start_date?: string | null
          updated_at?: string
          worker_reward_amount?: number | null
          worker_reward_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_offers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_offers_gift_product_id_fkey"
            columns: ["gift_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "pricing_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_shortage_tracking: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_id: string
          id: string
          marked_by: string
          notes: string | null
          order_id: string | null
          product_id: string
          quantity_needed: number
          resolved_at: string | null
          status: string
          worker_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          marked_by: string
          notes?: string | null
          order_id?: string | null
          product_id: string
          quantity_needed?: number
          resolved_at?: string | null
          status?: string
          worker_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          marked_by?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string
          quantity_needed?: number
          resolved_at?: string | null
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_shortage_tracking_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shortage_tracking_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shortage_tracking_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shortage_tracking_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shortage_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shortage_tracking_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shortage_tracking_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shortage_tracking_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_invoice_sale: boolean
          allow_invoice2_sale: boolean
          allow_unit_sale: boolean
          app_name: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          pieces_per_box: number
          price_gros: number | null
          price_invoice: number | null
          price_invoice_official: number | null
          price_no_invoice: number | null
          price_retail: number | null
          price_super_gros: number | null
          pricing_unit: string
          product_code: string | null
          sort_order: number | null
          supplier_id: string | null
          weight_per_box: number | null
        }
        Insert: {
          allow_invoice_sale?: boolean
          allow_invoice2_sale?: boolean
          allow_unit_sale?: boolean
          app_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          pieces_per_box?: number
          price_gros?: number | null
          price_invoice?: number | null
          price_invoice_official?: number | null
          price_no_invoice?: number | null
          price_retail?: number | null
          price_super_gros?: number | null
          pricing_unit?: string
          product_code?: string | null
          sort_order?: number | null
          supplier_id?: string | null
          weight_per_box?: number | null
        }
        Update: {
          allow_invoice_sale?: boolean
          allow_invoice2_sale?: boolean
          allow_unit_sale?: boolean
          app_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          pieces_per_box?: number
          price_gros?: number | null
          price_invoice?: number | null
          price_invoice_official?: number | null
          price_no_invoice?: number | null
          price_retail?: number | null
          price_super_gros?: number | null
          pricing_unit?: string
          product_code?: string | null
          sort_order?: number | null
          supplier_id?: string | null
          weight_per_box?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_split_customers: {
        Row: {
          allocated_quantity: number
          created_at: string
          customer_id: string
          delivered_quantity: number
          gift_delivered: boolean
          gift_share: number
          id: string
          notes: string | null
          split_id: string
          updated_at: string
        }
        Insert: {
          allocated_quantity?: number
          created_at?: string
          customer_id: string
          delivered_quantity?: number
          gift_delivered?: boolean
          gift_share?: number
          id?: string
          notes?: string | null
          split_id: string
          updated_at?: string
        }
        Update: {
          allocated_quantity?: number
          created_at?: string
          customer_id?: string
          delivered_quantity?: number
          gift_delivered?: boolean
          gift_share?: number
          id?: string
          notes?: string | null
          split_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_split_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_split_customers_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "promo_splits"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_split_installments: {
        Row: {
          actual_quantity: number
          created_at: string
          id: string
          notes: string | null
          planned_quantity: number
          scheduled_date: string
          split_customer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_quantity?: number
          created_at?: string
          id?: string
          notes?: string | null
          planned_quantity?: number
          scheduled_date: string
          split_customer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_quantity?: number
          created_at?: string
          id?: string
          notes?: string | null
          planned_quantity?: number
          scheduled_date?: string
          split_customer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_split_installments_split_customer_id_fkey"
            columns: ["split_customer_id"]
            isOneToOne: false
            referencedRelation: "promo_split_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_splits: {
        Row: {
          adjusted_gift_quantity: number | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          gift_product_id: string | null
          gift_quantity: number
          gift_quantity_unit: string
          id: string
          name: string
          notes: string | null
          offer_id: string | null
          product_id: string
          split_type: string
          status: string
          target_quantity: number
          target_quantity_unit: string
          updated_at: string
        }
        Insert: {
          adjusted_gift_quantity?: number | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          gift_product_id?: string | null
          gift_quantity?: number
          gift_quantity_unit?: string
          id?: string
          name: string
          notes?: string | null
          offer_id?: string | null
          product_id: string
          split_type?: string
          status?: string
          target_quantity?: number
          target_quantity_unit?: string
          updated_at?: string
        }
        Update: {
          adjusted_gift_quantity?: number | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          gift_product_id?: string | null
          gift_quantity?: number
          gift_quantity_unit?: string
          id?: string
          name?: string
          notes?: string | null
          offer_id?: string | null
          product_id?: string
          split_type?: string
          status?: string
          target_quantity?: number
          target_quantity_unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_splits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_splits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_splits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_splits_gift_product_id_fkey"
            columns: ["gift_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_splits_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_splits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      promos: {
        Row: {
          bonus_amount: number | null
          created_at: string
          customer_id: string
          gift_quantity_unit: string
          gratuite_quantity: number
          has_bonus: boolean | null
          id: string
          notes: string | null
          offer_detail: string | null
          offer_id: string | null
          offer_tier_id: string | null
          product_id: string
          promo_date: string
          sale_quantity_unit: string | null
          vente_quantity: number
          worker_id: string
        }
        Insert: {
          bonus_amount?: number | null
          created_at?: string
          customer_id: string
          gift_quantity_unit?: string
          gratuite_quantity?: number
          has_bonus?: boolean | null
          id?: string
          notes?: string | null
          offer_detail?: string | null
          offer_id?: string | null
          offer_tier_id?: string | null
          product_id: string
          promo_date?: string
          sale_quantity_unit?: string | null
          vente_quantity: number
          worker_id: string
        }
        Update: {
          bonus_amount?: number | null
          created_at?: string
          customer_id?: string
          gift_quantity_unit?: string
          gratuite_quantity?: number
          has_bonus?: boolean | null
          id?: string
          notes?: string | null
          offer_detail?: string | null
          offer_id?: string | null
          offer_tier_id?: string | null
          product_id?: string
          promo_date?: string
          sale_quantity_unit?: string | null
          vente_quantity?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promos_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promos_offer_tier_id_fkey"
            columns: ["offer_tier_id"]
            isOneToOne: false
            referencedRelation: "product_offer_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promos_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promos_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      quantity_price_tiers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          max_quantity: number | null
          min_quantity: number
          notes: string | null
          price_type: string
          product_id: string
          tier_price: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          max_quantity?: number | null
          min_quantity: number
          notes?: string | null
          price_type?: string
          product_id: string
          tier_price: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          notes?: string | null
          price_type?: string
          product_id?: string
          tier_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quantity_price_tiers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quantity_price_tiers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quantity_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_modifications: {
        Row: {
          changes_summary: string | null
          created_at: string
          id: string
          is_reviewed: boolean
          modification_type: string
          modified_by: string
          modified_data: Json
          original_data: Json
          receipt_id: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          changes_summary?: string | null
          created_at?: string
          id?: string
          is_reviewed?: boolean
          modification_type?: string
          modified_by: string
          modified_data: Json
          original_data: Json
          receipt_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          changes_summary?: string | null
          created_at?: string
          id?: string
          is_reviewed?: boolean
          modification_type?: string
          modified_by?: string
          modified_data?: Json
          original_data?: Json
          receipt_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_modifications_modified_by_fkey"
            columns: ["modified_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_modifications_modified_by_fkey"
            columns: ["modified_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_modifications_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_modifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_modifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_id: string
          customer_name: string
          customer_phone: string | null
          debt_id: string | null
          discount_amount: number
          id: string
          is_modified: boolean
          items: Json
          last_printed_at: string | null
          notes: string | null
          order_id: string | null
          original_data: Json | null
          paid_amount: number
          payment_method: string | null
          print_count: number
          receipt_number: number
          receipt_type: string
          remaining_amount: number
          total_amount: number
          updated_at: string
          worker_id: string
          worker_name: string
          worker_phone: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_id: string
          customer_name: string
          customer_phone?: string | null
          debt_id?: string | null
          discount_amount?: number
          id?: string
          is_modified?: boolean
          items?: Json
          last_printed_at?: string | null
          notes?: string | null
          order_id?: string | null
          original_data?: Json | null
          paid_amount?: number
          payment_method?: string | null
          print_count?: number
          receipt_number?: number
          receipt_type?: string
          remaining_amount?: number
          total_amount?: number
          updated_at?: string
          worker_id: string
          worker_name: string
          worker_phone?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string
          customer_name?: string
          customer_phone?: string | null
          debt_id?: string | null
          discount_amount?: number
          id?: string
          is_modified?: boolean
          items?: Json
          last_printed_at?: string | null
          notes?: string | null
          order_id?: string | null
          original_data?: Json | null
          paid_amount?: number
          payment_method?: string | null
          print_count?: number
          receipt_number?: number
          receipt_type?: string
          remaining_amount?: number
          total_amount?: number
          updated_at?: string
          worker_id?: string
          worker_name?: string
          worker_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "customer_debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_config: {
        Row: {
          auto_percentage: number
          branch_id: string | null
          competition_percentage: number
          created_at: string
          id: string
          is_active: boolean
          minimum_threshold: number
          monthly_budget: number
          point_value: number
          reserve_percentage: number
          top1_bonus_pct: number
          top2_bonus_pct: number
          top3_bonus_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_percentage?: number
          branch_id?: string | null
          competition_percentage?: number
          created_at?: string
          id?: string
          is_active?: boolean
          minimum_threshold?: number
          monthly_budget?: number
          point_value?: number
          reserve_percentage?: number
          top1_bonus_pct?: number
          top2_bonus_pct?: number
          top3_bonus_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_percentage?: number
          branch_id?: string | null
          competition_percentage?: number
          created_at?: string
          id?: string
          is_active?: boolean
          minimum_threshold?: number
          monthly_budget?: number
          point_value?: number
          reserve_percentage?: number
          top1_bonus_pct?: number
          top2_bonus_pct?: number
          top3_bonus_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_config_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_disputes: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          points_log_id: string
          reason: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          worker_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          points_log_id: string
          reason: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          worker_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          points_log_id?: string
          reason?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_disputes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_disputes_points_log_id_fkey"
            columns: ["points_log_id"]
            isOneToOne: false
            referencedRelation: "employee_points_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_disputes_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_disputes_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_disputes_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_disputes_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_notifications: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          notification_type: string
          related_entity_id: string | null
          target_worker_id: string
          title: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type: string
          related_entity_id?: string | null
          target_worker_id: string
          title: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type?: string
          related_entity_id?: string | null
          target_worker_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_notifications_target_worker_id_fkey"
            columns: ["target_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_notifications_target_worker_id_fkey"
            columns: ["target_worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_penalties: {
        Row: {
          applicable_roles: string[] | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_automatic: boolean
          name: string
          name_fr: string | null
          penalty_points: number
          trigger_event: string | null
        }
        Insert: {
          applicable_roles?: string[] | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_automatic?: boolean
          name: string
          name_fr?: string | null
          penalty_points?: number
          trigger_event?: string | null
        }
        Update: {
          applicable_roles?: string[] | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_automatic?: boolean
          name?: string
          name_fr?: string | null
          penalty_points?: number
          trigger_event?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_penalties_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_penalties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_penalties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_reserve_fund: {
        Row: {
          branch_id: string | null
          carried_balance: number
          created_at: string
          id: string
          month: string
          notes: string | null
          surplus_added: number
          updated_at: string
          used_amount: number
        }
        Insert: {
          branch_id?: string | null
          carried_balance?: number
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          surplus_added?: number
          updated_at?: string
          used_amount?: number
        }
        Update: {
          branch_id?: string | null
          carried_balance?: number
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
          surplus_added?: number
          updated_at?: string
          used_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "reward_reserve_fund_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_tasks: {
        Row: {
          applicable_roles: string[] | null
          branch_id: string | null
          category: string
          condition_logic: Json
          created_at: string
          created_by: string | null
          data_source: string
          frequency: string
          id: string
          is_active: boolean
          is_cumulative: boolean
          name: string
          name_fr: string | null
          penalty_points: number
          reward_points: number
          updated_at: string
        }
        Insert: {
          applicable_roles?: string[] | null
          branch_id?: string | null
          category?: string
          condition_logic?: Json
          created_at?: string
          created_by?: string | null
          data_source?: string
          frequency?: string
          id?: string
          is_active?: boolean
          is_cumulative?: boolean
          name: string
          name_fr?: string | null
          penalty_points?: number
          reward_points?: number
          updated_at?: string
        }
        Update: {
          applicable_roles?: string[] | null
          branch_id?: string | null
          category?: string
          condition_logic?: Json
          created_at?: string
          created_by?: string | null
          data_source?: string
          frequency?: string
          id?: string
          is_active?: boolean
          is_cumulative?: boolean
          name?: string
          name_fr?: string | null
          penalty_points?: number
          reward_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_ui_overrides: {
        Row: {
          created_at: string
          element_key: string
          element_type: string
          id: string
          is_hidden: boolean
          role_id: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          element_key: string
          element_type: string
          id?: string
          is_hidden?: boolean
          role_id: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          element_key?: string
          element_type?: string
          id?: string
          is_hidden?: boolean
          role_id?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_ui_overrides_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_ui_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_ui_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_coverage: {
        Row: {
          absent_worker_id: string
          approval_notes: string | null
          approval_status: string
          branch_id: string | null
          coverage_mode: string
          coverage_type: string
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          is_active: boolean
          manager_approved_at: string | null
          manager_approved_by: string | null
          reason: string | null
          schedule_type: string
          sector_id: string
          start_date: string
          substitute_worker_id: string
          system_approved_at: string | null
          system_approved_by: string | null
          updated_at: string
        }
        Insert: {
          absent_worker_id: string
          approval_notes?: string | null
          approval_status?: string
          branch_id?: string | null
          coverage_mode?: string
          coverage_type?: string
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          reason?: string | null
          schedule_type?: string
          sector_id: string
          start_date: string
          substitute_worker_id: string
          system_approved_at?: string | null
          system_approved_by?: string | null
          updated_at?: string
        }
        Update: {
          absent_worker_id?: string
          approval_notes?: string | null
          approval_status?: string
          branch_id?: string | null
          coverage_mode?: string
          coverage_type?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          reason?: string | null
          schedule_type?: string
          sector_id?: string
          start_date?: string
          substitute_worker_id?: string
          system_approved_at?: string | null
          system_approved_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_coverage_absent_worker_id_fkey"
            columns: ["absent_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_coverage_absent_worker_id_fkey"
            columns: ["absent_worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_coverage_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_coverage_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_coverage_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_coverage_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_coverage_substitute_worker_id_fkey"
            columns: ["substitute_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_coverage_substitute_worker_id_fkey"
            columns: ["substitute_worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_schedule_overrides: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_permanent: boolean
          new_day: string
          original_day: string
          sector_id: string
          week_start: string
          worker_id: string
          worker_type: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_permanent?: boolean
          new_day: string
          original_day: string
          sector_id: string
          week_start: string
          worker_id: string
          worker_type: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_permanent?: boolean
          new_day?: string
          original_day?: string
          sector_id?: string
          week_start?: string
          worker_id?: string
          worker_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_schedule_overrides_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_schedule_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_schedule_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_schedule_overrides_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_schedule_overrides_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_schedule_overrides_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_schedules: {
        Row: {
          created_at: string
          day: string
          id: string
          schedule_type: string
          sector_id: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          schedule_type: string
          sector_id: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          schedule_type?: string
          sector_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sector_schedules_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_schedules_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_schedules_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_zones: {
        Row: {
          created_at: string
          id: string
          name: string
          name_fr: string | null
          sector_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_fr?: string | null
          sector_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_fr?: string | null
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_zones_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          delivery_worker_id: string | null
          id: string
          name: string
          name_fr: string | null
          sales_worker_id: string | null
          sector_type: string
          updated_at: string
          visit_day_delivery: string | null
          visit_day_sales: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_worker_id?: string | null
          id?: string
          name: string
          name_fr?: string | null
          sales_worker_id?: string | null
          sector_type?: string
          updated_at?: string
          visit_day_delivery?: string | null
          visit_day_sales?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_worker_id?: string | null
          id?: string
          name?: string
          name_fr?: string | null
          sales_worker_id?: string | null
          sector_type?: string
          updated_at?: string
          visit_day_delivery?: string | null
          visit_day_sales?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sectors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sectors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sectors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sectors_delivery_worker_id_fkey"
            columns: ["delivery_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sectors_delivery_worker_id_fkey"
            columns: ["delivery_worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sectors_sales_worker_id_fkey"
            columns: ["sales_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sectors_sales_worker_id_fkey"
            columns: ["sales_worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          key: string
          updated_at: string
          value: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_invoices: {
        Row: {
          created_at: string
          customer_name: string
          downloaded_at: string | null
          downloaded_by: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          pdf_path: string
          pdf_url: string
          printed_at: string | null
          target_branch_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          customer_name: string
          downloaded_at?: string | null
          downloaded_by?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          pdf_path: string
          pdf_url: string
          printed_at?: string | null
          target_branch_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string
          downloaded_at?: string | null
          downloaded_by?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          pdf_path?: string
          pdf_url?: string
          printed_at?: string | null
          target_branch_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_invoices_downloaded_by_fkey"
            columns: ["downloaded_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_invoices_downloaded_by_fkey"
            columns: ["downloaded_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_invoices_target_branch_id_fkey"
            columns: ["target_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_invoices_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_invoices_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_price_tiers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          max_amount: number | null
          min_amount: number
          notes: string | null
          percentage: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount: number
          notes?: string | null
          percentage?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number
          notes?: string | null
          percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "stamp_price_tiers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamp_price_tiers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          min_quantity: number
          product_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_quantity?: number
          product_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_quantity?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_confirmations: {
        Row: {
          amendment_note: string | null
          branch_id: string | null
          created_at: string
          frozen_at: string | null
          frozen_by: string | null
          id: string
          items: Json
          manager_id: string
          operation_type: string
          parent_confirmation_id: string | null
          previous_items: Json | null
          rejection_note: string | null
          responded_at: string | null
          source_session_id: string | null
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          amendment_note?: string | null
          branch_id?: string | null
          created_at?: string
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          items?: Json
          manager_id: string
          operation_type: string
          parent_confirmation_id?: string | null
          previous_items?: Json | null
          rejection_note?: string | null
          responded_at?: string | null
          source_session_id?: string | null
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          amendment_note?: string | null
          branch_id?: string | null
          created_at?: string
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          items?: Json
          manager_id?: string
          operation_type?: string
          parent_confirmation_id?: string | null
          previous_items?: Json | null
          rejection_note?: string | null
          responded_at?: string | null
          source_session_id?: string | null
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_confirmations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_confirmations_frozen_by_fkey"
            columns: ["frozen_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_confirmations_frozen_by_fkey"
            columns: ["frozen_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_confirmations_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_confirmations_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_confirmations_parent_confirmation_id_fkey"
            columns: ["parent_confirmation_id"]
            isOneToOne: false
            referencedRelation: "stock_confirmations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_confirmations_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_confirmations_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_discrepancies: {
        Row: {
          accounting_session_id: string | null
          branch_id: string | null
          created_at: string
          discrepancy_type: string
          final_review_session_id: string | null
          id: string
          notes: string | null
          price_per_unit: number | null
          pricing_method: string | null
          product_id: string
          quantity: number
          reason_code: string | null
          remaining_quantity: number
          resolved_at: string | null
          resolved_by: string | null
          source_session_id: string | null
          status: string
          total_value: number | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          accounting_session_id?: string | null
          branch_id?: string | null
          created_at?: string
          discrepancy_type: string
          final_review_session_id?: string | null
          id?: string
          notes?: string | null
          price_per_unit?: number | null
          pricing_method?: string | null
          product_id: string
          quantity?: number
          reason_code?: string | null
          remaining_quantity?: number
          resolved_at?: string | null
          resolved_by?: string | null
          source_session_id?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          accounting_session_id?: string | null
          branch_id?: string | null
          created_at?: string
          discrepancy_type?: string
          final_review_session_id?: string | null
          id?: string
          notes?: string | null
          price_per_unit?: number | null
          pricing_method?: string | null
          product_id?: string
          quantity?: number
          reason_code?: string | null
          remaining_quantity?: number
          resolved_at?: string | null
          resolved_by?: string | null
          source_session_id?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_discrepancies_final_review_session_id_fkey"
            columns: ["final_review_session_id"]
            isOneToOne: false
            referencedRelation: "final_review_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_disputes: {
        Row: {
          branch_id: string | null
          created_at: string
          delivery_qty: number
          delivery_worker_id: string
          guilty_accepted: boolean | null
          guilty_accepted_at: string | null
          guilty_worker_id: string | null
          id: string
          notes: string | null
          product_id: string | null
          product_name: string | null
          raised_by: string
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          session_type: string
          status: string
          updated_at: string
          warehouse_qty: number
          warehouse_worker_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          delivery_qty?: number
          delivery_worker_id: string
          guilty_accepted?: boolean | null
          guilty_accepted_at?: string | null
          guilty_worker_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          raised_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          session_type?: string
          status?: string
          updated_at?: string
          warehouse_qty?: number
          warehouse_worker_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          delivery_qty?: number
          delivery_worker_id?: string
          guilty_accepted?: boolean | null
          guilty_accepted_at?: string | null
          guilty_worker_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          raised_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          session_type?: string
          status?: string
          updated_at?: string
          warehouse_qty?: number
          warehouse_worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_disputes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_disputes_delivery_worker_id_fkey"
            columns: ["delivery_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_disputes_delivery_worker_id_fkey"
            columns: ["delivery_worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_disputes_guilty_worker_id_fkey"
            columns: ["guilty_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_disputes_guilty_worker_id_fkey"
            columns: ["guilty_worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_disputes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_disputes_warehouse_worker_id_fkey"
            columns: ["warehouse_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_disputes_warehouse_worker_id_fkey"
            columns: ["warehouse_worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string
          from_location_id: string | null
          from_location_type: string | null
          id: string
          movement_type: string
          notes: string | null
          order_id: string | null
          product_id: string
          quantity: number
          reason: string | null
          receipt_id: string | null
          reference_id: string | null
          reference_type: string | null
          return_reason: string | null
          running_balance: number | null
          signed_quantity: number | null
          status: string
          to_location_id: string | null
          to_location_type: string | null
          worker_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by: string
          from_location_id?: string | null
          from_location_type?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          order_id?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          receipt_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          return_reason?: string | null
          running_balance?: number | null
          signed_quantity?: number | null
          status?: string
          to_location_id?: string | null
          to_location_type?: string | null
          worker_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string
          from_location_id?: string | null
          from_location_type?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          receipt_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          return_reason?: string | null
          running_balance?: number | null
          signed_quantity?: number | null
          status?: string
          to_location_id?: string | null
          to_location_type?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "stock_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements_archive: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          archived_at: string
          archived_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string
          from_location_id: string | null
          from_location_type: string | null
          id: string
          movement_type: string
          notes: string | null
          order_id: string | null
          product_id: string
          quantity: number
          reason: string | null
          receipt_id: string | null
          reference_id: string | null
          reference_type: string | null
          return_reason: string | null
          running_balance: number | null
          signed_quantity: number | null
          status: string
          to_location_id: string | null
          to_location_type: string | null
          worker_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string
          archived_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by: string
          from_location_id?: string | null
          from_location_type?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          order_id?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          receipt_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          return_reason?: string | null
          running_balance?: number | null
          signed_quantity?: number | null
          status?: string
          to_location_id?: string | null
          to_location_type?: string | null
          worker_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string
          archived_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string
          from_location_id?: string | null
          from_location_type?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          receipt_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          return_reason?: string | null
          running_balance?: number | null
          signed_quantity?: number | null
          status?: string
          to_location_id?: string | null
          to_location_type?: string | null
          worker_id?: string | null
        }
        Relationships: []
      }
      stock_receipt_items: {
        Row: {
          created_at: string
          delivery_date: string | null
          id: string
          lot_number: string | null
          manufacturing_date: string | null
          manufacturing_time: string | null
          notes: string | null
          pallet_quantity: number
          product_id: string
          quantity: number
          receipt_id: string
        }
        Insert: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          lot_number?: string | null
          manufacturing_date?: string | null
          manufacturing_time?: string | null
          notes?: string | null
          pallet_quantity?: number
          product_id: string
          quantity: number
          receipt_id: string
        }
        Update: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          lot_number?: string | null
          manufacturing_date?: string | null
          manufacturing_time?: string | null
          notes?: string | null
          pallet_quantity?: number
          product_id?: string
          quantity?: number
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "stock_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_receipts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assistant_approved_at: string | null
          assistant_approved_by: string | null
          branch_approved_at: string | null
          branch_approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string
          expenses_breakdown: Json
          expenses_description: string | null
          frozen_at: string | null
          frozen_by: string | null
          id: string
          invoice_number: string | null
          invoice_photo_url: string | null
          linked_delivery_id: string | null
          notes: string | null
          pallet_count: number
          receipt_date: string
          receipt_expenses: number
          rejection_note: string | null
          status: string
          total_items: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assistant_approved_at?: string | null
          assistant_approved_by?: string | null
          branch_approved_at?: string | null
          branch_approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by: string
          expenses_breakdown?: Json
          expenses_description?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          invoice_number?: string | null
          invoice_photo_url?: string | null
          linked_delivery_id?: string | null
          notes?: string | null
          pallet_count?: number
          receipt_date?: string
          receipt_expenses?: number
          rejection_note?: string | null
          status?: string
          total_items?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assistant_approved_at?: string | null
          assistant_approved_by?: string | null
          branch_approved_at?: string | null
          branch_approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string
          expenses_breakdown?: Json
          expenses_description?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          invoice_number?: string | null
          invoice_photo_url?: string | null
          linked_delivery_id?: string | null
          notes?: string | null
          pallet_count?: number
          receipt_date?: string
          receipt_expenses?: number
          rejection_note?: string | null
          status?: string
          total_items?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_receipts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_assistant_approved_by_fkey"
            columns: ["assistant_approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_assistant_approved_by_fkey"
            columns: ["assistant_approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_branch_approved_by_fkey"
            columns: ["branch_approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_branch_approved_by_fkey"
            columns: ["branch_approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_workflow_definitions: {
        Row: {
          allowed_custom_role_codes: string[]
          allowed_roles: string[]
          created_at: string
          description: string | null
          document_type: string
          from_status: string
          id: string
          is_active: boolean
          is_rejection: boolean
          is_terminal: boolean
          requires_reason: boolean
          sort_order: number
          to_status: string
          updated_at: string
        }
        Insert: {
          allowed_custom_role_codes?: string[]
          allowed_roles?: string[]
          created_at?: string
          description?: string | null
          document_type: string
          from_status: string
          id?: string
          is_active?: boolean
          is_rejection?: boolean
          is_terminal?: boolean
          requires_reason?: boolean
          sort_order?: number
          to_status: string
          updated_at?: string
        }
        Update: {
          allowed_custom_role_codes?: string[]
          allowed_roles?: string[]
          created_at?: string
          description?: string | null
          document_type?: string
          from_status?: string
          id?: string
          is_active?: boolean
          is_rejection?: boolean
          is_terminal?: boolean
          requires_reason?: boolean
          sort_order?: number
          to_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_workflow_status_labels: {
        Row: {
          category: string
          color: string
          created_at: string
          description: string | null
          document_type: string
          icon: string | null
          id: string
          is_active: boolean
          label: string
          locale: string
          sort_order: number
          status_code: string
          updated_at: string
        }
        Insert: {
          category?: string
          color?: string
          created_at?: string
          description?: string | null
          document_type: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label: string
          locale?: string
          sort_order?: number
          status_code: string
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          description?: string | null
          document_type?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label?: string
          locale?: string
          sort_order?: number
          status_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_workflow_transitions: {
        Row: {
          branch_id: string | null
          created_at: string
          document_id: string
          document_type: string
          from_status: string | null
          id: string
          metadata: Json | null
          notes: string | null
          performed_by: string | null
          performed_custom_role: string | null
          performed_role: Database["public"]["Enums"]["app_role"] | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          to_status: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          document_id: string
          document_type: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          performed_by?: string | null
          performed_custom_role?: string | null
          performed_role?: Database["public"]["Enums"]["app_role"] | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          to_status: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          document_id?: string
          document_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          performed_by?: string | null
          performed_custom_role?: string | null
          performed_role?: Database["public"]["Enums"]["app_role"] | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_workflow_transitions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_workflow_transitions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_workflow_transitions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_workers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          supervisor_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          supervisor_id: string
          worker_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          supervisor_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_workers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_workers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_workers_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_workers_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          branch_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      test_55555555520262026: {
        Row: {
          id: string
        }
        Insert: {
          id?: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      treasury_bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          bank_name: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          account_holder: string
          account_number: string
          bank_name: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
        }
        Update: {
          account_holder?: string
          account_number?: string
          bank_name?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "treasury_bank_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_bank_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_bank_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_contacts: {
        Row: {
          branch_id: string | null
          contact_type: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          name_fr: string | null
          phone: string | null
        }
        Insert: {
          branch_id?: string | null
          contact_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_fr?: string | null
          phone?: string | null
        }
        Update: {
          branch_id?: string | null
          contact_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_fr?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_contacts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          worker_id: string | null
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          worker_id?: string | null
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_checklist_items: {
        Row: {
          branch_id: string | null
          company_info_template: string | null
          created_at: string
          created_by: string | null
          document_type: string
          field_type: string
          group_title: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
          uses_company_info: boolean
        }
        Insert: {
          branch_id?: string | null
          company_info_template?: string | null
          created_at?: string
          created_by?: string | null
          document_type: string
          field_type?: string
          group_title: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          uses_company_info?: boolean
        }
        Update: {
          branch_id?: string | null
          company_info_template?: string | null
          created_at?: string
          created_by?: string | null
          document_type?: string
          field_type?: string
          group_title?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          uses_company_info?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "verification_checklist_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_checklist_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_checklist_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_tracking: {
        Row: {
          accuracy: number | null
          address: string | null
          branch_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          operation_id: string | null
          operation_type: string
          worker_id: string
        }
        Insert: {
          accuracy?: number | null
          address?: string | null
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          operation_id?: string | null
          operation_type: string
          worker_id: string
        }
        Update: {
          accuracy?: number | null
          address?: string | null
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          operation_id?: string | null
          operation_type?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_tracking_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_tracking_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_tracking_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_tracking_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_review_items: {
        Row: {
          actual_quantity: number
          boxes_quantity: number
          created_at: string
          damaged_quantity: number
          difference: number | null
          expected_quantity: number
          hall_quantity: number
          id: string
          item_type: string
          notes: string | null
          pieces_quantity: number
          product_id: string | null
          session_id: string
          status: string
        }
        Insert: {
          actual_quantity?: number
          boxes_quantity?: number
          created_at?: string
          damaged_quantity?: number
          difference?: number | null
          expected_quantity?: number
          hall_quantity?: number
          id?: string
          item_type?: string
          notes?: string | null
          pieces_quantity?: number
          product_id?: string | null
          session_id: string
          status?: string
        }
        Update: {
          actual_quantity?: number
          boxes_quantity?: number
          created_at?: string
          damaged_quantity?: number
          difference?: number | null
          expected_quantity?: number
          hall_quantity?: number
          id?: string
          item_type?: string
          notes?: string | null
          pieces_quantity?: number
          product_id?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_review_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_review_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "warehouse_review_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_review_sessions: {
        Row: {
          branch_id: string
          completed_at: string | null
          created_at: string
          id: string
          include_damaged: boolean | null
          include_pallets: boolean | null
          notes: string | null
          reviewer_id: string
          status: string
          total_discrepancies: number | null
          total_products: number | null
        }
        Insert: {
          branch_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          include_damaged?: boolean | null
          include_pallets?: boolean | null
          notes?: string | null
          reviewer_id: string
          status?: string
          total_discrepancies?: number | null
          total_products?: number | null
        }
        Update: {
          branch_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          include_damaged?: boolean | null
          include_pallets?: boolean | null
          notes?: string | null
          reviewer_id?: string
          status?: string
          total_discrepancies?: number | null
          total_products?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_review_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_review_sessions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_review_sessions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_stock: {
        Row: {
          branch_id: string
          compensation_quantity: number
          damaged_quantity: number
          factory_return_quantity: number
          id: string
          pallet_quantity: number
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          compensation_quantity?: number
          damaged_quantity?: number
          factory_return_quantity?: number
          id?: string
          pallet_quantity?: number
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          compensation_quantity?: number
          damaged_quantity?: number
          factory_return_quantity?: number
          id?: string
          pallet_quantity?: number
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_attendance: {
        Row: {
          attendance_date: string
          branch_id: string | null
          clock_in_at: string | null
          clock_in_latitude: number | null
          clock_in_longitude: number | null
          clock_out_at: string | null
          clock_out_latitude: number | null
          clock_out_longitude: number | null
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          attendance_date?: string
          branch_id?: string | null
          clock_in_at?: string | null
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_out_at?: string | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          attendance_date?: string
          branch_id?: string | null
          clock_in_at?: string | null
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_out_at?: string | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_attendance_locations: {
        Row: {
          created_at: string
          id: string
          label: string | null
          latitude: number
          longitude: number
          max_distance_meters: number
          set_by: string | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          latitude: number
          longitude: number
          max_distance_meters?: number
          set_by?: string | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          latitude?: number
          longitude?: number
          max_distance_meters?: number
          set_by?: string | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_attendance_locations_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_attendance_locations_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_attendance_locations_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_attendance_locations_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_debt_payments: {
        Row: {
          amount: number
          collected_by: string
          created_at: string
          id: string
          notes: string | null
          payment_method: string
          worker_debt_id: string
        }
        Insert: {
          amount: number
          collected_by: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          worker_debt_id: string
        }
        Update: {
          amount?: number
          collected_by?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          worker_debt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_debt_payments_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_debt_payments_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_debt_payments_worker_debt_id_fkey"
            columns: ["worker_debt_id"]
            isOneToOne: false
            referencedRelation: "worker_debts"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_debts: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string
          debt_type: string
          description: string | null
          id: string
          paid_amount: number
          remaining_amount: number | null
          session_id: string | null
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by: string
          debt_type?: string
          description?: string | null
          id?: string
          paid_amount?: number
          remaining_amount?: number | null
          session_id?: string | null
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string
          debt_type?: string
          description?: string | null
          id?: string
          paid_amount?: number
          remaining_amount?: number | null
          session_id?: string | null
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_debts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_debts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_debts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_debts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "accounting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_debts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_debts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_liability_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string
          id: string
          reason: string | null
          worker_id: string
        }
        Insert: {
          adjustment_type?: string
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          reason?: string | null
          worker_id: string
        }
        Update: {
          adjustment_type?: string
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          reason?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_liability_adjustments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_liability_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_liability_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_liability_adjustments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_liability_adjustments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_load_request_items: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          product_id: string
          quantity: number
          request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          quantity?: number
          request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          quantity?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_load_request_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_load_request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_load_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "worker_load_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_load_requests: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_load_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_load_requests_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_load_requests_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_locations: {
        Row: {
          accuracy: number | null
          branch_id: string | null
          created_at: string
          heading: number | null
          id: string
          idle_since: string | null
          is_tracking: boolean
          latitude: number
          longitude: number
          speed: number | null
          stops: Json | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          accuracy?: number | null
          branch_id?: string | null
          created_at?: string
          heading?: number | null
          id?: string
          idle_since?: string | null
          is_tracking?: boolean
          latitude: number
          longitude: number
          speed?: number | null
          stops?: Json | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          accuracy?: number | null
          branch_id?: string | null
          created_at?: string
          heading?: number | null
          id?: string
          idle_since?: string | null
          is_tracking?: boolean
          latitude?: number
          longitude?: number
          speed?: number | null
          stops?: Json | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_permissions: {
        Row: {
          created_at: string
          granted: boolean
          granted_by: string | null
          id: string
          permission_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission_id: string
          worker_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_permissions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_permissions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_roles: {
        Row: {
          assigned_by: string | null
          branch_id: string | null
          created_at: string
          custom_role_id: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          notes: string | null
          role: Database["public"]["Enums"]["app_role"]
          valid_from: string | null
          valid_until: string | null
          worker_id: string
        }
        Insert: {
          assigned_by?: string | null
          branch_id?: string | null
          created_at?: string
          custom_role_id?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          notes?: string | null
          role: Database["public"]["Enums"]["app_role"]
          valid_from?: string | null
          valid_until?: string | null
          worker_id: string
        }
        Update: {
          assigned_by?: string | null
          branch_id?: string | null
          created_at?: string
          custom_role_id?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          valid_from?: string | null
          valid_until?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_roles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_roles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_stock: {
        Row: {
          branch_id: string | null
          id: string
          product_id: string
          quantity: number
          updated_at: string
          worker_id: string
        }
        Insert: {
          branch_id?: string | null
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          worker_id: string
        }
        Update: {
          branch_id?: string | null
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_stock_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_stock_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_target_progress: {
        Row: {
          achieved_value: number
          achievement_pct: number
          created_at: string
          id: string
          last_calculated_at: string
          penalty_calculated: number
          period_end: string
          period_start: string
          reward_applied: boolean
          reward_calculated: number
          status: Database["public"]["Enums"]["target_progress_status"]
          target_id: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          achieved_value?: number
          achievement_pct?: number
          created_at?: string
          id?: string
          last_calculated_at?: string
          penalty_calculated?: number
          period_end: string
          period_start: string
          reward_applied?: boolean
          reward_calculated?: number
          status?: Database["public"]["Enums"]["target_progress_status"]
          target_id: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          achieved_value?: number
          achievement_pct?: number
          created_at?: string
          id?: string
          last_calculated_at?: string
          penalty_calculated?: number
          period_end?: string
          period_start?: string
          reward_applied?: boolean
          reward_calculated?: number
          status?: Database["public"]["Enums"]["target_progress_status"]
          target_id?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_target_progress_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "worker_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_target_progress_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_target_progress_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_targets: {
        Row: {
          bonus_per_extra_unit: number
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          is_active: boolean
          metric_type: Database["public"]["Enums"]["target_metric_type"]
          min_achievement_pct: number
          name: string
          notes: string | null
          penalty_amount: number
          period_type: Database["public"]["Enums"]["target_period_type"]
          reward_amount: number
          start_date: string
          target_value: number
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          bonus_per_extra_unit?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          metric_type: Database["public"]["Enums"]["target_metric_type"]
          min_achievement_pct?: number
          name: string
          notes?: string | null
          penalty_amount?: number
          period_type: Database["public"]["Enums"]["target_period_type"]
          reward_amount?: number
          start_date: string
          target_value: number
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          bonus_per_extra_unit?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          metric_type?: Database["public"]["Enums"]["target_metric_type"]
          min_achievement_pct?: number
          name?: string
          notes?: string | null
          penalty_amount?: number
          period_type?: Database["public"]["Enums"]["target_period_type"]
          reward_amount?: number
          start_date?: string
          target_value?: number
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_targets_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_targets_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_ui_overrides: {
        Row: {
          created_at: string
          element_key: string
          element_type: string
          id: string
          is_hidden: boolean
          updated_by: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string
          element_key: string
          element_type: string
          id?: string
          is_hidden?: boolean
          updated_by?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string
          element_key?: string
          element_type?: string
          id?: string
          is_hidden?: boolean
          updated_by?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_ui_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_ui_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_ui_overrides_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_ui_overrides_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          bonus_cap_percentage: number | null
          branch_id: string | null
          created_at: string
          department: string | null
          device_locked: boolean | null
          full_name: string
          full_name_fr: string | null
          id: string
          is_active: boolean
          is_test: boolean
          last_device_id: string | null
          last_device_info: Json | null
          password_hash: string
          personal_phone: string | null
          print_name: string | null
          review_pin_hash: string | null
          role: Database["public"]["Enums"]["app_role"]
          salary: number | null
          updated_at: string
          username: string
          work_phone: string | null
        }
        Insert: {
          bonus_cap_percentage?: number | null
          branch_id?: string | null
          created_at?: string
          department?: string | null
          device_locked?: boolean | null
          full_name: string
          full_name_fr?: string | null
          id?: string
          is_active?: boolean
          is_test?: boolean
          last_device_id?: string | null
          last_device_info?: Json | null
          password_hash: string
          personal_phone?: string | null
          print_name?: string | null
          review_pin_hash?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          salary?: number | null
          updated_at?: string
          username: string
          work_phone?: string | null
        }
        Update: {
          bonus_cap_percentage?: number | null
          branch_id?: string | null
          created_at?: string
          department?: string | null
          device_locked?: boolean | null
          full_name?: string
          full_name_fr?: string | null
          id?: string
          is_active?: boolean
          is_test?: boolean
          last_device_id?: string | null
          last_device_info?: Json | null
          password_hash?: string
          personal_phone?: string | null
          print_name?: string | null
          review_pin_hash?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          salary?: number | null
          updated_at?: string
          username?: string
          work_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_cash_reconciliation: {
        Row: {
          account_id: string | null
          account_type: string | null
          last_movement_at: string | null
          ledger_balance: number | null
          movements_count: number | null
        }
        Relationships: []
      }
      v_debt_reconciliation: {
        Row: {
          actual_remaining: number | null
          debt_id: string | null
          debtor_id: string | null
          debtor_type: string | null
          ledger_balance: number | null
          variance: number | null
        }
        Relationships: []
      }
      v_factory_orders_localized: {
        Row: {
          assistant_approved_at: string | null
          assistant_approved_by: string | null
          branch_approved_at: string | null
          branch_approved_by: string | null
          branch_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          closed_at: string | null
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          delivered_at: string | null
          frozen_at: string | null
          frozen_by: string | null
          id: string | null
          in_production_at: string | null
          linked_receipt_id: string | null
          notes: string | null
          order_type: string | null
          pallet_count: number | null
          ready_for_delivery_at: string | null
          reference_no: number | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          rejection_stage: string | null
          status: string | null
          status_category: string | null
          status_color: string | null
          status_icon: string | null
          status_label_ar: string | null
          status_label_en: string | null
          system_manager_approved_at: string | null
          system_manager_approved_by: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factory_orders_assistant_approved_by_fkey"
            columns: ["assistant_approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_assistant_approved_by_fkey"
            columns: ["assistant_approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_branch_approved_by_fkey"
            columns: ["branch_approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_branch_approved_by_fkey"
            columns: ["branch_approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_system_manager_approved_by_fkey"
            columns: ["system_manager_approved_by"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_orders_system_manager_approved_by_fkey"
            columns: ["system_manager_approved_by"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      v_offer_balances: {
        Row: {
          branch_id: string | null
          delivered_gift: number | null
          delivered_sale: number | null
          last_movement_at: string | null
          loaded_gift: number | null
          loaded_sale: number | null
          movements_count: number | null
          offer_id: string | null
          product_id: string | null
          remaining_gift: number | null
          remaining_sale: number | null
          returned_gift: number | null
          returned_sale: number | null
          shortage_gift: number | null
          shortage_sale: number | null
          worker_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_ledger_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      v_offer_ledger_full: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          gift_quantity: number | null
          gift_quantity_unit: string | null
          id: string | null
          movement_type: string | null
          notes: string | null
          offer_id: string | null
          offer_name: string | null
          offer_tier_id: string | null
          pieces_per_box: number | null
          product_id: string | null
          product_name: string | null
          promo_id: string | null
          reference_id: string | null
          reference_type: string | null
          running_gift_balance: number | null
          running_sale_balance: number | null
          sale_quantity: number | null
          sale_quantity_unit: string | null
          signed_gift: number | null
          signed_sale: number | null
          source_session_id: string | null
          worker_id: string | null
          worker_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_ledger_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_offer_tier_id_fkey"
            columns: ["offer_tier_id"]
            isOneToOne: false
            referencedRelation: "product_offer_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "loading_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_ledger_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_reconciliation: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          computed_from_movements: number | null
          current_stock: number | null
          last_movement_at: string | null
          movements_count: number | null
          product_id: string | null
          product_name: string | null
          status: string | null
          variance: number | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      workers_safe: {
        Row: {
          bonus_cap_percentage: number | null
          branch_id: string | null
          created_at: string | null
          department: string | null
          device_locked: boolean | null
          full_name: string | null
          full_name_fr: string | null
          id: string | null
          is_active: boolean | null
          is_test: boolean | null
          last_device_id: string | null
          last_device_info: Json | null
          personal_phone: string | null
          print_name: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          salary: number | null
          updated_at: string | null
          username: string | null
          work_phone: string | null
        }
        Insert: {
          bonus_cap_percentage?: number | null
          branch_id?: string | null
          created_at?: string | null
          department?: string | null
          device_locked?: boolean | null
          full_name?: string | null
          full_name_fr?: string | null
          id?: string | null
          is_active?: boolean | null
          is_test?: boolean | null
          last_device_id?: string | null
          last_device_info?: Json | null
          personal_phone?: string | null
          print_name?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          salary?: number | null
          updated_at?: string | null
          username?: string | null
          work_phone?: string | null
        }
        Update: {
          bonus_cap_percentage?: number | null
          branch_id?: string | null
          created_at?: string | null
          department?: string | null
          device_locked?: boolean | null
          full_name?: string | null
          full_name_fr?: string | null
          id?: string | null
          is_active?: boolean | null
          is_test?: boolean | null
          last_device_id?: string | null
          last_device_info?: Json | null
          personal_phone?: string | null
          print_name?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          salary?: number | null
          updated_at?: string | null
          username?: string | null
          work_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      "55555555520262026": { Args: never; Returns: string }
      approve_factory_order: {
        Args: { p_notes?: string; p_order_id: string }
        Returns: Json
      }
      approve_stock_receipt_two_stage: {
        Args: { p_receipt_id: string; p_stage: string }
        Returns: Json
      }
      archive_cash_movements: { Args: never; Returns: Json }
      archive_debt_movements: { Args: never; Returns: Json }
      archive_stock_movements: { Args: never; Returns: Json }
      calculate_worker_target_progress: {
        Args: {
          _reference_date?: string
          _target_id: string
          _worker_id: string
        }
        Returns: string
      }
      can_create_stock_confirmation_for_session: {
        Args: {
          _branch_id: string
          _manager_id: string
          _source_session_id: string
          _worker_id: string
        }
        Returns: boolean
      }
      can_finalize_sector_coverage: { Args: never; Returns: boolean }
      can_insert_stock_confirmation:
        | {
            Args: {
              _branch_id: string
              _manager_id: string
              _source_session_id: string
              _worker_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _branch_id: string
              _manager_id: string
              _operation_type?: string
              _source_session_id: string
              _worker_id: string
            }
            Returns: boolean
          }
      can_manage_product_offers: {
        Args: { p_worker_id: string }
        Returns: boolean
      }
      can_manage_sector_coverage_branch: {
        Args: { p_branch_id: string }
        Returns: boolean
      }
      can_manage_targets: { Args: { _user_id: string }; Returns: boolean }
      confirm_loading_session_atomic: {
        Args: { p_session_id: string }
        Returns: Json
      }
      current_worker_manages_branch: {
        Args: { p_branch_id: string }
        Returns: boolean
      }
      delete_promo_ledger_entries: {
        Args: { p_promo_id: string }
        Returns: undefined
      }
      extend_offer_period: {
        Args: {
          p_new_end: string
          p_new_start: string
          p_notes?: string
          p_offer_id: string
          p_period_type?: string
          p_tier_id: string
        }
        Returns: string
      }
      forward_manual_invoice_request_to_management: {
        Args: { p_request_id: string }
        Returns: Json
      }
      get_allowed_next_statuses: {
        Args: { p_document_type: string; p_from_status: string }
        Returns: {
          description: string
          is_rejection: boolean
          is_terminal: boolean
          requires_reason: boolean
          to_status: string
        }[]
      }
      get_customer_account_id: { Args: never; Returns: string }
      get_customer_sales_rep_statuses: {
        Args: {
          p_customer_ids: string[]
          p_end: string
          p_start: string
          p_worker_ids: string[]
        }
        Returns: {
          customer_id: string
          status: string
        }[]
      }
      get_target_period_bounds: {
        Args: {
          _date: string
          _period: Database["public"]["Enums"]["target_period_type"]
        }
        Returns: {
          period_end: string
          period_start: string
        }[]
      }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_worker_branch_id: { Args: never; Returns: string }
      get_worker_id: { Args: never; Returns: string }
      get_worker_permissions: {
        Args: { p_worker_id: string }
        Returns: {
          category: string
          permission_code: string
          permission_name: string
          resource: string
        }[]
      }
      get_worker_permissions_for_role: {
        Args: {
          p_base_role?: Database["public"]["Enums"]["app_role"]
          p_custom_role_code?: string
          p_worker_id: string
        }
        Returns: {
          category: string
          permission_code: string
          permission_name: string
          resource: string
        }[]
      }
      get_worker_roles: {
        Args: { p_worker_id: string }
        Returns: {
          branch_id: string
          branch_name: string
          custom_role_code: string
          custom_role_id: string
          custom_role_name: string
          is_primary: boolean
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      has_custom_role: { Args: { p_role_code: string }; Returns: boolean }
      has_locked_final_review: {
        Args: { _from: string; _to: string; _worker_id: string }
        Returns: boolean
      }
      insert_promo_ledger_entry: {
        Args: {
          p_created_by: string
          p_customer_id: string
          p_movement_subtype: string
          p_product_id: string
          p_promo_id: string
          p_quantity: number
          p_unit?: string
          p_worker_id: string
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_of_branch: { Args: { p_branch_id: string }; Returns: boolean }
      is_approved_customer: { Args: never; Returns: boolean }
      is_branch_admin: { Args: never; Returns: boolean }
      is_conversation_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_worker: { Args: never; Returns: boolean }
      is_worker_role_active: {
        Args: {
          p_is_active: boolean
          p_valid_from: string
          p_valid_until: string
        }
        Returns: boolean
      }
      purge_cash_movements: { Args: never; Returns: Json }
      purge_cash_movements_all: { Args: never; Returns: Json }
      purge_cash_movements_archive: { Args: never; Returns: Json }
      purge_debt_movements: { Args: never; Returns: Json }
      purge_debt_movements_all: { Args: never; Returns: Json }
      purge_debt_movements_archive: { Args: never; Returns: Json }
      purge_stock_movements: { Args: never; Returns: Json }
      purge_stock_movements_all: { Args: never; Returns: Json }
      purge_stock_movements_archive: { Args: never; Returns: Json }
      quantity_to_total_pieces: {
        Args: { p_product_id: string; p_quantity: number; p_unit?: string }
        Returns: number
      }
      recalculate_running_balance: {
        Args: { p_branch_id: string; p_product_id: string }
        Returns: Json
      }
      recalculate_targets_for_worker: {
        Args: { _reference_date?: string; _worker_id: string }
        Returns: number
      }
      record_cash_collection_atomic: {
        Args: {
          p_account_id: string
          p_account_type: string
          p_amount: number
          p_branch_id?: string
          p_from_account_id?: string
          p_from_account_type?: string
          p_notes?: string
          p_reason?: string
          p_reference_id?: string
          p_reference_type?: string
        }
        Returns: Json
      }
      record_customer_return_atomic: {
        Args: {
          p_branch_id: string
          p_customer_id: string
          p_destination: string
          p_destination_id: string
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_reason?: string
          p_reference_id?: string
        }
        Returns: Json
      }
      record_debt_creation_atomic: {
        Args: {
          p_amount: number
          p_branch_id?: string
          p_debt_id: string
          p_debtor_id: string
          p_debtor_type: string
          p_notes?: string
          p_reason?: string
          p_reference_id?: string
          p_reference_type?: string
        }
        Returns: Json
      }
      record_debt_payment_atomic: {
        Args: {
          p_amount: number
          p_branch_id?: string
          p_debt_id: string
          p_debtor_id: string
          p_debtor_type: string
          p_is_full?: boolean
          p_notes?: string
          p_payment_method?: string
          p_reference_id?: string
        }
        Returns: Json
      }
      record_debt_writeoff_atomic: {
        Args: {
          p_amount: number
          p_debt_id: string
          p_debtor_id: string
          p_debtor_type: string
          p_notes?: string
          p_reason?: string
        }
        Returns: Json
      }
      record_expense_atomic: {
        Args: {
          p_account_id: string
          p_account_type: string
          p_amount: number
          p_branch_id?: string
          p_notes?: string
          p_reason?: string
          p_reference_id?: string
        }
        Returns: Json
      }
      record_offer_adjustment: {
        Args: {
          p_gift_qty?: number
          p_notes?: string
          p_offer_id: string
          p_product_id: string
          p_sale_qty: number
          p_worker_id: string
        }
        Returns: string
      }
      record_offer_load: {
        Args: {
          p_gift_qty?: number
          p_notes?: string
          p_offer_id: string
          p_product_id: string
          p_sale_qty: number
          p_session_id?: string
          p_worker_id: string
        }
        Returns: string
      }
      record_offer_shortage: {
        Args: {
          p_gift_qty?: number
          p_notes?: string
          p_offer_id: string
          p_product_id: string
          p_sale_qty: number
          p_worker_id: string
        }
        Returns: string
      }
      record_stock_adjustment_atomic: {
        Args: {
          p_branch_id: string
          p_delta: number
          p_notes?: string
          p_product_id: string
          p_reason?: string
          p_reference_id?: string
        }
        Returns: Json
      }
      record_workflow_transition: {
        Args: {
          p_branch_id?: string
          p_document_id: string
          p_document_type: string
          p_from_status: string
          p_metadata?: Json
          p_notes?: string
          p_reason?: string
          p_reference_id?: string
          p_reference_type?: string
          p_skip_validation?: boolean
          p_to_status: string
        }
        Returns: string
      }
      reject_factory_order: {
        Args: { p_order_id: string; p_reason: string }
        Returns: Json
      }
      search_orders_by_prefix: {
        Args: { p_limit?: number; p_prefix: string }
        Returns: {
          order_id: string
        }[]
      }
      set_worker_review_pin: {
        Args: { _pin: string; _worker_id: string }
        Returns: undefined
      }
      set_worker_session: { Args: { p_worker_id: string }; Returns: undefined }
      start_loading_session_atomic: {
        Args: { p_notes?: string; p_worker_id: string }
        Returns: Json
      }
      submit_factory_order_for_approval: {
        Args: { p_order_id: string }
        Returns: Json
      }
      total_pieces_to_bp: {
        Args: { p_product_id: string; p_total_pieces: number }
        Returns: number
      }
      transfer_between_branches_atomic: {
        Args: {
          p_from_branch: string
          p_items: Json
          p_notes?: string
          p_to_branch: string
        }
        Returns: Json
      }
      transfer_cash_atomic: {
        Args: {
          p_amount: number
          p_branch_id?: string
          p_from_account_id: string
          p_from_account_type: string
          p_notes?: string
          p_reason?: string
          p_to_account_id: string
          p_to_account_type: string
        }
        Returns: Json
      }
      transition_factory_order_status: {
        Args: {
          p_notes?: string
          p_order_id: string
          p_reason?: string
          p_to_status: string
        }
        Returns: Json
      }
      unload_session_atomic: {
        Args: { p_items: Json; p_session_id: string }
        Returns: Json
      }
      validate_workflow_transition: {
        Args: {
          p_actor_role?: Database["public"]["Enums"]["app_role"]
          p_actor_worker_id?: string
          p_document_type: string
          p_from_status: string
          p_to_status: string
        }
        Returns: Json
      }
      verify_customer_password: {
        Args: { p_password_hash: string; p_username: string }
        Returns: {
          created_at: string
          customer_id: string
          full_name: string
          id: string
          phone: string
          status: string
          store_name: string
          username: string
        }[]
      }
      verify_worker_password: {
        Args: { p_password_hash: string; p_username: string }
        Returns: {
          branch_id: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          username: string
        }[]
      }
      verify_worker_review_pin: {
        Args: { _pin: string; _worker_id: string }
        Returns: boolean
      }
      worker_has_custom_role: {
        Args: { p_role_code: string; p_worker_id: string }
        Returns: boolean
      }
      worker_has_permission: {
        Args: { p_permission_code: string; p_worker_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "worker"
        | "supervisor"
        | "branch_admin"
        | "project_manager"
        | "accountant"
        | "admin_assistant"
        | "warehouse_manager"
        | "company_manager"
        | "internal_supervisor"
      target_metric_type: "sales_amount" | "deliveries_count" | "cartons_sold"
      target_period_type: "daily" | "weekly" | "monthly"
      target_progress_status: "in_progress" | "achieved" | "missed"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "doing" | "done"
      task_type: "task" | "request"
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
    Enums: {
      app_role: [
        "admin",
        "worker",
        "supervisor",
        "branch_admin",
        "project_manager",
        "accountant",
        "admin_assistant",
        "warehouse_manager",
        "company_manager",
        "internal_supervisor",
      ],
      target_metric_type: ["sales_amount", "deliveries_count", "cartons_sold"],
      target_period_type: ["daily", "weekly", "monthly"],
      target_progress_status: ["in_progress", "achieved", "missed"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "doing", "done"],
      task_type: ["task", "request"],
    },
  },
} as const
