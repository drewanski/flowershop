import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';
import logo from '../assets/coffee-logo.png';
import bg from '../assets/coffee-background.svg';
import './PasswordReset.css';

export default function PasswordReset() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const requestCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const { ok, data } = await apiRequest('/auth/password-reset/request', {
        method: 'POST', body: JSON.stringify({ email }),
      });
      if (!ok) throw new Error(data?.message || 'Unable to request a reset code.');
      setCodeSent(true);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const { ok, data } = await apiRequest('/auth/password-reset/confirm', {
        method: 'POST', body: JSON.stringify({ email, otp, newPassword }),
      });
      if (!ok) throw new Error(data?.message || 'Unable to reset password.');
      setMessage(data.message);
      setCodeSent(false);
      setOtp('');
      setNewPassword('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="password-reset-page" style={{ backgroundImage: `url(${bg})` }}>
      <nav className="password-reset-nav"><Link to="/"><img src={logo} alt="Sampaguita" /></Link><Link to="/login">Back to login</Link></nav>
      <section className="password-reset-panel">
        <p className="password-reset-kicker">ACCOUNT SECURITY</p>
        <h1>Reset your password</h1>
        <p className="password-reset-intro">We’ll send a one-time code to the account email address.</p>
        {!codeSent ? (
          <form onSubmit={requestCode}>
            <label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</button>
          </form>
        ) : (
          <form onSubmit={resetPassword}>
            <label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Six-digit code<input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" required value={otp} onChange={(event) => setOtp(event.target.value)} /></label>
            <label>New password<input type="password" minLength="8" required autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <button type="submit" disabled={busy}>{busy ? 'Updating…' : 'Set new password'}</button>
            <button className="password-reset-resend" type="button" onClick={() => { setCodeSent(false); setMessage(''); }}>Request another code</button>
          </form>
        )}
        {message && <p className="password-reset-message" role="status">{message}</p>}
      </section>
    </main>
  );
}