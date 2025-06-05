export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          created_at: string
          updated_at: string
          role: 'admin' | 'board_member' | 'secretary' | 'auditor' | 'guest'
          organization_id: string | null
          bank_id_reference: string | null
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          created_at?: string
          updated_at?: string
          role?: 'admin' | 'board_member' | 'secretary' | 'auditor' | 'guest'
          organization_id?: string | null
          bank_id_reference?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          created_at?: string
          updated_at?: string
          role?: 'admin' | 'board_member' | 'secretary' | 'auditor' | 'guest'
          organization_id?: string | null
          bank_id_reference?: string | null
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      meetings: {
        Row: {
          id: string
          title: string
          meeting_date: string
          meeting_type: 'physical' | 'digital'
          status: 'ongoing' | 'transcribing' | 'draft' | 'pending_signature' | 'completed'
          created_at: string
          updated_at: string
          organization_id: string
          created_by: string
        }
        Insert: {
          id?: string
          title: string
          meeting_date: string
          meeting_type: 'physical' | 'digital'
          status?: 'ongoing' | 'transcribing' | 'draft' | 'pending_signature' | 'completed'
          created_at?: string
          updated_at?: string
          organization_id: string
          created_by: string
        }
        Update: {
          id?: string
          title?: string
          meeting_date?: string
          meeting_type?: 'physical' | 'digital'
          status?: 'ongoing' | 'transcribing' | 'draft' | 'pending_signature' | 'completed'
          created_at?: string
          updated_at?: string
          organization_id?: string
          created_by?: string
        }
      }
      meeting_participants: {
        Row: {
          id: string
          meeting_id: string
          user_id: string
          role: 'chairman' | 'secretary' | 'participant' | 'observer'
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          role?: 'chairman' | 'secretary' | 'participant' | 'observer'
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string
          role?: 'chairman' | 'secretary' | 'participant' | 'observer'
          created_at?: string
        }
      }
      files: {
        Row: {
          id: string
          name: string
          file_type: 'audio' | 'transcript' | 'protocol'
          storage_path: string
          meeting_id: string
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          name: string
          file_type: 'audio' | 'transcript' | 'protocol'
          storage_path: string
          meeting_id: string
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          name?: string
          file_type?: 'audio' | 'transcript' | 'protocol'
          storage_path?: string
          meeting_id?: string
          created_at?: string
          updated_at?: string
          created_by?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          action: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'access' | 'sign'
          entity_type: 'user' | 'meeting' | 'file' | 'protocol'
          entity_id: string
          user_id: string
          details: Json
          created_at: string
          ip_address: string | null
        }
        Insert: {
          id?: string
          action: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'access' | 'sign'
          entity_type: 'user' | 'meeting' | 'file' | 'protocol'
          entity_id: string
          user_id: string
          details?: Json
          created_at?: string
          ip_address?: string | null
        }
        Update: {
          id?: string
          action?: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'access' | 'sign'
          entity_type?: 'user' | 'meeting' | 'file' | 'protocol'
          entity_id?: string
          user_id?: string
          details?: Json
          created_at?: string
          ip_address?: string | null
        }
      }
      signatures: {
        Row: {
          id: string
          protocol_id: string
          user_id: string
          signature_data: string
          signed_at: string
          bank_id_reference: string
          encryption_key_id: string | null
        }
        Insert: {
          id?: string
          protocol_id: string
          user_id: string
          signature_data: string
          signed_at?: string
          bank_id_reference: string
          encryption_key_id?: string | null
        }
        Update: {
          id?: string
          protocol_id?: string
          user_id?: string
          signature_data?: string
          signed_at?: string
          bank_id_reference?: string
          encryption_key_id?: string | null
        }
      }
      key_backups: {
        Row: {
          id: string
          user_id: string
          key_id: string
          encrypted_key: string
          metadata: Json
          master_key_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          key_id: string
          encrypted_key: string
          metadata: Json
          master_key_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          key_id?: string
          encrypted_key?: string
          metadata?: Json
          master_key_id?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
