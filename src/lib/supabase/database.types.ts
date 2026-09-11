export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string
          deadline_at: string | null
          id: string
          money_impact: number | null
          opportunity_id: string | null
          owner_id: string | null
          pinned: boolean
          priority: number
          reason: string
          related_record_id: string | null
          related_record_type: string | null
          rep_id: string | null
          snoozed_until: string | null
          status: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at: string
          waiting_on: string | null
          is_demo: boolean
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          money_impact?: number | null
          opportunity_id?: string | null
          owner_id?: string | null
          pinned?: boolean
          priority?: number
          reason: string
          related_record_id?: string | null
          related_record_type?: string | null
          rep_id?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at?: string
          waiting_on?: string | null
          is_demo?: boolean
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          money_impact?: number | null
          opportunity_id?: string | null
          owner_id?: string | null
          pinned?: boolean
          priority?: number
          reason?: string
          related_record_id?: string | null
          related_record_type?: string | null
          rep_id?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          title?: string
          updated_at?: string
          waiting_on?: string | null
          is_demo?: boolean
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          agreed_next_action: string | null
          created_at: string
          deal_value: number | null
          external_event_id: string | null
          id: string
          logged_at: string | null
          logged_by: string | null
          next_call_at: string | null
          notes: string | null
          opportunity_id: string
          outcome: Database["public"]["Enums"]["call_outcome"]
          recording_status: string
          recording_url: string | null
          scheduled_at: string
          transcript_status: string
          transcript_url: string | null
          updated_at: string
          is_demo: boolean
        }
        Insert: {
          agreed_next_action?: string | null
          created_at?: string
          deal_value?: number | null
          external_event_id?: string | null
          id?: string
          logged_at?: string | null
          logged_by?: string | null
          next_call_at?: string | null
          notes?: string | null
          opportunity_id: string
          outcome?: Database["public"]["Enums"]["call_outcome"]
          recording_status?: string
          recording_url?: string | null
          scheduled_at: string
          transcript_status?: string
          transcript_url?: string | null
          updated_at?: string
          is_demo?: boolean
        }
        Update: {
          agreed_next_action?: string | null
          created_at?: string
          deal_value?: number | null
          external_event_id?: string | null
          id?: string
          logged_at?: string | null
          logged_by?: string | null
          next_call_at?: string | null
          notes?: string | null
          opportunity_id?: string
          outcome?: Database["public"]["Enums"]["call_outcome"]
          recording_status?: string
          recording_url?: string | null
          scheduled_at?: string
          transcript_status?: string
          transcript_url?: string | null
          updated_at?: string
          is_demo?: boolean
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          fulfillment_completed_at: string | null
          go_live_completed_at: string | null
          id: string
          lifecycle_state: Database["public"]["Enums"]["client_lifecycle_state"]
          name: string
          rr_rate_basis: Json | null
          signed_at: string | null
          updated_at: string
          workflow_type: string
          is_demo: boolean
        }
        Insert: {
          created_at?: string
          fulfillment_completed_at?: string | null
          go_live_completed_at?: string | null
          id?: string
          lifecycle_state?: Database["public"]["Enums"]["client_lifecycle_state"]
          name: string
          rr_rate_basis?: Json | null
          signed_at?: string | null
          updated_at?: string
          workflow_type?: string
          is_demo?: boolean
        }
        Update: {
          created_at?: string
          fulfillment_completed_at?: string | null
          go_live_completed_at?: string | null
          id?: string
          lifecycle_state?: Database["public"]["Enums"]["client_lifecycle_state"]
          name?: string
          rr_rate_basis?: Json | null
          signed_at?: string | null
          updated_at?: string
          workflow_type?: string
          is_demo?: boolean
        }
        Relationships: []
      }
      collections: {
        Row: {
          amount: number
          created_at: string
          currency: string
          deal_id: string
          external_reference: string | null
          id: string
          reported_at: string
          reported_by: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          is_demo: boolean
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          deal_id: string
          external_reference?: string | null
          id?: string
          reported_at?: string
          reported_by?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          is_demo?: boolean
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          deal_id?: string
          external_reference?: string | null
          id?: string
          reported_at?: string
          reported_by?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          is_demo?: boolean
        }
        Relationships: []
      }
      connections: {
        Row: {
          access_level: string | null
          authorized_account: string | null
          client_id: string | null
          created_at: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          last_synced_at: string | null
          owner_id: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          access_level?: string | null
          authorized_account?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          owner_id?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          access_level?: string | null
          authorized_account?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          owner_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string
          status: string
          updated_at: string
          value: number
          is_demo: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          opportunity_id: string
          status?: string
          updated_at?: string
          value: number
          is_demo?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string
          status?: string
          updated_at?: string
          value?: number
          is_demo?: boolean
        }
        Relationships: []
      }
      handover_items: {
        Row: {
          blocks_readiness: boolean
          category: string
          client_id: string
          created_at: string
          due_at: string | null
          evidence_url: string | null
          id: string
          label: string
          not_applicable_reason: string | null
          owner: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          is_demo: boolean
        }
        Insert: {
          blocks_readiness?: boolean
          category: string
          client_id: string
          created_at?: string
          due_at?: string | null
          evidence_url?: string | null
          id?: string
          label: string
          not_applicable_reason?: string | null
          owner?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          is_demo?: boolean
        }
        Update: {
          blocks_readiness?: boolean
          category?: string
          client_id?: string
          created_at?: string
          due_at?: string | null
          evidence_url?: string | null
          id?: string
          label?: string
          not_applicable_reason?: string | null
          owner?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          is_demo?: boolean
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount: number
          client_id: string
          collection_id: string
          created_at: string
          created_by: string | null
          currency: string
          effective_terms: Json | null
          entry_type: string
          id: string
          linked_adjustment_of: string | null
          rep_id: string | null
          is_demo: boolean
        }
        Insert: {
          amount: number
          client_id: string
          collection_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_terms?: Json | null
          entry_type: string
          id?: string
          linked_adjustment_of?: string | null
          rep_id?: string | null
          is_demo?: boolean
        }
        Update: {
          amount?: number
          client_id?: string
          collection_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_terms?: Json | null
          entry_type?: string
          id?: string
          linked_adjustment_of?: string | null
          rep_id?: string | null
          is_demo?: boolean
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          client_id: string
          created_at: string
          custom_stage_label: string | null
          first_booked_at: string
          id: string
          owner_rep_id: string | null
          prospect_contact: string | null
          prospect_name: string
          setter_rep_id: string | null
          source: string | null
          stage: Database["public"]["Enums"]["opportunity_stage"]
          updated_at: string
          value: number | null
          is_demo: boolean
        }
        Insert: {
          client_id: string
          created_at?: string
          custom_stage_label?: string | null
          first_booked_at?: string
          id?: string
          owner_rep_id?: string | null
          prospect_contact?: string | null
          prospect_name: string
          setter_rep_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
          value?: number | null
          is_demo?: boolean
        }
        Update: {
          client_id?: string
          created_at?: string
          custom_stage_label?: string | null
          first_booked_at?: string
          id?: string
          owner_rep_id?: string | null
          prospect_contact?: string | null
          prospect_name?: string
          setter_rep_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
          value?: number | null
          is_demo?: boolean
        }
        Relationships: []
      }
      opportunity_ownership_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_rep_id: string | null
          id: string
          opportunity_id: string
          reason: string
          to_rep_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_rep_id?: string | null
          id?: string
          opportunity_id: string
          reason: string
          to_rep_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_rep_id?: string | null
          id?: string
          opportunity_id?: string
          reason?: string
          to_rep_id?: string | null
        }
        Relationships: []
      }
      founder_targets: {
        Row: { id: string; monthly_revenue_target: number | null; deals_target: number | null; new_clients_target: number | null; updated_at: string }
        Insert: { id?: string; monthly_revenue_target?: number | null; deals_target?: number | null; new_clients_target?: number | null; updated_at?: string }
        Update: { id?: string; monthly_revenue_target?: number | null; deals_target?: number | null; new_clients_target?: number | null; updated_at?: string }
        Relationships: []
      }
      demo_mode: {
        Row: { id: string; enabled: boolean; updated_at: string }
        Insert: { id?: string; enabled?: boolean; updated_at?: string }
        Update: { id?: string; enabled?: boolean; updated_at?: string }
        Relationships: []
      }
      rr_score_config: {
        Row: {
          id: string
          version: number
          weight_sales_performance: number
          weight_follow_up_discipline: number
          weight_call_quality: number
          weight_client_representation: number
          weight_consistency: number
          configured: boolean
          configured_by: string | null
          configured_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          version?: number
          weight_sales_performance?: number
          weight_follow_up_discipline?: number
          weight_call_quality?: number
          weight_client_representation?: number
          weight_consistency?: number
          configured?: boolean
          configured_by?: string | null
          configured_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          version?: number
          weight_sales_performance?: number
          weight_follow_up_discipline?: number
          weight_call_quality?: number
          weight_client_representation?: number
          weight_consistency?: number
          configured?: boolean
          configured_by?: string | null
          configured_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          client_id: string | null
          rep_assignment_id: string | null
          doc_type: string
          title: string
          status: string
          executed_copy_url: string | null
          effective_date: string | null
          structured_terms: Json | null
          terms_approved: boolean
          terms_approved_by: string | null
          terms_approved_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          rep_assignment_id?: string | null
          doc_type: string
          title: string
          status?: string
          executed_copy_url?: string | null
          effective_date?: string | null
          structured_terms?: Json | null
          terms_approved?: boolean
          terms_approved_by?: string | null
          terms_approved_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          rep_assignment_id?: string | null
          doc_type?: string
          title?: string
          status?: string
          executed_copy_url?: string | null
          effective_date?: string | null
          structured_terms?: Json | null
          terms_approved?: boolean
          terms_approved_by?: string | null
          terms_approved_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_reports: {
        Row: {
          id: string
          client_id: string
          period_start: string
          period_end: string
          snapshot: Json
          recipient_emails: string[]
          delivery_status: string
          sent_at: string | null
          sent_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          period_start: string
          period_end: string
          snapshot: Json
          recipient_emails?: string[]
          delivery_status?: string
          sent_at?: string | null
          sent_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          period_start?: string
          period_end?: string
          snapshot?: Json
          recipient_emails?: string[]
          delivery_status?: string
          sent_at?: string | null
          sent_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      communications: {
        Row: {
          id: string
          subject_type: string
          subject_id: string
          client_id: string | null
          body: string
          visibility: string
          author_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          subject_type: string
          subject_id: string
          client_id?: string | null
          body: string
          visibility?: string
          author_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          subject_type?: string
          subject_id?: string
          client_id?: string | null
          body?: string
          visibility?: string
          author_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          id: string
          company_name: string
          contact_name: string | null
          contact_email: string | null
          source: string | null
          stage: Database["public"]["Enums"]["prospect_stage"]
          qualification_notes: string | null
          proposed_plan: string | null
          next_action: string | null
          next_action_date: string | null
          owner_id: string | null
          converted_client_id: string | null
          created_at: string
          updated_at: string
          is_demo: boolean
        }
        Insert: {
          id?: string
          company_name: string
          contact_name?: string | null
          contact_email?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
          qualification_notes?: string | null
          proposed_plan?: string | null
          next_action?: string | null
          next_action_date?: string | null
          owner_id?: string | null
          converted_client_id?: string | null
          created_at?: string
          updated_at?: string
          is_demo?: boolean
        }
        Update: {
          id?: string
          company_name?: string
          contact_name?: string | null
          contact_email?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
          qualification_notes?: string | null
          proposed_plan?: string | null
          next_action?: string | null
          next_action_date?: string | null
          owner_id?: string | null
          converted_client_id?: string | null
          created_at?: string
          updated_at?: string
          is_demo?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rep_assignments: {
        Row: {
          active_from: string | null
          booking_link: string | null
          client_id: string
          compensation_terms: Json | null
          created_at: string
          id: string
          removed_at: string | null
          removed_reason: string | null
          rep_id: string
          role: string
          status: string
          trial_review_result: string | null
          trial_reviewed_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          active_from?: string | null
          booking_link?: string | null
          client_id: string
          compensation_terms?: Json | null
          created_at?: string
          id?: string
          removed_at?: string | null
          removed_reason?: string | null
          rep_id: string
          role: string
          status?: string
          trial_review_result?: string | null
          trial_reviewed_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          active_from?: string | null
          booking_link?: string | null
          client_id?: string
          compensation_terms?: Json | null
          created_at?: string
          id?: string
          removed_at?: string | null
          removed_reason?: string | null
          rep_id?: string
          role?: string
          status?: string
          trial_review_result?: string | null
          trial_reviewed_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reps: {
        Row: {
          capabilities: string[]
          claimed_cash_collected: number | null
          created_at: string
          email: string
          evidence_source: string | null
          full_name: string
          geography: string | null
          id: string
          intro_loom_url: string | null
          notes: string | null
          profile_id: string | null
          recruiting_status: Database["public"]["Enums"]["recruiting_status"]
          timezone: string | null
          updated_at: string
          verified_cash_collected: number | null
          is_benchmark: boolean
          benchmark_stats: Json | null
          is_demo: boolean
        }
        Insert: {
          capabilities?: string[]
          claimed_cash_collected?: number | null
          created_at?: string
          email: string
          evidence_source?: string | null
          full_name: string
          geography?: string | null
          id?: string
          intro_loom_url?: string | null
          notes?: string | null
          profile_id?: string | null
          recruiting_status?: Database["public"]["Enums"]["recruiting_status"]
          timezone?: string | null
          updated_at?: string
          verified_cash_collected?: number | null
          is_benchmark?: boolean
          benchmark_stats?: Json | null
          is_demo?: boolean
        }
        Update: {
          capabilities?: string[]
          claimed_cash_collected?: number | null
          created_at?: string
          email?: string
          evidence_source?: string | null
          full_name?: string
          geography?: string | null
          id?: string
          intro_loom_url?: string | null
          notes?: string | null
          profile_id?: string | null
          recruiting_status?: Database["public"]["Enums"]["recruiting_status"]
          timezone?: string | null
          updated_at?: string
          verified_cash_collected?: number | null
          is_benchmark?: boolean
          benchmark_stats?: Json | null
          is_demo?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_entries: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          ledger_entry_id: string | null
          paid_at: string | null
          payment_reference: string | null
          rep_id: string
          status: string
          updated_at: string
          is_demo: boolean
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          ledger_entry_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          rep_id: string
          status?: string
          updated_at?: string
          is_demo?: boolean
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          ledger_entry_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          rep_id?: string
          status?: string
          updated_at?: string
          is_demo?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      client_clocks: {
        Row: {
          client_id: string | null
          fulfillment_breached: boolean | null
          fulfillment_completed_at: string | null
          fulfillment_deadline: string | null
          go_live_breached: boolean | null
          go_live_completed_at: string | null
          go_live_deadline: string | null
          signed_at: string | null
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      rep_trial_clocks: {
        Row: {
          client_id: string | null
          rep_assignment_id: string | null
          rep_id: string | null
          trial_review_due_at: string | null
          trial_review_overdue: boolean | null
          trial_reviewed_at: string | null
          trial_started_at: string | null
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: {
      action_status:
        | "open"
        | "in_progress"
        | "waiting"
        | "done"
        | "snoozed"
        | "cancelled"
      app_role: "founder" | "internal" | "closer" | "setter" | "finance" | "client"
      call_outcome:
        | "completed_won"
        | "completed_follow_up"
        | "completed_lost"
        | "no_show"
        | "cancelled"
        | "rescheduled"
        | "pending"
      client_lifecycle_state:
        | "onboarding"
        | "access_pending"
        | "fulfillment"
        | "rep_training_trial"
        | "live"
        | "active"
        | "paused"
        | "churned"
      opportunity_stage: "upstream" | "booked" | "follow_up" | "won" | "lost"
      prospect_stage:
        | "lead"
        | "interested"
        | "call_booked"
        | "call_completed"
        | "follow_up"
        | "agreement_sent"
        | "signed"
        | "no_show"
        | "not_fit"
      recruiting_status:
        | "application"
        | "screening"
        | "interview"
        | "talent_pool"
        | "rejected"
        | "available_for_matching"
        | "selected"
        | "client_training"
        | "live_trial"
        | "confirmed_active"
        | "bench"
        | "removed"
    }
    CompositeTypes: Record<string, never>
  }
}
