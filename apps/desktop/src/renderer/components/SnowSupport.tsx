import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import {
  LifeBuoy,
  Search,
  MessageCircle,
  Mail,
  ShieldCheck,
  Globe,
  Zap,
  History,
  ChevronRight,
  Plus,
  X,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { t } from '../lib/translations';
import { useAuthStore } from '../store/authStore';

interface Ticket {
  id: string;
  subject: string;
  status: 'In Review' | 'Closed' | 'Open';
  date: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Open': 'bg-amber-100 text-[#D4A017]',
  'In Review': 'bg-[#71DD8C]/20 text-[#3aaa5c]',
  'Closed': 'bg-slate-100 text-slate-500',
};

export const SnowSupport: React.FC = () => {
  const { user } = useAuthStore();
  const lang = user?.language;
  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const commonTopics = [
    { title: t('global_device_optimization', lang), icon: Globe, color: 'text-[#D4A017]', bg: 'bg-amber-50/50', desc: t('global_device_optimization_desc', lang) },
    { title: t('identity_access_keys', lang), icon: ShieldCheck, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', desc: t('identity_access_keys_desc', lang) },
    { title: t('p2p_signaling_relays', lang), icon: Zap, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', desc: t('p2p_signaling_relays_desc', lang) },
  ];

  useEffect(() => {
    api.get('/api/support/tickets').then(res => {
      const mapped = res.data.map((t: any) => ({
        id: t.displayId,
        subject: t.subject,
        status: t.status,
        date: new Date(t.createdAt).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US')
      }));
      setTickets(mapped);
    }).catch(err => console.error('Failed to fetch tickets', err));
  }, [lang]);

  const [showNewCase, setShowNewCase] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [caseStatus, setCaseStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle');

  const [showChatModal, setShowChatModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubject, setReportSubject] = useState('');
  const [reportBody, setReportBody] = useState('');
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const q = query.toLowerCase().trim();
  const filteredTickets = tickets.filter(t =>
    !q || t.subject.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
  );

  const handleSubmitCase = async () => {
    if (!newSubject.trim()) return;
    setCaseStatus('submitting');
    try {
      const { data } = await api.post('/api/support/tickets', {
        subject: newSubject.trim(),
        description: newDescription.trim(),
        category: newCategory
      });
      const newTicket: Ticket = {
        id: data.displayId,
        subject: data.subject,
        status: data.status as any,
        date: t('just_now', lang)
      };
      setTickets(prev => [newTicket, ...prev]);
      setCaseStatus('submitted');
      setTimeout(() => {
        setShowNewCase(false);
        setNewSubject('');
        setNewDescription('');
        setNewCategory('');
        setCaseStatus('idle');
      }, 1500);
    } catch (err) {
      setCaseStatus('idle');
    }
  };

  const handleSendReport = async () => {
    if (!reportSubject.trim() || !reportBody.trim()) return;
    setReportStatus('sending');
    try {
      await api.post('/api/support/report', {
        subject: reportSubject.trim(),
        description: reportBody.trim()
      });
      setReportStatus('sent');
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubject('');
        setReportBody('');
        setReportStatus('idle');
      }, 1800);
    } catch (err) {
      setReportStatus('idle');
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700 font-lato pb-20">

      {/* Support Hero */}
      <div className="bg-[#1C1C1C] rounded-[40px] p-12 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#D4A017]/20 blur-[100px] -mr-32 -mt-32 rounded-full" />

        <div className="relative z-10 max-w-xl">
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">{t('how_can_help', lang)}</h1>
          <p className="text-white/40 text-lg font-medium mb-8">
            {t('support_hero_desc', lang)}
          </p>

          <div className="flex items-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 pl-5 pr-2 py-2 w-full focus-within:ring-2 focus-within:ring-white/20 transition-all">
            <Search size={18} className="text-white/40 mr-3 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('search_help_placeholder', lang)}
              className="bg-transparent border-none outline-none text-sm text-white placeholder:text-white/20 w-full"
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 text-white/30 hover:text-white/60 mr-1">
                <X size={14} />
              </button>
            )}
            <button className="px-5 py-2 bg-white text-[#1C1C1C] rounded-xl text-xs font-bold hover:opacity-90 transition-all shrink-0">{t('search', lang)}</button>
          </div>
        </div>
      </div>

      {/* Common Topics */}
      {!q && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {commonTopics.map((topic, i) => (
            <div key={i} className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm hover:border-[rgba(28,28,28,0.2)] transition-all cursor-pointer group">
              <div className={`w-12 h-12 rounded-2xl ${topic.bg} ${topic.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <topic.icon size={24} />
              </div>
              <h3 className="text-sm font-bold text-[#1C1C1C] mb-2">{topic.title}</h3>
              <p className="text-[10px] font-medium text-[rgba(28,28,28,0.4)] leading-relaxed">{topic.desc}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">

        {/* Ticket List */}
        <div className="flex-[2] bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-[#1C1C1C] tracking-tight flex items-center gap-3">
              <History size={18} className="text-[rgba(28,28,28,0.2)]" /> {t('active_assistance_cases', lang)}
            </h3>
            <button
              onClick={() => setShowNewCase(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-[rgba(28,28,28,0.02)] hover:bg-[rgba(28,28,28,0.05)] text-[#1C1C1C] rounded-xl text-[10px] font-bold border border-[rgba(28,28,28,0.04)] transition-all"
            >
              {showNewCase ? <X size={14} /> : <Plus size={14} />}
              {showNewCase ? t('cancel', lang) : t('new_case', lang)}
            </button>
          </div>

          {/* New Case Form */}
          {showNewCase && (
            <div className="mb-6 p-5 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.06)] space-y-3 animate-in slide-in-from-top-2 duration-200">
              <h4 className="text-xs font-bold text-[#1C1C1C] mb-3">{t('new_support_case', lang)}</h4>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-white rounded-xl border border-[rgba(28,28,28,0.08)] text-xs text-[#1C1C1C] outline-none"
              >
                <option value="">{t('select_category', lang)}</option>
                <option value="Device Connectivity">{t('device_connectivity', lang)}</option>
                <option value="Billing & Subscription">{t('billing_subscription', lang)}</option>
                <option value="Authentication / Access Keys">{t('auth_access_keys', lang)}</option>
                <option value="Performance / Latency">{t('performance_latency', lang)}</option>
                <option value="Other">{t('other', lang)}</option>
              </select>
              <input
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                placeholder={t('subject_placeholder', lang)}
                className="w-full px-3 py-2.5 bg-white rounded-xl border border-[rgba(28,28,28,0.08)] text-xs text-[#1C1C1C] placeholder:text-[rgba(28,28,28,0.25)] outline-none"
              />
              <textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder={t('desc_placeholder', lang)}
                rows={3}
                className="w-full px-3 py-2.5 bg-white rounded-xl border border-[rgba(28,28,28,0.08)] text-xs text-[#1C1C1C] placeholder:text-[rgba(28,28,28,0.25)] outline-none resize-none"
              />
              <button
                onClick={handleSubmitCase}
                disabled={!newSubject.trim() || caseStatus === 'submitting'}
                className="w-full h-9 rounded-xl bg-[#00193F] text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-[#002255] transition-all"
              >
                {caseStatus === 'submitting' && <Loader2 size={13} className="animate-spin" />}
                {caseStatus === 'submitted' && <Check size={13} />}
                {caseStatus === 'submitted' ? t('case_created', lang) : caseStatus === 'submitting' ? t('submitting', lang) : t('submit_case', lang)}
              </button>
            </div>
          )}

          {/* Ticket List */}
          <div className="space-y-3">
            {filteredTickets.length > 0 ? filteredTickets.map((ticket, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[24px] border border-[rgba(28,28,28,0.02)] hover:border-[rgba(28,28,28,0.1)] transition-all cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[rgba(28,28,28,0.4)] group-hover:text-black shadow-sm shrink-0">
                    <MessageCircle size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#1C1C1C]">{ticket.subject}</span>
                    <span className="text-[10px] text-[rgba(28,28,28,0.4)]">{ticket.id} • {t('last_activity', lang)} {ticket.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${STATUS_COLORS[ticket.status] || 'bg-slate-100 text-slate-500'}`}>
                    {ticket.status}
                  </span>
                  <ChevronRight size={14} className="text-[rgba(28,28,28,0.1)] group-hover:text-[rgba(28,28,28,0.3)] transition-colors" />
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-[rgba(28,28,28,0.3)]">
                <LifeBuoy size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-xs font-semibold">
                  {q ? `${t('no_tickets_matched', lang)} "${query}"` : t('no_open_cases', lang)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Contact Panel */}
        <div className="flex-1 space-y-4">
          <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-[20px] text-blue-500 flex items-center justify-center mb-6">
              <MessageCircle size={32} />
            </div>
            <h3 className="text-sm font-bold text-[#1C1C1C] mb-2">{t('live_tech_support', lang)}</h3>
            <p className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium mb-6 leading-relaxed">
              {t('live_tech_support_desc', lang)}
            </p>
            <button
              onClick={() => setShowChatModal(true)}
              className="w-full py-3 bg-[#00193F] text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-900/10 hover:bg-[#002255] transition-all"
            >
              {t('start_chat_case', lang)}
            </button>
          </div>

          <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#10B981]/10 rounded-[20px] text-[#10B981] flex items-center justify-center mb-6">
              <Mail size={32} />
            </div>
            <h3 className="text-sm font-bold text-[#1C1C1C] mb-2">{t('technical_ticketing', lang)}</h3>
            <p className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium mb-6 leading-relaxed">
              {t('technical_ticketing_desc', lang)}
            </p>
            <button
              onClick={() => setShowReportModal(true)}
              className="w-full py-3 bg-[#F9F9FA] text-[#1C1C1C] rounded-2xl text-xs font-bold border border-[rgba(28,28,28,0.04)] hover:border-[rgba(28,28,28,0.2)] transition-all"
            >
              {t('send_report', lang)}
            </button>
          </div>
        </div>
      </div>

      {/* Live Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-[28px] shadow-2xl border border-[rgba(28,28,28,0.06)] p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-[#1C1C1C]">{t('live_tech_support', lang)}</h3>
              <button onClick={() => setShowChatModal(false)} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] hover:bg-[#F9F9FA] rounded-xl transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 mb-6">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
              <p className="text-xs text-amber-700 font-medium">3 {t('engineers_available_short', lang)} · Avg wait: ~2 min</p>
            </div>
            <p className="text-xs text-[rgba(28,28,28,0.5)] mb-6 leading-relaxed">
              {t('chat_modal_desc', lang)}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowChatModal(false)} className="flex-1 py-3 bg-[#F9F9FA] text-[#1C1C1C] rounded-2xl text-xs font-bold border border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)] transition-all">
                {t('cancel', lang)}
              </button>
              <button onClick={() => setShowChatModal(false)} className="flex-1 py-3 bg-[#00193F] text-white rounded-2xl text-xs font-bold hover:bg-[#002255] transition-all">
                {t('join_queue', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-[28px] shadow-2xl border border-[rgba(28,28,28,0.06)] p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-[#1C1C1C]">{t('send_technical_report', lang)}</h3>
              <button onClick={() => { setShowReportModal(false); setReportStatus('idle'); }} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] hover:bg-[#F9F9FA] rounded-xl transition-colors">
                <X size={16} />
              </button>
            </div>

            {reportStatus === 'sent' ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={24} className="text-green-500" />
                </div>
                <h4 className="text-sm font-bold text-[#1C1C1C] mb-1">{t('report_sent', lang)}</h4>
                <p className="text-xs text-[rgba(28,28,28,0.4)]">{t('report_sent_desc', lang)}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  value={reportSubject}
                  onChange={e => setReportSubject(e.target.value)}
                  placeholder={t('subject', lang)}
                  className="w-full px-3 py-2.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.06)] text-xs text-[#1C1C1C] placeholder:text-[rgba(28,28,28,0.25)] outline-none"
                />
                <textarea
                  value={reportBody}
                  onChange={e => setReportBody(e.target.value)}
                  placeholder={t('report_desc_placeholder', lang)}
                  rows={5}
                  className="w-full px-3 py-2.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.06)] text-xs text-[#1C1C1C] placeholder:text-[rgba(28,28,28,0.25)] outline-none resize-none"
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowReportModal(false)} className="flex-1 py-3 bg-[#F9F9FA] text-[#1C1C1C] rounded-2xl text-xs font-bold border border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)] transition-all">
                    {t('cancel', lang)}
                  </button>
                  <button
                    onClick={handleSendReport}
                    disabled={!reportSubject.trim() || !reportBody.trim() || reportStatus === 'sending'}
                    className="flex-1 py-3 bg-[#00193F] text-white rounded-2xl text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#002255] transition-all"
                  >
                    {reportStatus === 'sending' && <Loader2 size={13} className="animate-spin" />}
                    {reportStatus === 'sending' ? t('sending', lang) : t('send_report', lang)}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
