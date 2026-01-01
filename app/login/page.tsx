'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/tenants'
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getErrorMessage = (error: Error): string => {
    const message = error.message.toLowerCase()
    
    if (message.includes('invalid login credentials')) {
      return 'Invalid email or password. Please try again.'
    }
    if (message.includes('email not confirmed')) {
      return 'Please check your email and confirm your account first.'
    }
    if (message.includes('too many requests')) {
      return 'Too many login attempts. Please wait a moment and try again.'
    }
    if (message.includes('network')) {
      return 'Network error. Please check your connection.'
    }
    
    return error.message || 'Failed to log in. Please try again.'
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        throw error
      }

      toast.success('Welcome back!')
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? getErrorMessage(err) : 'Failed to log in'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm shadow-2xl">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4">
          <Image
            src="/logo.png"
            alt="Node Logo"
            width={64}
            height={64}
            className="rounded-xl"
            priority
          />
        </div>
        <CardTitle className="text-2xl text-white">Welcome Back</CardTitle>
        <CardDescription className="text-slate-400">
          Sign in to access the Node dashboard
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
              autoFocus
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Link 
                href="/forgot-password" 
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                tabIndex={-1}
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
            <Input
              id="password"
                type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
                autoComplete="current-password"
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 pr-10 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button 
            type="submit" 
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
          <div className="text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link 
              href="/signup" 
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Sign up
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

function LoginSkeleton() {
  return (
    <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm animate-pulse shadow-2xl">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4">
          <div className="h-16 w-16 bg-slate-700 rounded-xl" />
        </div>
        <div className="h-8 bg-slate-700 rounded w-48 mx-auto" />
        <div className="h-4 bg-slate-700 rounded w-64 mx-auto mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 bg-slate-700 rounded w-16" />
          <div className="h-10 bg-slate-700 rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-700 rounded w-20" />
          <div className="h-10 bg-slate-700 rounded" />
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <div className="h-10 bg-slate-700 rounded w-full" />
      </CardFooter>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Suspense fallback={<LoginSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
