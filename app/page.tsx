"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Database, ArrowRight, Table2, Layers, Lock, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    const handleMouseEnter = () => setIsHovering(true)
    const handleMouseLeave = () => setIsHovering(false)

    window.addEventListener('mousemove', handleMouseMove)
    document.body.addEventListener('mouseenter', handleMouseEnter)
    document.body.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.body.removeEventListener('mouseenter', handleMouseEnter)
      document.body.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Animated Grid Background */}
      <div className="fixed inset-0 opacity-20">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Cursor Following Gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(900px circle at ${mousePosition.x}px ${mousePosition.y}px, 
              rgba(16, 185, 129, 0.35) 0%, 
              rgba(5, 150, 105, 0.2) 30%, 
              rgba(4, 120, 87, 0.1) 50%, 
              transparent 70%
            )
          `,
          opacity: isHovering ? 1 : 0.6,
          transition: 'opacity 0.3s',
        }}
      />

      {/* Floating Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-green-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Scan Lines Effect */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(16, 185, 129, 0.5) 2px, rgba(16, 185, 129, 0.5) 4px)',
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-16 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          {/* Glowing Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 backdrop-blur-md border border-emerald-500/30 mb-8 shadow-lg shadow-emerald-500/20">
            <Zap className="h-4 w-4 text-emerald-400 animate-pulse" />
            <span className="text-sm font-medium text-emerald-300 tracking-wide uppercase">PostgreSQL Schema Manager</span>
          </div>
          
          {/* Main Title with Glow */}
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6">
            <span className="bg-gradient-to-b from-white via-emerald-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
              Multi-Tenant
            </span>
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Node System
            </span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Create and manage isolated database nodes for your multi-tenant application. 
            <span className="text-emerald-400"> View tables, columns, and control access</span> with precision.
          </p>
          
          {/* CTA Button with Glow */}
          <Link href="/tenants">
            <Button 
              size="lg" 
              className="relative bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white gap-3 text-lg px-10 py-7 rounded-xl font-semibold shadow-2xl shadow-emerald-500/30 transition-all duration-300 hover:shadow-emerald-500/50 hover:scale-105 border border-emerald-400/30"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>

          {/* Decorative Line */}
          <div className="mt-16 flex items-center justify-center gap-4">
            <div className="h-px w-24 bg-gradient-to-r from-transparent to-emerald-500/50" />
            <Database className="h-5 w-5 text-emerald-500/50" />
            <div className="h-px w-24 bg-gradient-to-l from-transparent to-emerald-500/50" />
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          {/* Card 1 */}
          <Card className="group relative bg-black/40 border-emerald-500/20 backdrop-blur-xl hover:border-emerald-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 w-fit mb-3 group-hover:bg-emerald-500/20 transition-colors">
                <Layers className="h-6 w-6 text-emerald-400" />
              </div>
              <CardTitle className="text-white text-xl font-bold">Schema Isolation</CardTitle>
              <CardDescription className="text-slate-400">
                Each client gets their own PostgreSQL schema with complete data isolation.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <ul className="text-sm text-slate-300 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Create nodes on demand
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Automatic table provisioning
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Clean namespace separation
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Card 2 */}
          <Card className="group relative bg-black/40 border-teal-500/20 backdrop-blur-xl hover:border-teal-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative">
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 w-fit mb-3 group-hover:bg-teal-500/20 transition-colors">
                <Table2 className="h-6 w-6 text-teal-400" />
              </div>
              <CardTitle className="text-white text-xl font-bold">Table Browser</CardTitle>
              <CardDescription className="text-slate-400">
                Explore tables, columns, data types, and relationships visually.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <ul className="text-sm text-slate-300 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  View all tables in a schema
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  Inspect column definitions
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  See row counts and sizes
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Card 3 */}
          <Card className="group relative bg-black/40 border-cyan-500/20 backdrop-blur-xl hover:border-cyan-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-cyan-500/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 w-fit mb-3 group-hover:bg-cyan-500/20 transition-colors">
                <Lock className="h-6 w-6 text-cyan-400" />
              </div>
              <CardTitle className="text-white text-xl font-bold">Access Control</CardTitle>
              <CardDescription className="text-slate-400">
                Fine-grained permission management for each schema.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <ul className="text-sm text-slate-300 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  Suspend/reactivate access
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  Admin role management
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  Per-user schema access
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Tech Stack */}
        <div className="mt-24 text-center">
          <p className="text-slate-500 mb-6 uppercase tracking-widest text-xs font-medium">Powered by</p>
          <div className="flex flex-wrap justify-center gap-4 items-center">
            <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:border-emerald-500/30 transition-colors">
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
              <span className="font-medium text-sm">Next.js</span>
            </div>
            <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:border-emerald-500/30 transition-colors">
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
              <span className="font-medium text-sm">Supabase</span>
            </div>
            <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:border-emerald-500/30 transition-colors">
              <Database className="h-5 w-5 text-blue-400" />
              <span className="font-medium text-sm">PostgreSQL</span>
            </div>
            <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:border-emerald-500/30 transition-colors">
              <svg viewBox="0 0 54 33" className="h-4 w-6" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z"/>
              </svg>
              <span className="font-medium text-sm">Tailwind</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-24 text-center">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent mb-8" />
          <p className="text-slate-600 text-sm">
            Built for the future of multi-tenant architecture
          </p>
        </div>
      </div>
    </div>
  )
}
