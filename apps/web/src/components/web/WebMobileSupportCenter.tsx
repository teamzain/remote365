import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, FileWarning, Globe, LifeBuoy, Loader2, MessageSquare, Plus, Search, ShieldCheck, X, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { t } from '../../lib/translations';
import { useAuthStore } from '../../store/authStore';

interface Ticket {
  id: string;
  subject: string;
  status: 'In Review' | 'Closed' | 'Open';
  date: string;
}

const gradient = { background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' };
const statusPill: Record<string, string> = {
  Open: 'bg-[#FFF4E5] text-[#B45309]',
  'In Review': 'bg-[#ECFDF3] text-[#067647]',
  Closed: 'bg-[#F3F4F6] text-[#4B5563]',
};
const input = 'h-12 w-full rounded-xl border border-[rgba(26,29,33,0.2)] bg-[#F9FAFB] px-4 text-[15px] text-[#111315] outline-none focus:border-[#FF8A00]';

/**
 * Phone version of the Help page: your support cases as a list, the help
 * topics as rows, and "new case" / "send report" as bottom sheets. Same
 * endpoints as the desktop page; live support goes to the chat tab.
 */
export const WebMobileSupportCenter: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const lang = user?.language;
  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const [caseOpen, setCaseOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [caseStatus, setCaseStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle');

  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubject, setReportSubject] = useState('');
  const [reportBody, setReportBody] = useState('');
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const topics = [
    { title: t('global_device_optimization', lang), desc: t('global_device_optimization_desc', lang), icon: Globe, color: 'text-[#D4A017] bg-amber-50' },
    { title: t('identity_access_keys', lang), desc: t('identity_access_keys_desc', lang), icon: ShieldCheck, color: 'text-[#10B981] bg-[#10B981]/10' },
    { title: t('p2p_signaling_relays', lang), desc: t('p2p_signaling_relays_desc', lang), icon: Zap, color: 'text-[#F59E0B] bg-[#F59E0B]/10' },
  ];

  useEffect(() => {
    api
      .get('/api/support/tickets')
      .then((res: any) => {
        setTickets(
          (res.data || []).map((ticket: any) => ({
            id: ticket.displayId,
            subject: ticket.subject,
            status: ticket.status,
            date: new Date(ticket.createdAt).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US'),
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lang]);

  const q = query.trim().toLowerCase();
  const visible = tickets.filter((ticket) => !q || ticket.subject.toLowerCase().includes(q) || ticket.id.toLowerCase().includes(q));

  const submitCase = async () => {
    if (!subject.trim()) return;
    setCaseStatus('submitting');
    try {
      const { data } = await api.post('/api/support/tickets', { subject: subject.trim(), description: description.trim(), category });
      setTickets((prev) => [{ id: data.displayId, subject: data.subject, status: data.status, date: t('just_now', lang) }, ...prev]);
      setCaseStatus('submitted');
      window.setTimeout(() => {
        setCaseOpen(false);
        setSubject('');
        setDescription('');
        setCategory('');
        setCaseStatus('idle');
      }, 1400);
    } catch {
      setCaseStatus('idle');
    }
  };

  const sendReport = async () => {
    if (!reportSubject.trim() || !reportBody.trim()) return;
    setReportStatus('sending');
    try {
      await api.post('/api/support/report', { subject: reportSubject.trim(), description: reportBody.trim() });
      setReportStatus('sent');
      window.setTimeout(() => {
        setReportOpen(false);
        setReportSubject('');
        setReportBody('');
        setReportStatus('idle');
      }, 1600);
    } catch {
      setReportStatus('idle');
    }
  };

  return (
    <div className="relative flex h-full flex-col bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
      <div className="flex-none px-4 pb-3 pt-4">
        <h2 className="m-0 text-[20px] font-semibold text-[#111315]">Help</h2>
        <div className="relative mt-3">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#111315]/40" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your cases" className={`${input} h-11 pl-11`} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[rgba(26,29,33,0.06)]">
        {/* quick actions */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-4">
          <button type="button" onClick={() => navigate('/dashboard/chat')} className="flex flex-col items-start gap-2 rounded-2xl border border-[rgba(26,29,33,0.1)] p-3 text-left active:bg-[#F9FAFB]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1E0] text-[#FF8A00]"><MessageSquare size={17} /></span>
            <span className="text-[13px] font-semibold text-[#111315]">{t('live_tech_support', lang)}</span>
            <span className="text-[11px] leading-4 text-[#111315]/50">Talk to us in chat.</span>
          </button>
          <button type="button" onClick={() => setReportOpen(true)} className="flex flex-col items-start gap-2 rounded-2xl border border-[rgba(26,29,33,0.1)] p-3 text-left active:bg-[#F9FAFB]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6] text-[#111315]/70"><FileWarning size={17} /></span>
            <span className="text-[13px] font-semibold text-[#111315]">{t('send_technical_report', lang)}</span>
            <span className="text-[11px] leading-4 text-[#111315]/50">Describe a problem for engineering.</span>
          </button>
        </div>

        {/* cases */}
        <div className="mt-5 px-4">
          <p className="m-0 mb-1 text-[12px] font-medium text-[#111315]/45">Your cases</p>
          {loading ? (
            <div className="flex justify-center py-6 text-[#FF8A00]"><Loader2 size={20} className="animate-spin" /></div>
          ) : visible.length === 0 ? (
            <p className="m-0 py-4 text-[13px] text-[#111315]/45">{tickets.length === 0 ? 'No cases yet. Open one with the + button.' : 'No cases match.'}</p>
          ) : (
            visible.map((ticket) => (
              <div key={ticket.id} className="flex items-center gap-3 border-b border-[rgba(26,29,33,0.06)] py-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#F3F4F6] text-[#111315]/55"><LifeBuoy size={16} /></span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[#111315]">{ticket.subject}</span>
                  <span className="block text-[12px] text-[#111315]/45">{ticket.id} · {ticket.date}</span>
                </div>
                <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPill[ticket.status] || statusPill.Open}`}>{ticket.status}</span>
              </div>
            ))
          )}
        </div>

        {/* topics */}
        <div className="mt-5 px-4">
          <p className="m-0 mb-1 text-[12px] font-medium text-[#111315]/45">Common topics</p>
          {topics.map((topic) => {
            const Icon = topic.icon;
            return (
              <button key={topic.title} type="button" onClick={() => { setSubject(topic.title); setCaseOpen(true); }} className="flex w-full items-center gap-3 border-b border-[rgba(26,29,33,0.06)] py-3 text-left active:bg-[#F9FAFB]">
                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${topic.color}`}><Icon size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-[#111315]">{topic.title}</span>
                  <span className="block truncate text-[12px] text-[#111315]/45">{topic.desc}</span>
                </span>
                <ChevronRight size={16} className="flex-none text-[#111315]/30" />
              </button>
            );
          })}
        </div>
        <div className="h-24" />
      </div>

      <button type="button" onClick={() => setCaseOpen(true)} aria-label="New support case" className="absolute bottom-5 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl active:scale-95" style={gradient}>
        <Plus size={26} />
      </button>

      {caseOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-white" role="dialog" aria-label="New support case" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
          <div className="flex h-14 flex-none items-center justify-between border-b border-[rgba(26,29,33,0.1)] px-4">
            <span className="text-[15px] font-semibold text-[#111315]">{t('new_support_case', lang)}</span>
            <button type="button" aria-label="Close" onClick={() => setCaseOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-[#111315]/55 active:bg-[#F3F4F6]"><X size={18} /></button>
          </div>
          {caseStatus === 'submitted' ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <CheckCircle2 size={44} className="text-[#34C759]" />
              <p className="m-0 text-[16px] font-semibold text-[#111315]">Case opened</p>
              <p className="m-0 text-[13px] text-[#111315]/55">We'll reply by email and you can follow it here.</p>
            </div>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); submitCase(); }} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <label className="block text-[12px] font-medium text-[#111315]/60">Subject</label>
                <input autoFocus value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What do you need help with?" className={`${input} mt-1`} />
                <label className="mt-4 block text-[12px] font-medium text-[#111315]/60">Category</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {['Connection', 'Account', 'Billing', 'Devices', 'Other'].map((item) => (
                    <button key={item} type="button" onClick={() => setCategory(category === item ? '' : item)} className={`h-9 rounded-full px-4 text-[12px] font-semibold ${category === item ? 'bg-[#111315] text-white' : 'border border-[rgba(26,29,33,0.15)] text-[#111315]/70'}`}>{item}</button>
                  ))}
                </div>
                <label className="mt-4 block text-[12px] font-medium text-[#111315]/60">Details</label>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={6} placeholder="What happened, and what did you expect?" className="mt-1 w-full rounded-xl border border-[rgba(26,29,33,0.2)] bg-[#F9FAFB] px-4 py-3 text-[15px] text-[#111315] outline-none focus:border-[#FF8A00]" />
              </div>
              <div className="flex-none border-t border-[rgba(26,29,33,0.08)] px-4 pt-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
                <button type="submit" disabled={!subject.trim() || caseStatus === 'submitting'} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white disabled:opacity-50" style={gradient}>
                  {caseStatus === 'submitting' ? <Loader2 size={16} className="animate-spin" /> : <LifeBuoy size={16} />} Open case
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-label="Send technical report">
          <button type="button" aria-label="Close" onClick={() => setReportOpen(false)} className="absolute inset-0 bg-black/40" />
          <form
            onSubmit={(event) => { event.preventDefault(); sendReport(); }}
            className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-white px-5 pt-3 shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            {reportStatus === 'sent' ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 size={40} className="text-[#34C759]" />
                <p className="m-0 text-[15px] font-semibold text-[#111315]">{t('report_sent', lang)}</p>
              </div>
            ) : (
              <>
                <p className="m-0 mt-4 text-[16px] font-semibold text-[#111315]">{t('send_technical_report', lang)}</p>
                <input value={reportSubject} onChange={(event) => setReportSubject(event.target.value)} placeholder="Subject" className={`${input} mt-3`} />
                <textarea value={reportBody} onChange={(event) => setReportBody(event.target.value)} rows={4} placeholder="Steps, device, what you saw" className="mt-2 w-full rounded-xl border border-[rgba(26,29,33,0.2)] bg-[#F9FAFB] px-4 py-3 text-[15px] text-[#111315] outline-none focus:border-[#FF8A00]" />
                <button type="submit" disabled={!reportSubject.trim() || !reportBody.trim() || reportStatus === 'sending'} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white disabled:opacity-50" style={gradient}>
                  {reportStatus === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <FileWarning size={16} />} Send report
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default WebMobileSupportCenter;
