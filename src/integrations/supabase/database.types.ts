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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cycle_expenses: {
        Row: {
          amount: number
          category_name: string | null
          created_at: string
          cycle_id: string
          date: string
          id: string
          name: string
          note: string | null
        }
        Insert: {
          amount: number
          category_name?: string | null
          created_at?: string
          cycle_id?: string
          date: string
          id?: string
          name: string
          note?: string | null
        }
        Update: {
          amount?: number
          category_name?: string | null
          created_at?: string
          cycle_id?: string
          date?: string
          id?: string
          name?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_expenses_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "materialized_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_owners: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_owners_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          debt_owner_id: string
          end_date: string | null
          first_payment_date: string
          has_end: boolean
          id: string
          installments: number
          name: string
          purchased_at: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          debt_owner_id?: string
          end_date?: string | null
          first_payment_date: string
          has_end?: boolean
          id?: string
          installments: number
          name: string
          purchased_at?: string | null
          workspace_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          debt_owner_id?: string
          end_date?: string | null
          first_payment_date?: string
          has_end?: boolean
          id?: string
          installments?: number
          name?: string
          purchased_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_debt_owner_id_fkey"
            columns: ["debt_owner_id"]
            isOneToOne: false
            referencedRelation: "debt_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      income_payers: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type?: string | null
          workspace_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_payers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          amount: number
          created_at: string
          currency: string
          end_date: string | null
          first_income_date: string | null
          id: string
          is_recurrent: boolean
          name: string
          number_of_payments: number | null
          payer_id: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          end_date?: string | null
          first_income_date?: string | null
          id?: string
          is_recurrent: boolean
          name: string
          number_of_payments?: number | null
          payer_id?: string | null
          workspace_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          end_date?: string | null
          first_income_date?: string | null
          id?: string
          is_recurrent?: boolean
          name?: string
          number_of_payments?: number | null
          payer_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "income_payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      materialized_cycles: {
        Row: {
          created_at: string
          date: string
          id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materialized_cycles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      materialized_debts: {
        Row: {
          amount: number
          created_at: string
          cycle_id: string
          debt_id: string
          id: string
          installment_number: number | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          cycle_id?: string
          debt_id?: string
          id?: string
          installment_number?: number | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          cycle_id?: string
          debt_id?: string
          id?: string
          installment_number?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "materialized_debts_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "materialized_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materialized_debts_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      materialized_incomes: {
        Row: {
          amount: number
          created_at: string
          cycle_id: string
          id: string
          income_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          cycle_id?: string
          id?: string
          income_id?: string
          status: string
        }
        Update: {
          amount?: number
          created_at?: string
          cycle_id?: string
          id?: string
          income_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "materialized_incomes_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "materialized_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materialized_incomes_income_id_fkey"
            columns: ["income_id"]
            isOneToOne: false
            referencedRelation: "incomes"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          created_at: string
          id: string
          income_default_currency: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          income_default_currency?: string | null
          workspace_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          income_default_currency?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          name: string
          workspace_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pay_end_date: {
        Args: { increment: number; start_date: string }
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
    Enums: {},
  },
} as const
