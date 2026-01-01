'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, UserPlus, Loader2, Shield, Eye, Pencil } from 'lucide-react'
import { toast } from 'sonner'

interface SchemaAccess {
  id: string
  user_id: string
  tenant_schema: string
  access_level: string
  granted_at: string
  expires_at: string | null
  user_email?: string
}

interface AccessManagementProps {
  initialAccessList: SchemaAccess[]
  schemas: string[]
  isSuperAdmin: boolean
}

const ACCESS_LEVELS = [
  { value: 'read', label: 'Read', description: 'View data only', icon: Eye },
  { value: 'write', label: 'Write', description: 'Create, update, delete data', icon: Pencil },
  { value: 'admin', label: 'Admin', description: 'Full control including user management', icon: Shield },
]

export function AccessManagement({ initialAccessList, schemas, isSuperAdmin }: AccessManagementProps) {
  const router = useRouter()
  const [accessList, setAccessList] = useState<SchemaAccess[]>(initialAccessList)
  const [isLoading, setIsLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; access: SchemaAccess | null }>({
    open: false,
    access: null,
  })

  // Form state
  const [userEmail, setUserEmail] = useState('')
  const [selectedSchema, setSelectedSchema] = useState('')
  const [accessLevel, setAccessLevel] = useState('read')

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()

      // First, find the user by email
      const { data: users, error: userError } = await supabase
        .rpc('get_user_by_email', { target_email: userEmail })

      if (userError || !users || users.length === 0) {
        toast.error('User not found. Make sure they have signed up first.')
        return
      }

      const userId = users[0].id

      // Grant access via RPC
      const { error } = await supabase.rpc('grant_schema_access', {
        target_user_id: userId,
        target_schema: selectedSchema,
        access_level: accessLevel,
      })

      if (error) throw error

      toast.success(`Access granted to ${userEmail}`)
      setDialogOpen(false)
      setUserEmail('')
      setSelectedSchema('')
      setAccessLevel('read')
      router.refresh()
    } catch (error) {
      console.error('Grant access error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to grant access')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevokeAccess = async () => {
    const access = deleteDialog.access
    if (!access) return

    setIsLoading(true)
    setDeleteDialog({ open: false, access: null })

    try {
      const supabase = createClient()

      const { error } = await supabase.rpc('revoke_schema_access', {
        target_user_id: access.user_id,
        target_schema: access.tenant_schema,
      })

      if (error) throw error

      setAccessList(prev => prev.filter(a => a.id !== access.id))
      toast.success('Access revoked successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke access')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getAccessBadge = (level: string) => {
    switch (level) {
      case 'admin':
        return <Badge className="bg-purple-500/20 text-purple-700 border-purple-500/30">Admin</Badge>
      case 'write':
        return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">Write</Badge>
      default:
        return <Badge variant="secondary">Read</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Grant Access Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Grant Schema Access
          </CardTitle>
          <CardDescription>
            Give users access to specific tenant schemas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Grant Access
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleGrantAccess}>
                <DialogHeader>
                  <DialogTitle>Grant Schema Access</DialogTitle>
                  <DialogDescription>
                    Enter the user&apos;s email and select the schema and access level.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">User Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schema">Schema</Label>
                    <Select value={selectedSchema} onValueChange={setSelectedSchema} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a schema" />
                      </SelectTrigger>
                      <SelectContent>
                        {schemas.map(schema => (
                          <SelectItem key={schema} value={schema}>
                            {schema}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Access Level</Label>
                    <div className="grid gap-2">
                      {ACCESS_LEVELS.map(level => (
                        <label
                          key={level.value}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            accessLevel === level.value 
                              ? 'border-primary bg-primary/5' 
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="accessLevel"
                            value={level.value}
                            checked={accessLevel === level.value}
                            onChange={(e) => setAccessLevel(e.target.value)}
                            className="sr-only"
                          />
                          <level.icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{level.label}</p>
                            <p className="text-sm text-muted-foreground">{level.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading || !userEmail || !selectedSchema}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Granting...
                      </>
                    ) : (
                      'Grant Access'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Access List Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>Schema</TableHead>
              <TableHead>Access Level</TableHead>
              <TableHead className="hidden md:table-cell">Granted</TableHead>
              <TableHead className="hidden md:table-cell">Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accessList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No access grants found. Use the button above to grant access.
                </TableCell>
              </TableRow>
            ) : (
              accessList.map(access => (
                <TableRow key={access.id}>
                  <TableCell className="font-mono text-xs">
                    {access.user_email || access.user_id.slice(0, 8) + '...'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {access.tenant_schema}
                  </TableCell>
                  <TableCell>
                    {getAccessBadge(access.access_level)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatDate(access.granted_at)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {access.expires_at ? formatDate(access.expires_at) : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteDialog({ open: true, access })}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => setDeleteDialog({ open, access: deleteDialog.access })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke access to{' '}
              <span className="font-mono font-semibold">{deleteDialog.access?.tenant_schema}</span>
              {' '}for this user? They will no longer be able to access this schema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeAccess}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

