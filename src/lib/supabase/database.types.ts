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
      action_items: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string
          deadline_at: string | null
          id: string
          is_demo: boolean
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
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          is_demo?: boolean
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
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          is_demo?: boolean
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
        }
        Relationships: [
          {
            foreignKeyName: "action_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "action_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agreed_next_action: string | null
          created_at: string
          deal_value: number | null
          external_event_id: string | null
          id: string
          is_demo: boolean
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
        }
        Insert: {
          agreed_next_action?: string | null
          created_at?: string
          deal_value?: number | null
          external_event_id?: string | null
          id?: string
          is_demo?: boolean
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
        }
        Update: {
          agreed_next_action?: string | null
          created_at?: string
          deal_value?: number | null
          external_event_id?: string | null
          id?: string
          is_demo?: boolean
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
        }
        Relationships: [
          {
            foreignKeyName: "calls_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reports: {
        Row: {
          client_id: string
          created_at: string
          delivery_status: string
          id: string
          period_end: string
          period_start: string
          recipient_emails: string[]
          sent_at: string | null
          sent_by: string | null
          snapshot: Json
        }
        Insert: {
          client_id: string
          created_at?: string
          delivery_status?: string
          id?: string
          period_end: string
          period_start: string
          recipient_emails?: string[]
          sent_at?: string | null
          sent_by?: string | null
          snapshot: Json
        }
        Update: {
          client_id?: string
          created_at?: string
          delivery_status?: string
          id?: string
          period_end?: string
          period_start?: string
          recipient_emails?: string[]
          sent_at?: string | null
          sent_by?: string | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          fulfillment_completed_at: string | null
          go_live_completed_at: string | null
          id: string
          is_demo: boolean
          lifecycle_state: Database["public"]["Enums"]["client_lifecycle_state"]
          name: string
          rr_rate_basis: Json | null
          signed_at: string | null
          updated_at: string
          workflow_type: string
        }
        Insert: {
          created_at?: string
          fulfillment_completed_at?: string | null
          go_live_completed_at?: string | null
          id?: string
          is_demo?: boolean
          lifecycle_state?: Database["public"]["Enums"]["client_lifecycle_state"]
          name: string
          rr_rate_basis?: Json | null
          signed_at?: string | null
          updated_at?: string
          workflow_type?: string
        }
        Update: {
          created_at?: string
          fulfillment_completed_at?: string | null
          go_live_completed_at?: string | null
          id?: string
          is_demo?: boolean
          lifecycle_state?: Database["public"]["Enums"]["client_lifecycle_state"]
          name?: string
          rr_rate_basis?: Json | null
          signed_at?: string | null
          updated_at?: string
          workflow_type?: string
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
          is_demo: boolean
          reported_at: string
          reported_by: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          deal_id: string
          external_reference?: string | null
          id?: string
          is_demo?: boolean
          reported_at?: string
          reported_by?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          deal_id?: string
          external_reference?: string | null
          id?: string
          is_demo?: boolean
          reported_at?: string
          reported_by?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          author_id: string | null
          body: string
          client_id: string | null
          created_at: string
          id: string
          subject_id: string
          subject_type: string
          visibility: string
        }
        Insert: {
          author_id?: string | null
          body: string
          client_id?: string | null
          created_at?: string
          id?: string
          subject_id: string
          subject_type: string
          visibility?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          client_id?: string | null
          created_at?: string
          id?: string
          subject_id?: string
          subject_type?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          opportunity_id: string
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          opportunity_id: string
          status?: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          opportunity_id?: string
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_mode: {
        Row: {
          enabled: boolean
          id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_signatures: {
        Row: {
          document_id: string
          id: string
          ip_address: string | null
          signed_at: string
          signer_name: string
          signer_title: string | null
        }
        Insert: {
          document_id: string
          id?: string
          ip_address?: string | null
          signed_at?: string
          signer_name: string
          signer_title?: string | null
        }
        Update: {
          document_id?: string
          id?: string
          ip_address?: string | null
          signed_at?: string
          signer_name?: string
          signer_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          body_template: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          doc_type: string
          effective_date: string | null
          executed_copy_url: string | null
          id: string
          rendered_body: string | null
          rep_assignment_id: string | null
          status: string
          structured_terms: Json | null
          terms_approved: boolean
          terms_approved_at: string | null
          terms_approved_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body_template?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_type: string
          effective_date?: string | null
          executed_copy_url?: string | null
          id?: string
          rendered_body?: string | null
          rep_assignment_id?: string | null
          status?: string
          structured_terms?: Json | null
          terms_approved?: boolean
          terms_approved_at?: string | null
          terms_approved_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body_template?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_type?: string
          effective_date?: string | null
          executed_copy_url?: string | null
          id?: string
          rendered_body?: string | null
          rep_assignment_id?: string | null
          status?: string
          structured_terms?: Json | null
          terms_approved?: boolean
          terms_approved_at?: string | null
          terms_approved_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_rep_assignment_id_fkey"
            columns: ["rep_assignment_id"]
            isOneToOne: false
            referencedRelation: "rep_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_rep_assignment_id_fkey"
            columns: ["rep_assignment_id"]
            isOneToOne: false
            referencedRelation: "rep_trial_clocks"
            referencedColumns: ["rep_assignment_id"]
          },
          {
            foreignKeyName: "documents_terms_approved_by_fkey"
            columns: ["terms_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_targets: {
        Row: {
          deals_target: number | null
          id: string
          monthly_revenue_target: number | null
          new_clients_target: number | null
          updated_at: string
        }
        Insert: {
          deals_target?: number | null
          id?: string
          monthly_revenue_target?: number | null
          new_clients_target?: number | null
          updated_at?: string
        }
        Update: {
          deals_target?: number | null
          id?: string
          monthly_revenue_target?: number | null
          new_clients_target?: number | null
          updated_at?: string
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
          is_demo: boolean
          label: string
          not_applicable_reason: string | null
          owner: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          blocks_readiness?: boolean
          category: string
          client_id: string
          created_at?: string
          due_at?: string | null
          evidence_url?: string | null
          id?: string
          is_demo?: boolean
          label: string
          not_applicable_reason?: string | null
          owner?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          blocks_readiness?: boolean
          category?: string
          client_id?: string
          created_at?: string
          due_at?: string | null
          evidence_url?: string | null
          id?: string
          is_demo?: boolean
          label?: string
          not_applicable_reason?: string | null
          owner?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "handover_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "handover_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          client_id: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          rep_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          client_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by?: string | null
          rep_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          client_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          rep_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
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
          is_demo: boolean
          linked_adjustment_of: string | null
          rep_id: string | null
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
          is_demo?: boolean
          linked_adjustment_of?: string | null
          rep_id?: string | null
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
          is_demo?: boolean
          linked_adjustment_of?: string | null
          rep_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ledger_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_linked_adjustment_of_fkey"
            columns: ["linked_adjustment_of"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          client_id: string
          created_at: string
          custom_stage_label: string | null
          first_booked_at: string
          id: string
          is_demo: boolean
          owner_rep_id: string | null
          prospect_contact: string | null
          prospect_name: string
          setter_rep_id: string | null
          source: string | null
          stage: Database["public"]["Enums"]["opportunity_stage"]
          updated_at: string
          value: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          custom_stage_label?: string | null
          first_booked_at?: string
          id?: string
          is_demo?: boolean
          owner_rep_id?: string | null
          prospect_contact?: string | null
          prospect_name: string
          setter_rep_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
          value?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          custom_stage_label?: string | null
          first_booked_at?: string
          id?: string
          is_demo?: boolean
          owner_rep_id?: string | null
          prospect_contact?: string | null
          prospect_name?: string
          setter_rep_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_owner_rep_id_fkey"
            columns: ["owner_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_setter_rep_id_fkey"
            columns: ["setter_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "opportunity_ownership_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_ownership_history_from_rep_id_fkey"
            columns: ["from_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_ownership_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_ownership_history_to_rep_id_fkey"
            columns: ["to_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          company_name: string
          contact_email: string | null
          contact_name: string | null
          converted_client_id: string | null
          created_at: string
          id: string
          is_demo: boolean
          next_action: string | null
          next_action_date: string | null
          owner_id: string | null
          proposed_plan: string | null
          qualification_notes: string | null
          source: string | null
          stage: Database["public"]["Enums"]["prospect_stage"]
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          converted_client_id?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          next_action?: string | null
          next_action_date?: string | null
          owner_id?: string | null
          proposed_plan?: string | null
          qualification_notes?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          converted_client_id?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          next_action?: string | null
          next_action_date?: string | null
          owner_id?: string | null
          proposed_plan?: string | null
          qualification_notes?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "prospects_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "rep_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "rep_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_assignments_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      reps: {
        Row: {
          benchmark_stats: Json | null
          capabilities: string[]
          claimed_cash_collected: number | null
          community_waitlist: boolean
          created_at: string
          email: string
          evidence_source: string | null
          full_name: string
          geography: string | null
          id: string
          intro_loom_url: string | null
          is_benchmark: boolean
          is_demo: boolean
          linkedin_url: string | null
          notes: string | null
          offer_text: string | null
          phone: string | null
          profile_id: string | null
          recruiting_status: Database["public"]["Enums"]["recruiting_status"]
          resume_url: string | null
          sales_recording_url: string | null
          timezone: string | null
          updated_at: string
          verified_cash_collected: number | null
        }
        Insert: {
          benchmark_stats?: Json | null
          capabilities?: string[]
          claimed_cash_collected?: number | null
          community_waitlist?: boolean
          created_at?: string
          email: string
          evidence_source?: string | null
          full_name: string
          geography?: string | null
          id?: string
          intro_loom_url?: string | null
          is_benchmark?: boolean
          is_demo?: boolean
          linkedin_url?: string | null
          notes?: string | null
          offer_text?: string | null
          phone?: string | null
          profile_id?: string | null
          recruiting_status?: Database["public"]["Enums"]["recruiting_status"]
          resume_url?: string | null
          sales_recording_url?: string | null
          timezone?: string | null
          updated_at?: string
          verified_cash_collected?: number | null
        }
        Update: {
          benchmark_stats?: Json | null
          capabilities?: string[]
          claimed_cash_collected?: number | null
          community_waitlist?: boolean
          created_at?: string
          email?: string
          evidence_source?: string | null
          full_name?: string
          geography?: string | null
          id?: string
          intro_loom_url?: string | null
          is_benchmark?: boolean
          is_demo?: boolean
          linkedin_url?: string | null
          notes?: string | null
          offer_text?: string | null
          phone?: string | null
          profile_id?: string | null
          recruiting_status?: Database["public"]["Enums"]["recruiting_status"]
          resume_url?: string | null
          sales_recording_url?: string | null
          timezone?: string | null
          updated_at?: string
          verified_cash_collected?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reps_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rr_score_config: {
        Row: {
          configured: boolean
          configured_at: string | null
          configured_by: string | null
          created_at: string
          id: string
          updated_at: string
          version: number
          weight_call_quality: number
          weight_client_representation: number
          weight_consistency: number
          weight_follow_up_discipline: number
          weight_sales_performance: number
        }
        Insert: {
          configured?: boolean
          configured_at?: string | null
          configured_by?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          version?: number
          weight_call_quality?: number
          weight_client_representation?: number
          weight_consistency?: number
          weight_follow_up_discipline?: number
          weight_sales_performance?: number
        }
        Update: {
          configured?: boolean
          configured_at?: string | null
          configured_by?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          version?: number
          weight_call_quality?: number
          weight_client_representation?: number
          weight_consistency?: number
          weight_follow_up_discipline?: number
          weight_sales_performance?: number
        }
        Relationships: [
          {
            foreignKeyName: "rr_score_config_configured_by_fkey"
            columns: ["configured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_roles_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "user_roles_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_entries: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          is_demo: boolean
          ledger_entry_id: string | null
          paid_at: string | null
          payment_reference: string | null
          rep_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          ledger_entry_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          rep_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          ledger_entry_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          rep_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_entries_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_entries_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          client_id?: string | null
          fulfillment_breached?: never
          fulfillment_completed_at?: string | null
          fulfillment_deadline?: never
          go_live_breached?: never
          go_live_completed_at?: string | null
          go_live_deadline?: never
          signed_at?: string | null
        }
        Update: {
          client_id?: string | null
          fulfillment_breached?: never
          fulfillment_completed_at?: string | null
          fulfillment_deadline?: never
          go_live_breached?: never
          go_live_completed_at?: string | null
          go_live_deadline?: never
          signed_at?: string | null
        }
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
        Insert: {
          client_id?: string | null
          rep_assignment_id?: string | null
          rep_id?: string | null
          trial_review_due_at?: never
          trial_review_overdue?: never
          trial_reviewed_at?: string | null
          trial_started_at?: string | null
        }
        Update: {
          client_id?: string | null
          rep_assignment_id?: string | null
          rep_id?: string | null
          trial_review_due_at?: never
          trial_review_overdue?: never
          trial_reviewed_at?: string | null
          trial_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rep_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_clocks"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "rep_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_assignments_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      action_status:
        | "open"
        | "in_progress"
        | "waiting"
        | "done"
        | "snoozed"
        | "cancelled"
      app_role:
        | "founder"
        | "internal"
        | "closer"
        | "setter"
        | "finance"
        | "client"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      action_status: [
        "open",
        "in_progress",
        "waiting",
        "done",
        "snoozed",
        "cancelled",
      ],
      app_role: [
        "founder",
        "internal",
        "closer",
        "setter",
        "finance",
        "client",
      ],
      call_outcome: [
        "completed_won",
        "completed_follow_up",
        "completed_lost",
        "no_show",
        "cancelled",
        "rescheduled",
        "pending",
      ],
      client_lifecycle_state: [
        "onboarding",
        "access_pending",
        "fulfillment",
        "rep_training_trial",
        "live",
        "active",
        "paused",
        "churned",
      ],
      opportunity_stage: ["upstream", "booked", "follow_up", "won", "lost"],
      prospect_stage: [
        "lead",
        "interested",
        "call_booked",
        "call_completed",
        "follow_up",
        "agreement_sent",
        "signed",
        "no_show",
        "not_fit",
      ],
      recruiting_status: [
        "application",
        "screening",
        "interview",
        "talent_pool",
        "rejected",
        "available_for_matching",
        "selected",
        "client_training",
        "live_trial",
        "confirmed_active",
        "bench",
        "removed",
      ],
    },
  },
} as const
