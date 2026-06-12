import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  // LoginPage handles Google OAuth 2.0 logins exclusively

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userJson = params.get('user');
    const errParam = params.get('error');

    if (errParam) {
      setError(errParam === 'oauth_failed' ? 'Google authentication failed.' : 'Google token exchange failed.');
    }

    if (token && userJson) {
      try {
        const decodedUser = JSON.parse(decodeURIComponent(userJson));
        setAuth(decodedUser, token);
        navigate('/dashboard');
      } catch (err) {
        setError('Failed to log in with Google.');
      }
    }
  }, [navigate, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden bg-slate-950 text-white">
      {/* Background decorations */}
      <div className="absolute top-20 left-1/3 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-20 right-1/3 w-96 h-96 bg-accent-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[5000ms]" />
      
      <Card className="w-full max-w-md relative glow border-white/5 bg-slate-900/40 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-500/20">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Welcome to ApplyAI
          </CardTitle>
          <CardDescription className="text-slate-400 mt-2 text-base">
            Autonomous job searching, powered by AI
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="text-center text-sm text-slate-400 leading-relaxed px-4">
              To keep your data secure and simplify outbound email routing, we support <span className="text-white font-medium">Google Accounts exclusively</span>.
            </div>

            <a 
              href="http://localhost:5001/auth/google" 
              onClick={() => setLoading(true)}
              className="block w-full"
            >
              <Button 
                type="button" 
                variant="default" 
                className="w-full justify-center py-6 text-base font-semibold bg-white hover:bg-slate-100 text-slate-950 transition-all duration-300 transform hover:scale-[1.02] shadow-xl hover:shadow-white/5 active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-slate-950" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.24 10.285V13.4h6.86c-.277 1.56-1.602 4.585-6.86 4.585-4.54 0-8.24-3.765-8.24-8.4s3.7-8.4 8.24-8.4c2.58 0 4.307 1.095 5.298 2.045l2.465-2.37C18.435 1.21 15.62 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.89 11.57-11.79 0-.795-.085-1.4-.188-1.925H12.24z"/>
                    </svg>
                    Sign in with Google
                  </span>
                )}
              </Button>
            </a>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 text-center text-xs text-slate-500 leading-normal">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
