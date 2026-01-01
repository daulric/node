'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
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

export default function SignUpPage() {
  const router = useRouter()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState<'github' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleOAuthSignUp = async (provider: 'github' | 'google') => {
    setIsOAuthLoading(provider)
    setError(null)

    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=/tenants`,
        },
      })

      if (error) throw error
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to sign up with ${provider}`
      setError(message)
      toast.error(message)
      setIsOAuthLoading(null)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        throw error
      }

      setSuccess(true)
      toast.success('Check your email to confirm your account!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign up'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 rounded-xl bg-emerald-500/20 w-fit mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <CardTitle className="text-2xl text-white">Check Your Email</CardTitle>
            <CardDescription className="text-slate-400">
              We&apos;ve sent a confirmation link to <span className="text-white font-medium">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-slate-400 text-sm">
            <p>Click the link in your email to activate your account.</p>
            <p className="mt-2">After confirming, an administrator will need to grant you access to the system.</p>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => router.push('/login')}
            >
              Back to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto p-3 rounded-xl bg-emerald-500/20 w-fit mb-4">
            <Database className="h-8 w-8 text-emerald-400" />
          </div>
          <CardTitle className="text-2xl text-white">Create Account</CardTitle>
          <CardDescription className="text-slate-400">
            Sign up to request access to the schema management system
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-4">
            {/* OAuth Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthSignUp('github')}
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
                onClick={() => handleOAuthSignUp('google')}
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

            <form onSubmit={handleSignUp} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-slate-300">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading || isOAuthLoading !== null}
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
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
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading || isOAuthLoading !== null}
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">Must be at least 6 characters</p>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              disabled={isLoading || isOAuthLoading !== null}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
            </form>
          </CardContent>
          <CardFooter className="pt-2">
            <div className="text-center text-sm text-slate-400 w-full">
              Already have an account?{' '}
              <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Sign in
              </Link>
            </div>
          </CardFooter>
      </Card>
    </div>
  )
}

