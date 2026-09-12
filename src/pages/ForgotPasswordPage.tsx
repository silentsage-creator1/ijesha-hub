import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/app/auth'
import { Card } from '@/components/ui/primitives'

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email,setEmail] = useState('')
  const [sent,setSent] = useState(false)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [cooldown,setCooldown] = useState(0)
  useEffect(()=>{
    if(!cooldown)return
    const timer=window.setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000)
    return()=>window.clearTimeout(timer)
  },[cooldown])
  async function send(event?:FormEvent) {
    event?.preventDefault()
    if(busy||cooldown)return
    setBusy(true);setError('')
    try {
      const result=await resetPassword(email.trim())
      if(result.error){setError(result.error);return}
      setSent(true);setCooldown(60)
    } catch {setError('Unable to request a reset link. Please try again.')}
    finally{setBusy(false)}
  }
  return <main className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-4 py-8"><div className="w-full max-w-md space-y-5">
    <img src="/ijesha-logo.jpeg" alt="Ijesha Digital Hub logo" className="mx-auto h-24 w-24 rounded-full"/>
    <Card className="space-y-5 p-6"><h1 className="font-display text-2xl font-semibold">{sent?'Check your email':'Forgot Password'}</h1>
      {sent?<><p role="status" className="text-sm">If an account exists with this email address, we’ve sent you a password reset link. Please check your inbox and spam folder.</p><p className="text-sm">Didn’t receive it? <button type="button" disabled={busy||cooldown>0} onClick={()=>void send()} className="font-semibold text-[var(--color-harbor-700)] underline disabled:opacity-50">{busy?'Sending…':cooldown?`Resend email in ${cooldown}s`:'Resend email'}</button></p></>:<>
        <p className="text-sm">Enter the email address associated with your account and we’ll send you a link to reset your password.</p>
        <form onSubmit={send} className="space-y-4"><label className="block text-sm">Email Address<input required type="email" autoComplete="email" placeholder="Enter your email" className="input mt-1" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label><button disabled={busy} className="w-full rounded-lg bg-[var(--color-harbor-600)] px-4 py-2 text-white disabled:opacity-50">{busy?'Sending…':'Send Reset Link'}</button></form>
      </>}
      {error&&<p role="alert" className="text-sm text-[var(--color-danger-600)]">{error}</p>}
      <a href="/" className="inline-block text-sm font-semibold text-[var(--color-harbor-700)]">← Back to Login</a>
    </Card>
  </div></main>
}
