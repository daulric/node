import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { TenantStatus } from '@/types/database'

// POST /api/tenants - Create a new schema
export async function POST(request: NextRequest) {
  try {
    const { schemaName, displayName } = await request.json()

    // Validate schema name
    const schemaNameRegex = /^[a-z][a-z0-9_]*$/
    if (!schemaName || !schemaNameRegex.test(schemaName)) {
      return NextResponse.json(
        { error: 'Invalid schema name. Must be lowercase, start with a letter, and contain only letters, numbers, and underscores.' },
        { status: 400 }
      )
    }

    if (schemaName.length < 3 || schemaName.length > 63) {
      return NextResponse.json(
        { error: 'Schema name must be between 3 and 63 characters.' },
        { status: 400 }
      )
    }

    // Reserved schema names
    const reserved = ['public', 'auth', 'storage', 'graphql', 'realtime', 'supabase', 'pg_', 'information_schema']
    if (reserved.some(r => schemaName.startsWith(r) || schemaName === r)) {
      return NextResponse.json(
        { error: 'This schema name is reserved and cannot be used.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if schema already exists
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('schema_name', schemaName)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'A schema with this name already exists.' },
        { status: 409 }
      )
    }

    // Call RPC to create schema
    const { error: rpcError } = await supabase.rpc('create_tenant_schema', {
      p_schema_name: schemaName,
      p_display_name: displayName || null,
    })

    if (rpcError) {
      console.error('RPC error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message || 'Failed to create schema.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Schema created successfully', schemaName },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create schema error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

// GET /api/tenants - List all schemas
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })

    if (tenantsError) {
      console.error('Fetch schemas error:', tenantsError)
      return NextResponse.json(
        { error: 'Failed to fetch schemas.' },
        { status: 500 }
      )
    }

    // Map to include proper status type
    const tenantsWithStatus = tenants.map(tenant => ({
      ...tenant,
      status: tenant.status as TenantStatus,
      products: [], // Keep for backward compatibility
    }))

    return NextResponse.json(tenantsWithStatus)
  } catch (error) {
    console.error('List schemas error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
