'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function CreateTenantForm() {
  const router = useRouter()
  const [schemaName, setSchemaName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate schema name
  const validateSchemaName = (name: string): string | null => {
    if (!name) return 'Schema name is required'
    if (name.length < 3) return 'Schema name must be at least 3 characters'
    if (name.length > 63) return 'Schema name must be less than 63 characters'
    if (!/^[a-z]/.test(name)) return 'Schema name must start with a lowercase letter'
    if (!/^[a-z][a-z0-9_]*$/.test(name)) return 'Only lowercase letters, numbers, and underscores allowed'
    
    const reserved = ['public', 'auth', 'storage', 'graphql', 'realtime', 'supabase']
    if (reserved.includes(name) || name.startsWith('pg_')) {
      return 'This schema name is reserved'
    }
    
    return null
  }

  const handleSchemaNameChange = (value: string) => {
    // Convert to lowercase and replace invalid characters
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    setSchemaName(sanitized)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateSchemaName(schemaName)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaName,
          displayName: displayName || schemaName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create schema')
      }

      toast.success(`Schema "${schemaName}" created successfully!`)
      setSchemaName('')
      setDisplayName('')
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create New Schema
        </CardTitle>
        <CardDescription>
          Create a new database schema for a client or project
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Schema Name Input */}
          <div className="space-y-2">
            <Label htmlFor="schemaName">Schema Name *</Label>
            <Input
              id="schemaName"
              placeholder="client_acme"
              value={schemaName}
              onChange={e => handleSchemaNameChange(e.target.value)}
              className={`font-mono ${error ? 'border-destructive' : ''}`}
              disabled={isLoading}
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Lowercase letters, numbers, and underscores only
              </p>
            )}
          </div>

          {/* Display Name Input */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name (optional)</Label>
            <Input
              id="displayName"
              placeholder="Acme Corporation"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-sm text-muted-foreground">
              A friendly name for this schema
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !schemaName}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Schema...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Schema
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
