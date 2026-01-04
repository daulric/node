'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  FolderPlus,
  Link2,
  HardDrive,
  Folder,
  File as FileIcon,
  ArrowLeft,
  ExternalLink,
  Upload,
  Trash2,
} from 'lucide-react'

type BucketRow = {
  bucket_id: string
  created_at: string
}

type BucketObjects = {
  prefix: string
  folders: string[]
  files: { name: string; updated_at: string | null; created_at: string | null }[]
}

function sanitizeBucketId(input: string) {
  // Enforce rules while typing:
  // - lowercase
  // - convert spaces to underscores
  // - only [a-z0-9_-]
  // - max length 63
  return input
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 63)
}

function isValidBucketId(bucketId: string) {
  // Match the server validation in:
  // - /api/tenants/[schema]/buckets
  // - /api/tenants/[schema]/buckets/link
  return /^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]$/.test(bucketId)
}

export function SchemaBucketsPanel({
  schemaName,
  canManage,
}: {
  schemaName: string
  canManage: boolean
}) {
  const [buckets, setBuckets] = useState<BucketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [bucketId, setBucketId] = useState('')
  const [submitting, setSubmitting] = useState<'create' | 'link' | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [prefix, setPrefix] = useState('')
  const [objectsLoading, setObjectsLoading] = useState(false)
  const [objects, setObjects] = useState<BucketObjects | null>(null)
  const [folderName, setFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const normalizedBucketId = useMemo(() => bucketId.trim().toLowerCase(), [bucketId])
  const bucketIdValid = useMemo(() => isValidBucketId(normalizedBucketId), [normalizedBucketId])

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(schemaName)}/buckets`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load buckets')
      setBuckets(json?.buckets || [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load buckets'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function loadObjects(nextBucket: string, nextPrefix: string) {
    setObjectsLoading(true)
    try {
      const url = new URL(
        `/api/tenants/${encodeURIComponent(schemaName)}/buckets/${encodeURIComponent(nextBucket)}/objects`,
        window.location.origin
      )
      if (nextPrefix) url.searchParams.set('prefix', nextPrefix)

      const res = await fetch(url.toString(), { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load files')

      setSelectedBucket(nextBucket)
      setPrefix(json?.prefix || '')
      setObjects({
        prefix: json?.prefix || '',
        folders: json?.folders || [],
        files: (json?.files || []).map((f: any) => ({
          name: f.name,
          updated_at: f.updated_at ?? null,
          created_at: f.created_at ?? null,
        })),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load files'
      toast.error(msg)
    } finally {
      setObjectsLoading(false)
    }
  }

  async function createFolder() {
    if (!selectedBucket) return
    const name = folderName.trim()
    if (!name) {
      toast.error('Folder name is required.')
      return
    }

    setCreatingFolder(true)
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(schemaName)}/buckets/${encodeURIComponent(selectedBucket)}/objects/folder`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, folderName: name }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create folder')

      toast.success('Folder created.')
      setFolderName('')
      await loadObjects(selectedBucket, prefix)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create folder'
      toast.error(msg)
    } finally {
      setCreatingFolder(false)
    }
  }

  async function uploadFile(file: File) {
    if (!selectedBucket) return

    setUploading(true)
    try {
      const form = new FormData()
      form.set('prefix', prefix)
      form.set('file', file)

      const res = await fetch(
        `/api/tenants/${encodeURIComponent(schemaName)}/buckets/${encodeURIComponent(selectedBucket)}/objects/upload`,
        {
          method: 'POST',
          body: form,
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Upload failed')

      toast.success('Uploaded.')
      await loadObjects(selectedBucket, prefix)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  async function deleteObject(kind: 'file' | 'folder', fullPath: string) {
    if (!selectedBucket) return

    const ok = window.confirm(
      kind === 'file'
        ? `Delete file "${fullPath}"?`
        : `Delete folder "${fullPath}" and ALL its contents?`
    )
    if (!ok) return

    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(schemaName)}/buckets/${encodeURIComponent(selectedBucket)}/objects/delete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, path: fullPath }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Delete failed')

      toast.success('Deleted.')
      await loadObjects(selectedBucket, prefix)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed'
      toast.error(msg)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaName])

  async function submit(kind: 'create' | 'link') {
    if (!normalizedBucketId) {
      toast.error('Bucket ID is required.')
      return
    }

    setSubmitting(kind)
    try {
      const path =
        kind === 'create'
          ? `/api/tenants/${encodeURIComponent(schemaName)}/buckets`
          : `/api/tenants/${encodeURIComponent(schemaName)}/buckets/link`

      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: normalizedBucketId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Request failed')

      toast.success(kind === 'create' ? 'Bucket created and linked.' : 'Bucket linked.')
      setBucketId('')
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      toast.error(msg)
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Storage Buckets
        </CardTitle>
        <Badge variant="secondary">{loading ? '…' : `${buckets.length} bucket(s)`}</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading buckets…</p>
          ) : buckets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No buckets linked yet. (A default bucket should be created automatically when the schema is created.)
            </p>
          ) : (
            <div className="grid gap-2">
              {buckets.map((b) => (
                <button
                  key={b.bucket_id}
                  type="button"
                  onClick={() => loadObjects(b.bucket_id, '')}
                  className={`flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/50 ${
                    selectedBucket === b.bucket_id ? 'border-primary/50 bg-muted/30' : ''
                  }`}
                >
                  <span className="font-mono text-sm">{b.bucket_id}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(b.created_at).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedBucket ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => loadObjects(selectedBucket, '')}
                  className="inline-flex items-center"
                  disabled={objectsLoading}
                  title="Go to bucket root"
                >
                  <Badge variant="outline" className="font-mono">
                    {selectedBucket}
                  </Badge>
                </button>

                <span className="text-sm text-muted-foreground select-none">/</span>

                {prefix ? (
                  <>
                    {prefix.split('/').filter(Boolean).map((seg, idx, arr) => {
                      const target = arr.slice(0, idx + 1).join('/')
                      const isLast = idx === arr.length - 1
                      return (
                        <div key={`${target}:${idx}`} className="flex items-center gap-2">
                          <button
                            type="button"
                            className={`text-sm ${isLast ? 'text-foreground' : 'text-muted-foreground hover:underline'}`}
                            onClick={() => loadObjects(selectedBucket, target)}
                            disabled={objectsLoading}
                            title={`Go to /${target}`}
                          >
                            <span className="font-mono">{seg}</span>
                          </button>
                          {!isLast ? (
                            <span className="text-sm text-muted-foreground select-none">/</span>
                          ) : null}
                        </div>
                      )
                    })}
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground font-mono">root</span>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadObjects(selectedBucket, prefix)}
                  disabled={objectsLoading}
                >
                  Refresh files
                </Button>
              </div>
            </div>

            {/* Folder + Upload actions */}
            <div className="flex flex-col gap-3 rounded-lg border bg-card/50 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-1">
                  <Label htmlFor="newFolder">Create folder</Label>
                  <Input
                    id="newFolder"
                    placeholder="e.g. avatars"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    disabled={creatingFolder || uploading || objectsLoading}
                  />
                </div>
                <Button
                  onClick={createFolder}
                  disabled={creatingFolder || uploading || objectsLoading}
                  className="gap-2"
                >
                  {creatingFolder ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <FolderPlus className="h-4 w-4" />
                      Create
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Upload file to <span className="font-mono">{prefix ? `/${prefix}` : '/'}</span>
                </div>
                <div className="inline-flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    disabled={uploading || creatingFolder || objectsLoading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      // allow re-uploading same file name again by clearing value
                      e.currentTarget.value = ''
                      uploadFile(f)
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={uploading || creatingFolder || objectsLoading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {objectsLoading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading files…
              </p>
            ) : objects ? (
              objects.folders.length === 0 && objects.files.length === 0 ? (
                <p className="text-sm text-muted-foreground">This folder is empty.</p>
              ) : (
                <div className="grid gap-1">
                  {objects.folders.map((name) => (
                    <div
                      key={`folder:${name}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/30"
                    >
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left min-w-0"
                        onClick={() => loadObjects(selectedBucket, prefix ? `${prefix}/${name}` : name)}
                      >
                        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm truncate">{name}/</span>
                      </button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 gap-2"
                        disabled={uploading || creatingFolder || objectsLoading}
                        onClick={() => {
                          const folderPath = prefix ? `${prefix}/${name}` : name
                          deleteObject('folder', folderPath)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {objects.files.map((f) => (
                    <div
                      key={`file:${f.name}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm truncate">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {f.updated_at ? new Date(f.updated_at).toLocaleString() : ''}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-2"
                          onClick={async () => {
                            try {
                              const fullPath = prefix ? `${prefix}/${f.name}` : f.name
                              const url = new URL(
                                `/api/tenants/${encodeURIComponent(schemaName)}/buckets/${encodeURIComponent(
                                  selectedBucket
                                )}/objects/signed-url`,
                                window.location.origin
                              )
                              url.searchParams.set('path', fullPath)

                              const res = await fetch(url.toString(), { cache: 'no-store' })
                              const json = await res.json()
                              if (!res.ok) throw new Error(json?.error || 'Failed to open file')

                              window.open(json.url, '_blank', 'noopener,noreferrer')
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : 'Failed to open file'
                              toast.error(msg)
                            }
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                          View
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 gap-2"
                          disabled={uploading || creatingFolder || objectsLoading}
                          onClick={() => {
                            const fullPath = prefix ? `${prefix}/${f.name}` : f.name
                            deleteObject('file', fullPath)
                          }}
                        >
                          <Trash2 className="h-4 w-4" /> 
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a bucket to view its files and folders.
              </p>
            )}
          </div>
        ) : null}

        {canManage ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="bucketId">Bucket ID</Label>
              <Input
                id="bucketId"
                placeholder="e.g. acme_assets"
                value={bucketId}
                onChange={(e) => {
                  const next = sanitizeBucketId(e.target.value)
                  setBucketId(next)
                }}
                className="font-mono"
                disabled={submitting !== null}
              />
              {bucketId.length > 0 && !bucketIdValid ? (
                <p className="text-xs text-destructive">
                  Invalid bucket id. Use 3–63 chars, lowercase letters/numbers with <span className="font-mono">_</span> or{' '}
                  <span className="font-mono">-</span>, and it must start/end with a letter/number.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Lowercase letters/numbers with <span className="font-mono">_</span> or{' '}
                  <span className="font-mono">-</span>. Each bucket can belong to only one schema.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => submit('create')}
                disabled={submitting !== null || !bucketIdValid}
                className="gap-2"
              >
                {submitting === 'create' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <FolderPlus className="h-4 w-4" />
                    Create + Link
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => submit('link')}
                disabled={submitting !== null || !bucketIdValid}
                className="gap-2"
              >
                {submitting === 'link' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Linking…
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Link Existing
                  </>
                )}
              </Button>

              <Button variant="ghost" onClick={refresh} disabled={submitting !== null} className="gap-2">
                Refresh
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You can view linked buckets, but only admins can create/link buckets.
          </p>
        )}
      </CardContent>
    </Card>
  )
}


