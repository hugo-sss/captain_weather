import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Anchor } from 'lucide-react';
import { supabase, supabaseConfigured } from '@/lib/supabase.ts';
import { useAuth } from '@/hooks/useAuth.ts';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { AttributionFooter } from '@/components/AttributionFooter.tsx';

export default function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!loading && user) return <Navigate to="/" replace />;

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) setMsg(error.message); else { setSent(true); setMsg('Check your inbox. Open the magic link on this device, or paste the 6-digit code if your email template includes one.'); }
  };
  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMsg(error.message);
  };

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-bg-1 p-6">
          <div className="flex items-center gap-2 mb-1 font-semibold text-lg"><Anchor className="h-5 w-5 text-accent" /> Captain Passage Tool</div>
          <p className="text-xs text-text-2 mb-5">Single user. Sign in with an email magic link.</p>
          {!supabaseConfigured && <p className="text-xs text-risk-amber mb-3">VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Copy .env.example to .env.local.</p>}
          <form onSubmit={sendLink} className="space-y-3">
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={busy || !email}>{sent ? 'Resend link' : 'Send magic link'}</Button>
          </form>
          {sent && (
            <form onSubmit={verifyCode} className="mt-4 space-y-2">
              <Label htmlFor="code">Or enter the code from the email</Label>
              <div className="flex gap-2"><Input id="code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" /><Button type="submit" variant="secondary" disabled={busy || code.length < 6}>Verify</Button></div>
            </form>
          )}
          {msg && <p className="mt-4 text-xs text-text-2">{msg}</p>}
        </div>
      </div>
      <AttributionFooter />
    </div>
  );
}
