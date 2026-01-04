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

// GitHub Icon Component
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

// Google Icon Component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/tenants'
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState<'github' | 'google' | null>(null)
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

  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    setIsOAuthLoading(provider)
    setError(null)

    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      })

      if (error) throw error
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to sign in with ${provider}`
      setError(message)
      toast.error(message)
      setIsOAuthLoading(null)
    }
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
            alt="b12 Logo"
            width={64}
            height={64}
            className="rounded-xl"
            priority
          />
        </div>
        <CardTitle className="text-2xl text-white">Welcome Back</CardTitle>
        <CardDescription className="text-slate-400">
          Sign in to access the b12 dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthLogin('github')}
            disabled={isLoading || isOAuthLoading !== null}
            className="bg-slate-900/50 border-slate-600 text-white hover:bg-slate-700 hover:text-white transition-colors"
          >
            {isOAuthLoading === 'github' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <GitHubIcon className="h-4 w-4 mr-2" />
                GitHub
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthLogin('google')}
            disabled={isLoading || isOAuthLoading !== null}
            className="bg-slate-900/50 border-slate-600 text-white hover:bg-slate-700 hover:text-white transition-colors"
          >
            {isOAuthLoading === 'google' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <GoogleIcon className="h-4 w-4 mr-2" />
                Google
              </>
            )}
          </Button>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-600" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-800/50 px-2 text-slate-400">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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
                disabled={isLoading || isOAuthLoading !== null}
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
                  disabled={isLoading || isOAuthLoading !== null}
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
            <Button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
              disabled={isLoading || isOAuthLoading !== null}
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
          </form>
        </CardContent>
        <CardFooter className="pt-2">
          <div className="text-center text-sm text-slate-400 w-full">
            Don&apos;t have an account?{' '}
            <Link 
              href="/signup" 
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Sign up
            </Link>
          </div>
        </CardFooter>
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
