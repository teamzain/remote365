'use client'

import React, { useState } from 'react'
import SiteLink from '@/components/site/SiteLink'
import { Mail, Check } from 'lucide-react'
import SiteContent from './SiteContent'
import api from '@/lib/api'

type Status = 'idle' | 'sending' | 'sent' | 'error'

const CONTACT_EMAIL = 'support@remote365.ai'

const Contact: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill in your full name, email, and message.')
      return
    }
    setStatus('sending')
    try {
      await api.post('/api/support/contact', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        subject: 'New contact request',
        message: form.message,
      })
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Something went wrong. Please try again.')
    }
  }

  return (
    <SiteContent>
      <div className="ct-page">

        <main className="ct-main">
          {/* Left: info */}
          <div className="ct-intro">
            <span className="ct-eyebrow">Have Questions?</span>
            <h1 className="ct-title">Get In Touch With us</h1>
            <p className="ct-lede">
              We’re here to support your remote access needs, answer questions about the product, and
              discuss enterprise solutions. Use the form to send us a message, or contact us directly
              via email.
            </p>
            <p className="ct-para">
              Have questions about connecting a device or running a support session? Find instant
              answers in our <SiteLink href="/docs" className="ct-link">Docs &amp; Help Center</SiteLink>.
            </p>
            <p className="ct-para">
              Looking to roll Remote365 out across your team? <strong>Email us now for a free consultation.</strong>
            </p>

            <h2 className="ct-subhead">Contact us</h2>
            <a href={`mailto:${CONTACT_EMAIL}`} className="ct-email">
              <span className="ct-email-icon"><Mail size={16} /></span>
              {CONTACT_EMAIL}
            </a>
          </div>

          {/* Right: form card */}
          <div className="ct-card">
            {status === 'sent' ? (
              <div className="ct-success">
                <span className="ct-check"><Check size={26} strokeWidth={3} /></span>
                <h2>Message sent</h2>
                <p>Thanks for reaching out — we’ve emailed you a confirmation and will be in touch soon.</p>
                <SiteLink href="/" className="ct-btn">Back to home</SiteLink>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <h2 className="ct-card-title">Send Us A Message</h2>

                <div className="ct-field">
                  <label htmlFor="ct-name">Full Name <span className="ct-req">*</span></label>
                  <input id="ct-name" type="text" value={form.name} onChange={set('name')} placeholder="Enter your full name" />
                </div>
                <div className="ct-field">
                  <label htmlFor="ct-email">Email <span className="ct-req">*</span></label>
                  <input id="ct-email" type="email" value={form.email} onChange={set('email')} placeholder="name@email.com" />
                </div>
                <div className="ct-field">
                  <label htmlFor="ct-phone">Phone Number</label>
                  <input id="ct-phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="Enter your phone number" />
                </div>
                <div className="ct-field">
                  <label htmlFor="ct-message">How Can We Help?</label>
                  <textarea id="ct-message" rows={4} value={form.message} onChange={set('message')} placeholder="Your message" />
                </div>

                {error && <p className="ct-error">{error}</p>}

                <p className="ct-privacy">
                  By submitting this form, you agree to our <SiteLink href="/privacy" className="ct-link">Privacy Policy</SiteLink>
                </p>

                <button type="submit" className="ct-btn" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Sending…' : 'Submit'}
                </button>
              </form>
            )}
          </div>
        </main>

        <style>{`
          .ct-page {
            font-family: 'Mona Sans', system-ui, -apple-system, sans-serif;
          }
          .ct-main {
            flex: 1;
            width: 100%;
            max-width: 1440px;
            margin: 0 auto;
            padding: clamp(48px, 7vw, 96px) clamp(20px, 4vw, 64px);
            display: flex;
            align-items: flex-start;
            gap: clamp(40px, 6vw, 120px);
          }

          /* Left column */
          .ct-intro { flex: 1; min-width: 0; padding-top: 8px; }
          .ct-eyebrow {
            font-weight: 600; font-size: 16px; color: #FF8A00;
          }
          .ct-title {
            margin: 10px 0 20px;
            font-weight: 700;
            font-size: clamp(1.9rem, 3.4vw, 34px);
            line-height: 1.2;
            color: #1A1D21;
          }
          .ct-lede, .ct-para {
            margin: 0 0 18px;
            font-weight: 400; font-size: 15px; line-height: 24px;
            color: rgba(26, 29, 33, 0.7);
            max-width: 560px;
          }
          .ct-para strong { color: #1A1D21; font-weight: 600; }
          .ct-link { color: #FF8A00; text-decoration: none; font-weight: 500; }
          .ct-link:hover { text-decoration: underline; }
          .ct-subhead {
            margin: 32px 0 16px;
            font-weight: 700; font-size: 22px; line-height: 30px;
            color: #1A1D21;
          }
          .ct-email {
            display: inline-flex; align-items: center; gap: 12px;
            font-weight: 500; font-size: 15px; color: #1A1D21; text-decoration: none;
          }
          .ct-email-icon {
            display: inline-flex; align-items: center; justify-content: center;
            width: 30px; height: 30px; border-radius: 7px;
            background: rgba(255, 138, 0, 0.12); color: #FF8A00; flex-shrink: 0;
          }
          .ct-email:hover { color: #FF8A00; }

          /* Right form card */
          .ct-card {
            width: 560px;
            max-width: 100%;
            flex-shrink: 0;
            background: #FFFFFF;
            border: 1px solid rgba(26, 29, 33, 0.1);
            border-radius: 12px;
            box-shadow: 0 16px 48px rgba(17, 19, 21, 0.08);
            padding: 32px;
            box-sizing: border-box;
          }
          .ct-card-title {
            margin: 0 0 28px;
            text-align: center;
            font-weight: 700; font-size: 24px; line-height: 32px;
            color: #1A1D21;
          }
          .ct-field { margin-bottom: 18px; display: flex; flex-direction: column; gap: 8px; }
          .ct-field label { font-weight: 500; font-size: 14px; color: #1A1D21; }
          .ct-req { color: #FF8A00; }
          .ct-field input, .ct-field textarea {
            width: 100%;
            box-sizing: border-box;
            padding: 11px 14px;
            font-family: inherit;
            font-size: 15px;
            color: #1A1D21;
            background: #FFFFFF;
            border: 1px solid rgba(26, 29, 33, 0.2);
            border-radius: 8px;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
            resize: vertical;
          }
          .ct-field input::placeholder, .ct-field textarea::placeholder { color: rgba(26,29,33,0.4); }
          .ct-field input:focus, .ct-field textarea:focus {
            border-color: #FF8A00;
            box-shadow: 0 0 0 3px rgba(255, 138, 0, 0.15);
          }
          .ct-error { margin: 0 0 14px; font-size: 14px; color: #D64545; }
          .ct-privacy {
            margin: 6px 0 18px;
            font-size: 13px; line-height: 19px;
            color: rgba(26, 29, 33, 0.6);
          }
          .ct-btn {
            display: inline-flex; align-items: center; justify-content: center;
            width: 100%; height: 48px;
            border: none; border-radius: 6px;
            background: linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%);
            color: #FFFFFF; font-family: inherit; font-weight: 600; font-size: 15px;
            text-decoration: none; cursor: pointer;
            transition: opacity 0.15s;
          }
          .ct-btn:hover { opacity: 0.9; }
          .ct-btn:disabled { opacity: 0.6; cursor: default; }

          .ct-success { text-align: center; padding: 16px 8px; }
          .ct-check {
            display: inline-flex; align-items: center; justify-content: center;
            width: 56px; height: 56px; border-radius: 50%;
            background: rgba(255, 138, 0, 0.12); color: #FF8A00; margin-bottom: 20px;
          }
          .ct-success h2 { margin: 0 0 8px; font-weight: 600; font-size: 22px; color: #1A1D21; }
          .ct-success p { margin: 0 0 24px; font-size: 15px; line-height: 23px; color: rgba(26,29,33,0.7); }

          @media (max-width: 900px) {
            .ct-main { flex-direction: column; }
            .ct-intro, .ct-card { width: 100%; max-width: 560px; }
          }
        `}</style>
      </div>
    </SiteContent>
  )
}

export default Contact
