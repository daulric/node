import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { UserNav } from '../components/user-nav'
import { AccessManagement } from './components/access-management'
import { Database, Users, ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface UserInfo {
  email: string
  isAdmin: boolean
  isSuperAdmin: boolean
  role: string | null
}

interface SchemaAccess {
  id: string
  user_id: string
  tenant_schema: string
  access_level: string
  granted_at: string
  expires_at: string | null
  user_email?: string
}

async function getUser(): Promise<UserInfo | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  const isAdmin = adminUser?.is_active === true
  const isSuperAdmin = adminUser?.role === 'super_admin' && adminUser?.is_active === true

  return {
    email: user.email || '',
    isAdmin,
    isSuperAdmin,
    role: adminUser?.role || null,
  }
}

async function getSchemaAccessList(): Promise<SchemaAccess[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('user_schema_access')
    .select('*')
    .order('granted_at', { ascending: false })

  if (error) {
    console.error('Error fetching access list:', error)
    return []
  }

  return data || []
}

async function getTenantSchemas(): Promise<string[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('tenants')
    .select('schema_name')
    .eq('status', 'active')
    .order('schema_name')

  if (error) {
    console.error('Error fetching schemas:', error)
    return []
  }

  return data?.map(t => t.schema_name) || []
}

export default async function AccessPage() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  if (!user.isAdmin) {
    redirect('/tenants')
  }

  const [accessList, schemas] = await Promise.all([
    getSchemaAccessList(),
    getTenantSchemas(),
  ])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Top Navigation */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold">Node</span>
            </div>
            <UserNav user={user} />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back Link */}
        <Link href="/tenants">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Nodes
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">User Access Control</h1>
            <Badge variant="secondary">{accessList.length} grants</Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Manage which users can access specific tenant schemas. Grant read, write, or admin 
            level access to users.
          </p>
        </div>

        <AccessManagement 
          initialAccessList={accessList} 
          schemas={schemas}
          isSuperAdmin={user.isSuperAdmin}
        />
      </div>
    </div>
  )
}

