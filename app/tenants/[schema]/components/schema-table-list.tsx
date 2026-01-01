'use client'

import { useState, useEffect } from 'react'
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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Table2, 
  ChevronDown, 
  ChevronRight, 
  Columns3, 
  HardDrive,
  Key,
  Loader2,
  Hash,
  ToggleLeft,
  Plus,
  Link2,
  ArrowRight,
  Trash2,
  X
} from 'lucide-react'
import { toast } from 'sonner'

interface SchemaTable {
  table_name: string
  column_count: number
  row_count: number
  table_size: string
  description: string | null
}

interface TableColumn {
  column_name: string
  data_type: string
  is_nullable: boolean
  column_default: string | null
  is_primary_key: boolean
}

interface ForeignKey {
  constraint_name: string
  column_name: string
  foreign_schema: string
  foreign_table: string
  foreign_column: string
  on_update: string
  on_delete: string
}

interface ReferenceTable {
  schema_name: string
  table_name: string
  display_name: string
}

interface PkColumn {
  column_name: string
  data_type: string
}

interface NewColumnDef {
  id: string
  name: string
  type: string
  nullable: boolean
  default: string
  primary_key: boolean
  // Foreign key
  fk_schema?: string
  fk_table?: string
  fk_column?: string
  fk_on_delete?: string
}

interface SchemaTableListProps {
  tables: SchemaTable[]
  schemaName: string
}

const DATA_TYPES = [
  { value: 'uuid', label: 'UUID' },
  { value: 'text', label: 'Text' },
  { value: 'varchar(255)', label: 'Varchar(255)' },
  { value: 'integer', label: 'Integer' },
  { value: 'bigint', label: 'BigInt' },
  { value: 'serial', label: 'Serial (auto-increment)' },
  { value: 'bigserial', label: 'BigSerial (auto-increment)' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'timestamp with time zone', label: 'Timestamp' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'jsonb', label: 'JSONB' },
  { value: 'json', label: 'JSON' },
  { value: 'bytea', label: 'Bytea (binary)' },
]

const ON_DELETE_OPTIONS = [
  { value: 'NO ACTION', label: 'No Action' },
  { value: 'RESTRICT', label: 'Restrict' },
  { value: 'CASCADE', label: 'Cascade (delete related)' },
  { value: 'SET NULL', label: 'Set Null' },
  { value: 'SET DEFAULT', label: 'Set Default' },
]

const createEmptyColumn = (): NewColumnDef => ({
  id: crypto.randomUUID(),
  name: '',
  type: 'text',
  nullable: true,
  default: '',
  primary_key: false,
})

export function SchemaTableList({ tables: initialTables, schemaName }: SchemaTableListProps) {
  const router = useRouter()
  const [tables, setTables] = useState(initialTables)
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [columns, setColumns] = useState<Record<string, TableColumn[]>>({})
  const [foreignKeys, setForeignKeys] = useState<Record<string, ForeignKey[]>>({})
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState<string | null>(null)
  
  // Reference tables for foreign keys
  const [referenceTables, setReferenceTables] = useState<ReferenceTable[]>([])
  const [refTableColumns, setRefTableColumns] = useState<PkColumn[]>([])
  const [loadingRefColumns, setLoadingRefColumns] = useState(false)
  
  // Add column dialog
  const [addColumnDialog, setAddColumnDialog] = useState<{ open: boolean; table: string | null }>({
    open: false,
    table: null,
  })
  const [newColumn, setNewColumn] = useState({
    name: '',
    type: 'text',
    nullable: true,
    default: '',
  })
  const [isAdding, setIsAdding] = useState(false)

  // Create table dialog
  const [createTableDialog, setCreateTableDialog] = useState(false)
  const [newTableName, setNewTableName] = useState('')
  const [newTableColumns, setNewTableColumns] = useState<NewColumnDef[]>([
    { ...createEmptyColumn(), name: 'id', type: 'uuid', nullable: false, primary_key: true, default: 'gen_random_uuid()' },
    { ...createEmptyColumn(), name: 'created_at', type: 'timestamp with time zone', nullable: false, default: 'NOW()' },
  ])
  const [isCreatingTable, setIsCreatingTable] = useState(false)

  // Add foreign key dialog
  const [addFkDialog, setAddFkDialog] = useState<{ open: boolean; table: string | null; column: string | null }>({
    open: false,
    table: null,
    column: null,
  })
  const [newFk, setNewFk] = useState({
    refSchema: '',
    refTable: '',
    refColumn: '',
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  const [isAddingFk, setIsAddingFk] = useState(false)

  // Load reference tables when dialog opens
  useEffect(() => {
    if ((addFkDialog.open || createTableDialog) && referenceTables.length === 0) {
      loadReferenceTables()
    }
  }, [addFkDialog.open, createTableDialog])

  // Load columns when reference table changes
  useEffect(() => {
    if (newFk.refSchema && newFk.refTable) {
      loadRefTableColumns(newFk.refSchema, newFk.refTable)
    } else {
      setRefTableColumns([])
    }
  }, [newFk.refSchema, newFk.refTable])

  const loadReferenceTables = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_reference_tables', {
        target_schema: schemaName,
      })
      if (error) throw error
      setReferenceTables(data || [])
    } catch (error) {
      console.error('Error loading reference tables:', error)
    }
  }

  const loadRefTableColumns = async (schema: string, table: string) => {
    setLoadingRefColumns(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_table_pk_columns', {
        target_schema: schema,
        target_table: table,
      })
      if (error) throw error
      setRefTableColumns(data || [])
      
      // Auto-select first column if available
      if (data && data.length > 0) {
        setNewFk(prev => ({ ...prev, refColumn: data[0].column_name }))
      }
    } catch (error) {
      console.error('Error loading ref table columns:', error)
      setRefTableColumns([])
    } finally {
      setLoadingRefColumns(false)
    }
  }

  const toggleTable = async (tableName: string) => {
    if (expandedTables.has(tableName)) {
      setExpandedTables(prev => {
        const next = new Set(prev)
        next.delete(tableName)
        return next
      })
      return
    }

    if (columns[tableName]) {
      setExpandedTables(prev => new Set(prev).add(tableName))
      return
    }

    setLoading(tableName)
    try {
      const supabase = createClient()
      
      const [columnsResult, countResult, fkResult] = await Promise.all([
        supabase.rpc('get_table_columns', {
          target_schema: schemaName,
          target_table: tableName,
        }),
        supabase.rpc('get_table_row_count', {
          target_schema: schemaName,
          target_table: tableName,
        }),
        supabase.rpc('get_table_foreign_keys', {
          target_schema: schemaName,
          target_table: tableName,
        }),
      ])

      if (columnsResult.error) throw columnsResult.error

      if (columnsResult.data) {
        setColumns(prev => ({ ...prev, [tableName]: columnsResult.data }))
      }
      
      if (countResult.data !== null) {
        setRowCounts(prev => ({ ...prev, [tableName]: countResult.data }))
      }

      if (fkResult.data) {
        setForeignKeys(prev => ({ ...prev, [tableName]: fkResult.data }))
      }

      setExpandedTables(prev => new Set(prev).add(tableName))
    } catch (error) {
      console.error('Error loading table details:', error)
      toast.error('Failed to load table details')
    } finally {
      setLoading(null)
    }
  }

  const handleAddColumn = async () => {
    if (!addColumnDialog.table || !newColumn.name || !newColumn.type) return

    setIsAdding(true)
    try {
      const supabase = createClient()
      
      const { error } = await supabase.rpc('add_column', {
        target_schema: schemaName,
        target_table: addColumnDialog.table,
        column_name: newColumn.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        column_type: newColumn.type,
        is_nullable: newColumn.nullable,
        default_value: newColumn.default || null,
      })

      if (error) throw error

      // Refresh columns
      const { data } = await supabase.rpc('get_table_columns', {
        target_schema: schemaName,
        target_table: addColumnDialog.table,
      })

      if (data) {
        setColumns(prev => ({ ...prev, [addColumnDialog.table!]: data }))
      }

      toast.success(`Column "${newColumn.name}" added successfully`)
      setAddColumnDialog({ open: false, table: null })
      setNewColumn({ name: '', type: 'text', nullable: true, default: '' })
    } catch (error) {
      console.error('Error adding column:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add column')
    } finally {
      setIsAdding(false)
    }
  }

  const handleCreateTable = async () => {
    if (!newTableName || newTableColumns.length === 0) return

    const validColumns = newTableColumns.filter(col => col.name.trim())
    if (validColumns.length === 0) {
      toast.error('Please add at least one column with a name')
      return
    }

    setIsCreatingTable(true)
    try {
      const supabase = createClient()
      const tableName = newTableName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      
      const columnsPayload = validColumns.map(col => ({
        name: col.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        type: col.type,
        nullable: col.nullable,
        default: col.default || null,
        primary_key: col.primary_key,
      }))

      const { error } = await supabase.rpc('create_table', {
        target_schema: schemaName,
        table_name: tableName,
        columns: columnsPayload,
      })

      if (error) throw error

      // Add foreign keys for columns that have them defined
      const fkColumns = validColumns.filter(col => col.fk_schema && col.fk_table && col.fk_column)
      for (const col of fkColumns) {
        const { error: fkError } = await supabase.rpc('add_foreign_key', {
          target_schema: schemaName,
          target_table: tableName,
          column_name: col.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          ref_schema: col.fk_schema!,
          ref_table: col.fk_table!,
          ref_column: col.fk_column!,
          on_delete: col.fk_on_delete || 'NO ACTION',
          on_update: 'NO ACTION',
        })
        if (fkError) {
          console.error('Error adding foreign key:', fkError)
          toast.error(`Table created but failed to add FK for ${col.name}: ${fkError.message}`)
        }
      }

      toast.success(`Table "${newTableName}" created successfully${fkColumns.length > 0 ? ` with ${fkColumns.length} foreign key(s)` : ''}`)
      setCreateTableDialog(false)
      setNewTableName('')
      setNewTableColumns([
        { ...createEmptyColumn(), name: 'id', type: 'uuid', nullable: false, primary_key: true, default: 'gen_random_uuid()' },
        { ...createEmptyColumn(), name: 'created_at', type: 'timestamp with time zone', nullable: false, default: 'NOW()' },
      ])
      
      // Refresh the tables list
      router.refresh()
    } catch (error) {
      console.error('Error creating table:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create table')
    } finally {
      setIsCreatingTable(false)
    }
  }

  const handleAddForeignKey = async () => {
    if (!addFkDialog.table || !addFkDialog.column || !newFk.refSchema || !newFk.refTable || !newFk.refColumn) return

    setIsAddingFk(true)
    try {
      const supabase = createClient()
      
      const { error } = await supabase.rpc('add_foreign_key', {
        target_schema: schemaName,
        target_table: addFkDialog.table,
        column_name: addFkDialog.column,
        ref_schema: newFk.refSchema,
        ref_table: newFk.refTable,
        ref_column: newFk.refColumn,
        on_delete: newFk.onDelete,
        on_update: newFk.onUpdate,
      })

      if (error) throw error

      // Refresh foreign keys
      const { data } = await supabase.rpc('get_table_foreign_keys', {
        target_schema: schemaName,
        target_table: addFkDialog.table,
      })

      if (data) {
        setForeignKeys(prev => ({ ...prev, [addFkDialog.table!]: data }))
      }

      toast.success(`Foreign key added: ${addFkDialog.column} → ${newFk.refTable}.${newFk.refColumn}`)
      setAddFkDialog({ open: false, table: null, column: null })
      setNewFk({ refSchema: '', refTable: '', refColumn: '', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
    } catch (error) {
      console.error('Error adding foreign key:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add foreign key')
    } finally {
      setIsAddingFk(false)
    }
  }

  const handleDropForeignKey = async (tableName: string, constraintName: string) => {
    if (!confirm(`Are you sure you want to remove this foreign key constraint?`)) return

    try {
      const supabase = createClient()
      
      const { error } = await supabase.rpc('drop_foreign_key', {
        target_schema: schemaName,
        target_table: tableName,
        constraint_name: constraintName,
      })

      if (error) throw error

      // Refresh foreign keys
      const { data } = await supabase.rpc('get_table_foreign_keys', {
        target_schema: schemaName,
        target_table: tableName,
      })

      setForeignKeys(prev => ({ ...prev, [tableName]: data || [] }))
      toast.success('Foreign key removed')
    } catch (error) {
      console.error('Error removing foreign key:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove foreign key')
    }
  }

  const addNewColumnRow = () => {
    setNewTableColumns([...newTableColumns, createEmptyColumn()])
  }

  const removeColumnRow = (id: string) => {
    if (newTableColumns.length <= 1) return
    setNewTableColumns(newTableColumns.filter(col => col.id !== id))
  }

  const updateColumnRow = (id: string, updates: Partial<NewColumnDef>) => {
    setNewTableColumns(newTableColumns.map(col => 
      col.id === id ? { ...col, ...updates } : col
    ))
  }

  const handleRefTableChange = (value: string) => {
    const refTable = referenceTables.find(t => `${t.schema_name}.${t.table_name}` === value)
    if (refTable) {
      setNewFk(prev => ({
        ...prev,
        refSchema: refTable.schema_name,
        refTable: refTable.table_name,
        refColumn: '',
      }))
    }
  }

  const getDataTypeBadge = (dataType: string) => {
    const typeColors: Record<string, string> = {
      'uuid': 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
      'text': 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
      'character': 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
      'varchar': 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
      'integer': 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
      'bigint': 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
      'smallint': 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
      'numeric': 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
      'decimal': 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
      'real': 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
      'double': 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
      'serial': 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
      'boolean': 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
      'timestamp': 'bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30',
      'date': 'bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30',
      'time': 'bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30',
      'jsonb': 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
      'json': 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
      'array': 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
      'bytea': 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30',
    }

    const lowerType = dataType.toLowerCase()
    const colorClass = Object.entries(typeColors).find(([key]) => 
      lowerType.includes(key)
    )?.[1] || 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30'

    return (
      <Badge variant="outline" className={`font-mono text-xs ${colorClass}`}>
        {dataType}
      </Badge>
    )
  }

  const getForeignKeyForColumn = (tableName: string, columnName: string): ForeignKey | undefined => {
    return foreignKeys[tableName]?.find(fk => fk.column_name === columnName)
  }

  return (
    <>
      {/* Header with Create Table button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {tables.length} {tables.length === 1 ? 'table' : 'tables'}
          </Badge>
        </div>
        <Button onClick={() => setCreateTableDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Table
        </Button>
      </div>

      {tables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Table2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No tables found in this schema.</p>
            <Button onClick={() => setCreateTableDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Table
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tables.map(table => {
            const isExpanded = expandedTables.has(table.table_name)
            const isLoading = loading === table.table_name
            const tableColumns = columns[table.table_name]
            const tableForeignKeys = foreignKeys[table.table_name]
            const tableRowCount = rowCounts[table.table_name]

            return (
              <div key={table.table_name} className="rounded-lg border bg-card overflow-hidden">
                {/* Table Header Row */}
                <button
                  onClick={() => toggleTable(table.table_name)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="shrink-0">
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Table2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-mono font-medium truncate">{table.table_name}</span>
                  </div>

                  <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                    <div className="flex items-center gap-1">
                      <Columns3 className="h-3.5 w-3.5" />
                      <span>{table.column_count} cols</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" />
                      <span>
                        {tableRowCount !== undefined 
                          ? tableRowCount.toLocaleString() + ' rows'
                          : '—'
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3.5 w-3.5" />
                      <span>{table.table_size}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && tableColumns && (
                  <div className="border-t bg-muted/20">
                    <div className="p-4">
                      {/* Header with actions */}
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Columns3 className="h-4 w-4" />
                          Columns
                        </h4>
                        <div className="flex gap-2">
                          <Badge variant="secondary">
                            {tableColumns.length} columns
                          </Badge>
                          {tableRowCount !== undefined && (
                            <Badge variant="outline">
                              {tableRowCount.toLocaleString()} rows
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              setAddColumnDialog({ open: true, table: table.table_name })
                            }}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add Column
                          </Button>
                        </div>
                      </div>

                      {/* Columns Table */}
                      <div className="rounded-md border overflow-hidden bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8"></TableHead>
                              <TableHead>Column Name</TableHead>
                              <TableHead>Data Type</TableHead>
                              <TableHead className="hidden sm:table-cell">Nullable</TableHead>
                              <TableHead className="hidden md:table-cell">Default</TableHead>
                              <TableHead className="hidden lg:table-cell">Foreign Key</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tableColumns.map((col, idx) => {
                              const fk = getForeignKeyForColumn(table.table_name, col.column_name)
                              return (
                                <TableRow key={col.column_name}>
                                  <TableCell className="text-muted-foreground text-xs">
                                    {idx + 1}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {col.is_primary_key && (
                                        <Key className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                      )}
                                      {fk && !col.is_primary_key && (
                                        <Link2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      )}
                                      <span className="font-mono text-sm font-medium">
                                        {col.column_name}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {getDataTypeBadge(col.data_type)}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    {col.is_nullable ? (
                                      <Badge variant="outline" className="text-xs">
                                        <ToggleLeft className="h-3 w-3 mr-1" />
                                        NULL
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-xs">
                                        NOT NULL
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell max-w-[200px]">
                                    {col.column_default ? (
                                      <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                                        {col.column_default}
                                      </code>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden lg:table-cell">
                                    {fk ? (
                                      <div className="flex items-center gap-1 text-xs">
                                        <ArrowRight className="h-3 w-3 text-blue-500" />
                                        <span className="font-mono text-blue-600 dark:text-blue-400">
                                          {fk.foreign_schema !== schemaName && `${fk.foreign_schema}.`}
                                          {fk.foreign_table}.{fk.foreign_column}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {!fk && !col.is_primary_key && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        title="Add Foreign Key"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setAddFkDialog({ 
                                            open: true, 
                                            table: table.table_name, 
                                            column: col.column_name 
                                          })
                                        }}
                                      >
                                        <Link2 className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Foreign Keys Summary */}
                      {tableForeignKeys && tableForeignKeys.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                            <Link2 className="h-4 w-4" />
                            Foreign Key Relationships
                          </h4>
                          <div className="grid gap-2">
                            {tableForeignKeys.map(fk => (
                              <div 
                                key={fk.constraint_name}
                                className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50 group"
                              >
                                <span className="font-mono">{fk.column_name}</span>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono text-blue-600 dark:text-blue-400">
                                  {fk.foreign_schema !== schemaName && `${fk.foreign_schema}.`}
                                  {fk.foreign_table}.{fk.foreign_column}
                                </span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  ON DELETE {fk.on_delete}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleDropForeignKey(table.table_name, fk.constraint_name)}
                                >
                                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Column Dialog */}
      <Dialog open={addColumnDialog.open} onOpenChange={(open) => setAddColumnDialog({ open, table: addColumnDialog.table })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Column</DialogTitle>
            <DialogDescription>
              Add a new column to <span className="font-mono">{addColumnDialog.table}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="columnName">Column Name</Label>
              <Input
                id="columnName"
                placeholder="column_name"
                value={newColumn.name}
                onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase with letters, numbers, underscores
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="columnType">Data Type</Label>
              <Select 
                value={newColumn.type} 
                onValueChange={(value) => setNewColumn({ ...newColumn, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="nullable"
                checked={newColumn.nullable}
                onCheckedChange={(checked) => setNewColumn({ ...newColumn, nullable: checked as boolean })}
              />
              <Label htmlFor="nullable">Allow NULL values</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultValue">Default Value (optional)</Label>
              <Input
                id="defaultValue"
                placeholder="e.g., 'default text' or NOW()"
                value={newColumn.default}
                onChange={(e) => setNewColumn({ ...newColumn, default: e.target.value })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                SQL expression for the default value
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddColumnDialog({ open: false, table: null })}>
              Cancel
            </Button>
            <Button onClick={handleAddColumn} disabled={isAdding || !newColumn.name}>
              {isAdding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Column
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Table Dialog */}
      <Dialog open={createTableDialog} onOpenChange={setCreateTableDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Table</DialogTitle>
            <DialogDescription>
              Create a new table in schema <span className="font-mono">{schemaName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Table Name */}
            <div className="space-y-2">
              <Label htmlFor="tableName">Table Name</Label>
              <Input
                id="tableName"
                placeholder="my_table"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase with letters, numbers, underscores
              </p>
            </div>

            {/* Columns */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Columns</Label>
                <Button type="button" variant="outline" size="sm" onClick={addNewColumnRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Column
                </Button>
              </div>
              
              <div className="space-y-3">
                {newTableColumns.map((col, idx) => (
                  <div key={col.id} className="p-4 rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Column {idx + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColumnRow(col.id)}
                        disabled={newTableColumns.length <= 1}
                        className="h-7 w-7 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Column Name</Label>
                        <Input
                          placeholder="column_name"
                          value={col.name}
                          onChange={(e) => updateColumnRow(col.id, { name: e.target.value })}
                          className="font-mono"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Data Type</Label>
                        <Select 
                          value={col.type} 
                          onValueChange={(value) => updateColumnRow(col.id, { type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATA_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={col.primary_key}
                          onCheckedChange={(checked) => updateColumnRow(col.id, { primary_key: checked as boolean })}
                        />
                        <span className="text-sm">Primary Key</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={col.nullable}
                          onCheckedChange={(checked) => updateColumnRow(col.id, { nullable: checked as boolean })}
                        />
                        <span className="text-sm">Allow NULL</span>
                      </label>

                      {!col.primary_key && (
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-sm text-muted-foreground">FK:</span>
                          <Select 
                            value={col.fk_schema && col.fk_table ? `${col.fk_schema}.${col.fk_table}` : 'none'} 
                            onValueChange={(value) => {
                              if (value === 'none') {
                                updateColumnRow(col.id, { 
                                  fk_schema: undefined, 
                                  fk_table: undefined, 
                                  fk_column: undefined,
                                  fk_on_delete: undefined 
                                })
                              } else {
                                const refTable = referenceTables.find(t => `${t.schema_name}.${t.table_name}` === value)
                                if (refTable) {
                                  updateColumnRow(col.id, { 
                                    fk_schema: refTable.schema_name, 
                                    fk_table: refTable.table_name,
                                    fk_column: 'id',
                                    fk_on_delete: 'CASCADE'
                                  })
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {referenceTables.map(t => (
                                <SelectItem 
                                  key={`${t.schema_name}.${t.table_name}`} 
                                  value={`${t.schema_name}.${t.table_name}`}
                                >
                                  {t.table_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTableDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTable} disabled={isCreatingTable || !newTableName}>
              {isCreatingTable ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Table
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Foreign Key Dialog */}
      <Dialog open={addFkDialog.open} onOpenChange={(open) => {
        setAddFkDialog({ open, table: addFkDialog.table, column: addFkDialog.column })
        if (!open) {
          setNewFk({ refSchema: '', refTable: '', refColumn: '', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Foreign Key</DialogTitle>
            <DialogDescription>
              Create a foreign key relationship from{' '}
              <span className="font-mono">{addFkDialog.table}.{addFkDialog.column}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Reference Table */}
            <div className="space-y-2">
              <Label>Reference Table</Label>
              <Select 
                value={newFk.refSchema && newFk.refTable ? `${newFk.refSchema}.${newFk.refTable}` : ''} 
                onValueChange={handleRefTableChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a table to reference..." />
                </SelectTrigger>
                <SelectContent>
                  {referenceTables.map(t => (
                    <SelectItem 
                      key={`${t.schema_name}.${t.table_name}`} 
                      value={`${t.schema_name}.${t.table_name}`}
                    >
                      {t.table_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tables from this schema
              </p>
            </div>

            {/* Reference Column */}
            <div className="space-y-2">
              <Label>Reference Column</Label>
              <Select 
                value={newFk.refColumn} 
                onValueChange={(value) => setNewFk(prev => ({ ...prev, refColumn: value }))}
                disabled={!newFk.refTable || loadingRefColumns}
              >
                <SelectTrigger>
                  {loadingRefColumns ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  ) : (
                    <SelectValue placeholder="Select a column..." />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {refTableColumns.map(col => (
                    <SelectItem key={col.column_name} value={col.column_name}>
                      <span className="font-mono">{col.column_name}</span>
                      <span className="text-muted-foreground ml-2">({col.data_type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Primary key columns from the selected table
              </p>
            </div>

            {/* ON DELETE */}
            <div className="space-y-2">
              <Label>On Delete</Label>
              <Select 
                value={newFk.onDelete} 
                onValueChange={(value) => setNewFk(prev => ({ ...prev, onDelete: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ON_DELETE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ON UPDATE */}
            <div className="space-y-2">
              <Label>On Update</Label>
              <Select 
                value={newFk.onUpdate} 
                onValueChange={(value) => setNewFk(prev => ({ ...prev, onUpdate: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ON_DELETE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {newFk.refTable && newFk.refColumn && (
              <div className="p-3 rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Preview:</p>
                <p className="font-mono text-sm">
                  <span className="text-primary">{addFkDialog.column}</span>
                  <ArrowRight className="inline h-4 w-4 mx-2 text-muted-foreground" />
                  <span className="text-blue-600 dark:text-blue-400">
                    {newFk.refSchema}.{newFk.refTable}.{newFk.refColumn}
                  </span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFkDialog({ open: false, table: null, column: null })}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddForeignKey} 
              disabled={isAddingFk || !newFk.refColumn}
            >
              {isAddingFk ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Add Foreign Key
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
