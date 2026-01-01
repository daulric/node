'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TenantWithProducts, TenantStatus } from '@/types/database'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Input } from '@/components/ui/input'
import {
  Database,
  MoreHorizontal,
  Power,
  PowerOff,
  Trash2,
  Search,
  Filter,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'

interface TenantTableProps {
  initialTenants: TenantWithProducts[]
}

export function TenantTable({ initialTenants }: TenantTableProps) {
  const [tenants, setTenants] = useState<TenantWithProducts[]>(initialTenants)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<TenantStatus | 'all'>('all')
  const [isLoading, setIsLoading] = useState<string | null>(null)
  
  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; schema: string | null }>({
    open: false,
    schema: null,
  })

  // Filter tenants based on search and status
  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.schema_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Handle suspend/activate
  const handleStatusChange = async (schema: string, action: 'suspend' | 'activate') => {
    setIsLoading(schema)
    try {
      const response = await fetch(`/api/tenants/${schema}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `Failed to ${action} schema`)
      }

      setTenants(prev =>
        prev.map(t =>
          t.schema_name === schema
            ? { ...t, status: action === 'suspend' ? 'suspended' : 'active' }
            : t
        )
      )
      
      toast.success(`Schema ${action === 'suspend' ? 'suspended' : 'activated'} successfully`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(null)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    const schema = deleteDialog.schema
    if (!schema) return

    setIsLoading(schema)
    setDeleteDialog({ open: false, schema: null })

    try {
      const response = await fetch(`/api/tenants/${schema}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete schema')
      }

      setTenants(prev => prev.filter(t => t.schema_name !== schema))
      toast.success('Schema deleted successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search schemas..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Filter className="mr-2 h-4 w-4" />
              {statusFilter === 'all' ? 'All Status' : statusFilter === 'active' ? 'Active' : 'Suspended'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
              All Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('active')}>
              Active
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('suspended')}>
              Suspended
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Schema Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No schemas match your filters.'
                    : 'No schemas found. Create your first schema above.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredTenants.map(tenant => (
                <TableRow key={tenant.id} className={isLoading === tenant.schema_name ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">
                    <Link 
                      href={`/tenants/${tenant.schema_name}`}
                      className="flex items-center gap-2 hover:text-primary transition-colors group"
                    >
                      <Database className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      <span className="font-mono text-sm">{tenant.schema_name}</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    {tenant.display_name && tenant.display_name !== tenant.schema_name && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                        {tenant.display_name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
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
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatDate(tenant.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isLoading === tenant.schema_name}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/tenants/${tenant.schema_name}`}>
                            <Database className="mr-2 h-4 w-4" />
                            View Tables
                          </Link>
                        </DropdownMenuItem>
                        {tenant.status === 'active' ? (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(tenant.schema_name, 'suspend')}
                          >
                            <PowerOff className="mr-2 h-4 w-4" />
                            Suspend Access
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(tenant.schema_name, 'activate')}
                          >
                            <Power className="mr-2 h-4 w-4" />
                            Reactivate Access
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteDialog({ open: true, schema: tenant.schema_name })}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Schema
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={open => setDeleteDialog({ open, schema: deleteDialog.schema })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schema</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the schema{' '}
              <span className="font-mono font-semibold text-foreground">{deleteDialog.schema}</span>?
              This action cannot be undone. All tables and data in this schema will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
