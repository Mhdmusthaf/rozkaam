import { useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useStore } from '../data/store';
import { Logomark, Pill, Wordmark } from '../ui';

export default function Login() {
  const { login, toast } = useStore();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const phoneOk = phone.replace(/\D/g, '').length === 10;
  const otpOk = otp.every((d) => d !== '');

  const setDigit = (i: number, v: string) => {
    const digits = v.replace(/\D/g, '');
    if (digits.length > 1) {
      const next = digits.slice(0, 6).split('');
      setOtp([...next, ...Array(6 - next.length).fill('')]);
      refs.current[Math.min(5, next.length)]?.focus();
      return;
    }
    setOtp((o) => o.map((d, j) => (j === i ? digits : d)));
    if (digits && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="login">
      <section className="login-art">
        <div className="row">
          <Logomark size={40} white />
          <Wordmark height={22} color="#ffffff" />
        </div>
        <div>
          <h1>The workforce layer for the real world.</h1>
          <p>Admin panel for the Rozkaam ops team: approve applicants, verify KYC, settle payouts and keep every requirement on track.</p>
        </div>
        <div className="small" style={{ opacity: 0.7 }}>Kochi → Kerala → India</div>
      </section>
      <section className="login-form">
        <form
          className="box col gap-16"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 'phone') {
              if (!phoneOk) return;
              setStep('otp');
              toast('Demo mode: no SMS is sent. Enter any 6 digits.', 'warn');
              setTimeout(() => refs.current[0]?.focus(), 50);
            } else if (otpOk) {
              login();
              toast('Signed in as Demo Admin');
            }
          }}
        >
          <div className="row between">
            <h1>Sign in</h1>
            <Pill tone="warn">Demo</Pill>
          </div>
          <p className="muted">
            {step === 'phone'
              ? 'Enter your registered ops phone number to get a one-time code.'
              : `Enter the 6-digit code for +91 ${phone}. In demo mode any 6 digits work.`}
          </p>
          {step === 'phone' ? (
            <label className="field">
              <span>Phone number</span>
              <div className="row">
                <span className="input" style={{ width: 64, textAlign: 'center', fontWeight: 700 }}>+91</span>
                <input
                  className="input"
                  inputMode="numeric"
                  autoFocus
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>
            </label>
          ) : (
            <div className="field">
              <span>One-time code</span>
              <div className="otp">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { refs.current[i] = el; }}
                    inputMode="numeric"
                    aria-label={`Digit ${i + 1}`}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus(); }}
                  />
                ))}
              </div>
            </div>
          )}
          <button className="btn lg block" disabled={step === 'phone' ? !phoneOk : !otpOk}>
            {step === 'phone' ? 'Send code' : 'Verify and sign in'}
          </button>
          {step === 'otp' && (
            <button type="button" className="btn ghost block" onClick={() => setStep('phone')}>Use a different number</button>
          )}
          <div className="row gap-6 muted small"><ShieldCheck size={15} /> Demo build. Nothing here is connected to live data.</div>
        </form>
      </section>
    </div>
  );
}
