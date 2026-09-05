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
        <div className="w-full max-w-sm panel border-t-2 border-t-accent p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent/12 border border-accent/30 text-accent"><Anchor className="h-4 w-4" /></span>
            <span className="font-semibold text-[15px]">Captain Passage Tool</span>
          </div>
          <p className="text-xs text-text-2 mb-5">Single user. Sign in with an email magic link.</p>
          {!supabaseConfigured && <p className="mb-3 rounded-md border border-risk-amber/40 bg-risk-amber/10 px-3 py-2 text-xs text-risk-amber">VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Copy .env.example to .env.local.</p>}
          <form onSubmit={sendLink} className="space-y-3">
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="captain@…" /></div>
            <Button type="submit" className="w-full" disabled={busy || !email}>{sent ? 'Resend link' : 'Send magic link'}</Button>
          </form>
          {sent && (
            <form onSubmit={verifyCode} className="mt-4 space-y-2 border-t border-border pt-4">
              <Label htmlFor="code">Or enter the code from the email</Label>
              <div className="flex gap-2"><Input id="code" inputMode="numeric" className="num tracking-[0.2em]" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" /><Button type="submit" variant="secondary" disabled={busy || code.length < 6}>Verify</Button></div>
            </form>
          )}
          {msg && <p className="mt-4 text-xs text-text-2 leading-relaxed">{msg}</p>}
        </div>
      </div>
      <AttributionFooter />
    </div>
  );
}
