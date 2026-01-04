import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { UserNav } from '../components/user-nav'
import { SchemaTableList } from './components/schema-table-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SchemaBucketsPanel } from './components/schema-buckets-panel'
import { 
  Database, 
  ArrowLeft, 
  Table2, 
  Shield,
  Calendar,
  HardDrive
} from 'lucide-react'
import { TenantStatus } from '@/types/database'

interface UserInfo {
  email: string
  isAdmin: boolean
  isSuperAdmin: boolean
  role: string | null
  userId: string
  avatarUrl?: string | null
}

interface SchemaTable {
  table_name: string
  column_count: number
  row_count: number
  table_size: string
  description: string | null
}

interface TenantInfo {
  id: string
  schema_name: string
  display_name: string | null
  status: TenantStatus
  created_at: string
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
    userId: user.id,
    avatarUrl: user.user_metadata?.avatar_url || null,
  }
}

async function getUserSchemaAccess(userId: string, schemaName: string): Promise<string> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('user_schema_access')
    .select('access_level')
    .eq('user_id', userId)
    .eq('tenant_schema', schemaName)
    .single()

  return data?.access_level || 'none'
}

async function getTenantInfo(schemaName: string): Promise<TenantInfo | null> {
  const supabase = await createClient()
  
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('schema_name', schemaName)
    .single()

  if (error || !tenant) return null

  return {
    ...tenant,
    status: tenant.status as TenantStatus,
  }
}

async function getSchemaTables(schemaName: string): Promise<SchemaTable[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_schema_tables', {
    target_schema: schemaName,
  })

  if (error) {
    console.error('Error fetching schema tables:', error)
    return []
  }

  return data || []
}

interface PageProps {
  params: Promise<{ schema: string }>
}

export default async function SchemaDetailPage({ params }: PageProps) {
  const { schema } = await params
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  const tenant = await getTenantInfo(schema)
  
  if (!tenant) {
    notFound()
  }

  const tables = await getSchemaTables(schema)
  
  // Get user's access level for this schema
  // Admins have full access, otherwise check user_schema_access
  const accessLevel = user.isAdmin ? 'admin' : await getUserSchemaAccess(user.userId, schema)
  
  // Check if user can write (write or admin access)
  const canWrite = accessLevel === 'write' || accessLevel === 'admin'

  // Calculate total size
  const totalSize = tables.reduce((acc, t) => {
    const match = t.table_size.match(/(\d+(?:\.\d+)?)\s*(bytes|kB|MB|GB)/i)
    if (!match) return acc
    const value = parseFloat(match[1])
    const unit = match[2].toLowerCase()
    const multipliers: Record<string, number> = { bytes: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 }
    return acc + value * (multipliers[unit] || 1)
  }, 0)

  const formatTotalSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} bytes`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

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
              <span className="font-semibold">Node Manager</span>
            </div>
            <UserNav user={user} />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back Link */}
        <Link href="/tenants">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Nodes
          </Button>
        </Link>

        {/* Schema Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight font-mono">
                  {tenant.schema_name}
                </h1>
                {tenant.display_name && tenant.display_name !== tenant.schema_name && (
                  <p className="text-muted-foreground">{tenant.display_name}</p>
                )}
              </div>
            </div>
            <Badge 
              variant={tenant.status === 'active' ? 'default' : 'secondary'}
              className="w-fit"
            >
              {tenant.status === 'active' ? (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Active
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Suspended
                </span>
              )}
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tables</CardTitle>
              <Table2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tables.length}</div>
              <p className="text-xs text-muted-foreground">Database tables</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Size</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTotalSize(totalSize)}</div>
              <p className="text-xs text-muted-foreground">Storage used</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Created</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{formatDate(tenant.created_at)}</div>
              <p className="text-xs text-muted-foreground">Schema creation date</p>
            </CardContent>
          </Card>
        </div>

        {/* Tables Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Tables</h2>
            <Badge variant="secondary">{tables.length} tables</Badge>
          </div>
          
          {user.isAdmin || tables.length > 0 ? (
            <SchemaTableList tables={tables} schemaName={schema} canWrite={canWrite} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  You don&apos;t have permission to view tables in this schema.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Storage Buckets */}
        <div className="mt-8">
          <SchemaBucketsPanel schemaName={schema} canManage={user.isAdmin} />
        </div>
      </div>
    </div>
  )
}
