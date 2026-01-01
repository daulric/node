import { Skeleton } from '@/components/ui/skeleton'
import { TenantTableSkeleton } from './components/tenant-table-skeleton'
import { Database } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <Skeleton className="h-9 w-64" />
          </div>
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Table Skeleton */}
          <div className="order-2 lg:order-1">
            <Skeleton className="h-6 w-32 mb-4" />
            <TenantTableSkeleton />
          </div>

          {/* Form Skeleton */}
          <div className="order-1 lg:order-2">
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

