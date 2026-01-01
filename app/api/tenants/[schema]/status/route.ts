import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ schema: string }>
}

// PATCH /api/tenants/[schema]/status - Suspend or activate a tenant
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { schema } = await params
    const { action } = await request.json()

    if (!['suspend', 'activate'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "suspend" or "activate".' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify tenant exists
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('id, status')
      .eq('schema_name', schema)
      .single()

    if (fetchError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found.' },
        { status: 404 }
      )
    }

    // Check if already in desired state
    const newStatus = action === 'suspend' ? 'suspended' : 'active'
    if (tenant.status === newStatus) {
      return NextResponse.json(
        { error: `Tenant is already ${newStatus}.` },
        { status: 400 }
      )
    }

    // Call appropriate RPC function
    const rpcFunction = action === 'suspend' ? 'suspend_tenant' : 'activate_tenant'
    const { error: rpcError } = await supabase.rpc(rpcFunction, {
      schema_name: schema,
    })

    if (rpcError) {
      console.error('RPC error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message || `Failed to ${action} tenant.` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Tenant ${action === 'suspend' ? 'suspended' : 'activated'} successfully.`,
      status: newStatus,
    })
  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

