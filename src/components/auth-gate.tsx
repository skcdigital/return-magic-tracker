import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Terminal, Lock, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <div className="min-h-screen bg-[#1a2228] flex items-center justify-center px-4 font-mono">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="h-10 w-10 rounded-lg bg-[#232e36] border border-white/10 flex items-center justify-center">
            <Terminal className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white tracking-tight">SKC.Digital</p>
            <p className="text-[11px] text-white/40">Returns Tracker</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#20282f] shadow-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/10 bg-[#1c242a] flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-2 text-[11px] text-white/40">skc-digital ~ login</span>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
              <Lock className="h-3.5 w-3.5" />
              <span>authenticate to continue</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/70 text-xs">
                email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#161d22] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-emerald-400"
                placeholder="you@skcdigital.co.za"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white/70 text-xs">
                password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#161d22] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-emerald-400"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#0e1418] font-semibold"
            >
              {loading ? "signing in…" : "sign in"}
            </Button>
          </form>
        </div>

        <p className="text-center text-[11px] text-white/30 mt-5">
          SKC Digital · Pretoria, ZA
        </p>
      </div>
    </div>
  );
}

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => supabase.auth.signOut()}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </Button>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-[#1a2228] flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}