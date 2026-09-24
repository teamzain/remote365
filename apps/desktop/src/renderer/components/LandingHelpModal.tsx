import React, { useState } from 'react';
import { ChevronDown, CircleHelp, Loader2, Mail, Send, X } from 'lucide-react';
import api from '../lib/api';

const FAQ: { q: string; a: string }[] = [
  { q: 'How do I let someone control this computer?', a: 'Share the ID and password shown on this screen with your supporter, or turn on Easy Access after signing in so trusted accounts connect without the password.' },
  { q: 'How do I connect to another computer?', a: 'Enter the other computer\'s Remote Device ID under Remote Session and click Join Session. Sign in to see all your saved devices.' },
  { q: 'I did not receive the verification email.', a: 'Wait a minute, then check your spam or junk folder. Use Resend Code on the verification screen; the same code is sent again.' },
  { q: 'Which email can I use for a Business account?', a: 'Business accounts need a company mailbox. Personal providers such as Gmail, Outlook or Yahoo are accepted for Personal accounts only.' },
  { q: 'The device shows Offline.', a: 'Make sure Remote365 is running on that computer and it has internet access. Turn on "Start Remote365 With Windows" so it comes back online after a restart.' },
];

/**
 * Help & Support for the signed-out landing and sign-in screens: quick
 * answers plus a contact form that emails the support team (no account
 * needed) and confirms by email.
 */
export const LandingHelpModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim() || !email.trim() || !message.trim()) { setError('Please fill in your name, email and message.'); return; }
    setStatus('sending');
    try {
      await api.post('/api/support/contact', { name: name.trim(), email: email.trim(), subject: 'Help request from the Remote365 app', message: message.trim() });
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.error || 'Could not send your message. Please try again.');
    }
  };

  const input = 'h-10 w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] text-[#111315] outline-none focus:border-[#FF8A00]';

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4 font-['Mona_Sans',system-ui,sans-serif]" role="dialog" aria-label="Help And Support">
      <div className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[12px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[rgba(26,29,33,0.1)] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF1E0] text-[#FF8A00]"><CircleHelp size={16} /></span>
            <div>
              <h3 className="m-0 text-[16px] font-semibold text-[#111315]">Help And Support</h3>
              <p className="m-0 text-[12px] text-[rgba(26,29,33,0.55)]">Quick answers, or send us a message</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-[rgba(26,29,33,0.55)] hover:bg-[#F3F4F6]"><X size={16} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <p className="m-0 mb-2 text-[12px] font-medium text-[rgba(26,29,33,0.5)]">Common Questions</p>
          <div className="overflow-hidden rounded-[8px] border border-[rgba(26,29,33,0.12)]">
            {FAQ.map((item, index) => (
              <div key={item.q} className={index > 0 ? 'border-t border-[rgba(26,29,33,0.08)]' : ''}>
                <button type="button" onClick={() => setOpenIndex(openIndex === index ? null : index)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13px] font-medium text-[#111315] hover:bg-[#FAFAFB]">
                  {item.q}
                  <ChevronDown size={15} className={`flex-none text-[rgba(26,29,33,0.45)] transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
                </button>
                {openIndex === index && <p className="m-0 px-4 pb-3 text-[13px] leading-5 text-[rgba(26,29,33,0.7)]">{item.a}</p>}
              </div>
            ))}
          </div>

          <p className="m-0 mb-2 mt-5 text-[12px] font-medium text-[rgba(26,29,33,0.5)]">Contact Support</p>
          {status === 'sent' ? (
            <div className="flex items-center gap-3 rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-[13px] text-[#166534]">
              <Mail size={16} /> Message sent. We replied with a confirmation to {email.trim()} and will get back to you soon.
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" className={input} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your Email" className={input} />
              </div>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="How can we help?" className="w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 py-2 text-[14px] text-[#111315] outline-none focus:border-[#FF8A00]" />
              {error && <p className="m-0 text-[12px] font-medium text-[#D64545]">{error}</p>}
              <button type="submit" disabled={status === 'sending'} className="flex h-10 items-center justify-center gap-2 self-end rounded-[4px] px-5 text-[14px] font-medium text-[#111315] disabled:opacity-50" style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}>
                {status === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send Message
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingHelpModal;
