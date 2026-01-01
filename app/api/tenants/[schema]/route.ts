import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ schema: string }>
}

// DELETE /api/tenants/[schema] - Delete a tenant schema permanently
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { schema } = await params

    const supabase = await createClient()

    // Verify tenant exists
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('id')
      .eq('schema_name', schema)
      .single()

    if (fetchError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found.' },
        { status: 404 }
      )
    }

    // Call RPC to delete schema (CASCADE)
    const { error: rpcError } = await supabase.rpc('delete_tenant_schema', {
      schema_name: schema,
    })

    if (rpcError) {
      console.error('RPC error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message || 'Failed to delete tenant schema.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Tenant schema deleted successfully.',
    })
  } catch (error) {
    console.error('Delete tenant error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

