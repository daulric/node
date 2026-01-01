import Link from 'next/link'
import { Database, ArrowRight, Table2, Layers, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
            <Database className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium">PostgreSQL Schema Manager</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Multi-Tenant
            <br />
            Node Management
          </h1>
          
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8">
            Create and manage isolated database nodes for your multi-tenant application. 
            View tables, columns, and control access with ease.
          </p>
          
          <Link href="/tenants">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 text-lg px-8 py-6">
              Open Dashboard
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <div className="p-3 rounded-lg bg-emerald-500/20 w-fit mb-2">
                <Layers className="h-6 w-6 text-emerald-400" />
              </div>
              <CardTitle className="text-white">Schema Isolation</CardTitle>
              <CardDescription className="text-slate-400">
                Each client gets their own PostgreSQL schema with complete data isolation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-300 space-y-2">
                <li>• Create nodes on demand</li>
                <li>• Automatic table provisioning</li>
                <li>• Clean namespace separation</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <div className="p-3 rounded-lg bg-blue-500/20 w-fit mb-2">
                <Table2 className="h-6 w-6 text-blue-400" />
              </div>
              <CardTitle className="text-white">Table Browser</CardTitle>
              <CardDescription className="text-slate-400">
                Explore tables, columns, data types, and relationships visually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-300 space-y-2">
                <li>• View all tables in a schema</li>
                <li>• Inspect column definitions</li>
                <li>• See row counts and sizes</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <div className="p-3 rounded-lg bg-amber-500/20 w-fit mb-2">
                <Lock className="h-6 w-6 text-amber-400" />
              </div>
              <CardTitle className="text-white">Access Control</CardTitle>
              <CardDescription className="text-slate-400">
                Fine-grained permission management for each schema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-300 space-y-2">
                <li>• Suspend/reactivate access</li>
                <li>• Admin role management</li>
                <li>• Per-user schema access</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Tech Stack */}
        <div className="mt-24 text-center">
          <p className="text-slate-400 mb-6">Built with</p>
          <div className="flex flex-wrap justify-center gap-6 items-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
              <svg viewBox="0 0 180 180" className="h-5 w-5" fill="currentColor">
                <mask id="mask0" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180">
                  <circle cx="90" cy="90" r="90" fill="black"/>
                </mask>
                <g mask="url(#mask0)">
                  <circle cx="90" cy="90" r="90" fill="black"/>
                  <path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#paint0)"/>
                  <rect x="115" y="54" width="12" height="72" fill="url(#paint1)"/>
                </g>
                <defs>
                  <linearGradient id="paint0" x1="109" y1="116.5" x2="144.5" y2="160.5" gradientUnits="userSpaceOnUse">
                    <stop stopColor="white"/>
                    <stop offset="1" stopColor="white" stopOpacity="0"/>
                  </linearGradient>
                  <linearGradient id="paint1" x1="121" y1="54" x2="120.799" y2="106.875" gradientUnits="userSpaceOnUse">
                    <stop stopColor="white"/>
                    <stop offset="1" stopColor="white" stopOpacity="0"/>
                  </linearGradient>
                </defs>
              </svg>
              <span className="font-medium">Next.js 16</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
              <svg viewBox="0 0 109 113" className="h-5 w-5" fill="none">
                <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)"/>
                <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint1_linear)" fillOpacity="0.2"/>
                <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
                <defs>
                  <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#249361"/>
                    <stop offset="1" stopColor="#3ECF8E"/>
                  </linearGradient>
                  <linearGradient id="paint1_linear" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
                    <stop/>
                    <stop offset="1" stopOpacity="0"/>
                  </linearGradient>
                </defs>
              </svg>
              <span className="font-medium">Supabase</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
              <svg viewBox="0 0 128 128" className="h-5 w-5" fill="currentColor">
                <path d="M64 0C28.7 0 0 28.7 0 64s28.7 64 64 64 64-28.7 64-64S99.3 0 64 0zm32.7 114.4L48.4 41.8h-6.8v44.5H32V35.4h22.7c6.2 0 11.2 5 11.2 11.2v44.5h9.3l39.7 59.6c-5.6 2.4-11.7 3.7-18.2 3.7-3.2 0-6.4-.3-9.4-.8l29.4-44.2z"/>
              </svg>
              <span className="font-medium">PostgreSQL</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
              <svg viewBox="0 0 54 33" className="h-4 w-6" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z"/>
              </svg>
              <span className="font-medium">Tailwind CSS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
