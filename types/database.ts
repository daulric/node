export type TenantStatus = 'active' | 'suspended'
export type AdminRole = 'super_admin' | 'admin' | 'viewer'
export type AccessLevel = 'read' | 'write' | 'admin'

export interface Tenant {
  id: string
  schema_name: string
  display_name?: string | null
  status: TenantStatus
  created_by?: string | null
  created_at: string
  updated_at?: string | null
}

export interface TenantProduct {
  id: string
  tenant_schema: string
  product_name: string
  enabled: boolean
}

export interface TenantWithProducts extends Tenant {
  products: TenantProduct[]
}

export interface AdminUser {
  id: string
  email: string
  full_name?: string
  role: AdminRole
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface UserSchemaAccess {
  id: string
  user_id: string
  tenant_schema: string
  access_level: AccessLevel
  granted_by?: string
  granted_at: string
  expires_at?: string
}

export interface AuditLogEntry {
  id: string
  user_id?: string
  action: string
  resource_type: string
  resource_id?: string
  details?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
}

export const AVAILABLE_PRODUCTS = [
  { id: 'inventory', name: 'Inventory', description: 'Stock and warehouse management' },
  { id: 'crm', name: 'CRM', description: 'Customer relationship management' },
  { id: 'billing', name: 'Billing', description: 'Invoicing and payments' },
  { id: 'analytics', name: 'Analytics', description: 'Reports and dashboards' },
  { id: 'hr', name: 'HR', description: 'Human resources management' },
  { id: 'projects', name: 'Projects', description: 'Project and task management' },
] as const

export type ProductId = typeof AVAILABLE_PRODUCTS[number]['id']

// Database type for Supabase client
export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          id: string
          schema_name: string
          display_name: string | null
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          schema_name: string
          display_name?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          schema_name?: string
          display_name?: string | null
          status?: string
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenant_products: {
        Row: {
          id: string
          tenant_schema: string
          product_name: string
          enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant_schema: string
          product_name: string
          enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tenant_schema?: string
          product_name?: string
          enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tenant_products_tenant_schema_fkey"
            columns: ["tenant_schema"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["schema_name"]
          }
        ]
      }
      user_schema_access: {
        Row: {
          id: string
          user_id: string
          tenant_schema: string
          access_level: string
          granted_by: string | null
          granted_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          tenant_schema: string
          access_level?: string
          granted_by?: string | null
          granted_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          tenant_schema?: string
          access_level?: string
          granted_by?: string | null
          granted_at?: string
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_schema_access_tenant_schema_fkey"
            columns: ["tenant_schema"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["schema_name"]
          }
        ]
      }
      admin_audit_log: {
        Row: {
          id: string
          user_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          details: Record<string, unknown> | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          details?: Record<string, unknown> | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          resource_type?: string
          resource_id?: string | null
          details?: Record<string, unknown> | null
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      has_schema_access: {
        Args: {
          schema_name: string
          required_level?: string
        }
        Returns: boolean
      }
      get_current_user_info: {
        Args: Record<string, never>
        Returns: {
          user_id: string
          email: string
          is_admin: boolean
          is_super_admin: boolean
          admin_role: string | null
          accessible_schemas: Record<string, unknown>[] | null
        }[]
      }
      get_user_by_email: {
        Args: {
          target_email: string
        }
        Returns: {
          id: string
          email: string
        }[]
      }
      list_users: {
        Args: Record<string, never>
        Returns: {
          id: string
          email: string
          created_at: string
          is_admin: boolean
          admin_role: string | null
        }[]
      }
      create_tenant_schema: {
        Args: {
          p_schema_name: string
          p_display_name?: string | null
        }
        Returns: string
      }
      suspend_tenant: {
        Args: {
          schema_name: string
        }
        Returns: undefined
      }
      activate_tenant: {
        Args: {
          schema_name: string
        }
        Returns: undefined
      }
      delete_tenant_schema: {
        Args: {
          schema_name: string
        }
        Returns: undefined
      }
      grant_schema_access: {
        Args: {
          target_user_id: string
          target_schema: string
          access_level?: string
          expires_at?: string | null
        }
        Returns: string
      }
      revoke_schema_access: {
        Args: {
          target_user_id: string
          target_schema: string
        }
        Returns: undefined
      }
      promote_to_admin: {
        Args: {
          target_user_id: string
          admin_role?: string
        }
        Returns: undefined
      }
      revoke_admin: {
        Args: {
          target_user_id: string
        }
        Returns: undefined
      }
      get_schema_tables: {
        Args: {
          target_schema: string
        }
        Returns: {
          table_name: string
          column_count: number
          row_count: number
          table_size: string
          description: string | null
        }[]
      }
      get_table_columns: {
        Args: {
          target_schema: string
          target_table: string
        }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: boolean
          column_default: string | null
          is_primary_key: boolean
        }[]
      }
      get_table_row_count: {
        Args: {
          target_schema: string
          target_table: string
        }
        Returns: number
      }
      get_table_foreign_keys: {
        Args: {
          target_schema: string
          target_table: string
        }
        Returns: {
          constraint_name: string
          column_name: string
          foreign_schema: string
          foreign_table: string
          foreign_column: string
          on_update: string
          on_delete: string
        }[]
      }
      get_schema_foreign_keys: {
        Args: {
          target_schema: string
        }
        Returns: {
          source_table: string
          source_column: string
          target_table: string
          target_column: string
          constraint_name: string
        }[]
      }
      create_table: {
        Args: {
          target_schema: string
          table_name: string
          columns: Record<string, unknown>[]
        }
        Returns: undefined
      }
      add_column: {
        Args: {
          target_schema: string
          target_table: string
          column_name: string
          column_type: string
          is_nullable?: boolean
          default_value?: string | null
        }
        Returns: undefined
      }
      add_foreign_key: {
        Args: {
          target_schema: string
          target_table: string
          column_name: string
          ref_schema: string
          ref_table: string
          ref_column: string
          on_delete?: string
          on_update?: string
        }
        Returns: undefined
      }
      drop_column: {
        Args: {
          target_schema: string
          target_table: string
          column_name: string
        }
        Returns: undefined
      }
      get_reference_tables: {
        Args: {
          target_schema: string
        }
        Returns: {
          schema_name: string
          table_name: string
          display_name: string
        }[]
      }
      get_table_pk_columns: {
        Args: {
          target_schema: string
          target_table: string
        }
        Returns: {
          column_name: string
          data_type: string
        }[]
      }
      drop_foreign_key: {
        Args: {
          target_schema: string
          target_table: string
          constraint_name: string
        }
        Returns: undefined
      }
      drop_table: {
        Args: {
          target_schema: string
          target_table: string
          force_cascade?: boolean
        }
        Returns: undefined
      }
      check_tenant_status: {
        Args: {
          p_schema: string
        }
        Returns: string | null
      }
      get_tenant_info: {
        Args: {
          p_schema: string
        }
        Returns: {
          schema_name: string
          display_name: string
          status: string
          created_at: string
        }[]
      }
      ensure_user_profile: {
        Args: {
          target_schema: string
          user_name?: string | null
        }
        Returns: {
          id: string
          auth_user_id: string
          email: string
          name: string | null
          role: string
          metadata: Record<string, unknown>
          created_at: string
          is_new: boolean
        }[]
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
