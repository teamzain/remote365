import React, { useState, useEffect } from 'react';
import {
   Building2,
   Users,
   ShieldCheck,
   Check,
   AlertCircle,
   Loader2,
   Settings,
   ChevronRight,
   Shield,
   Tag,
   CreditCard,
   Crown
} from 'lucide-react';
import api from '../lib/api';

export const SnowOrgSettings: React.FC = () => {
   const [org, setOrg] = useState<any>(null);
   const [loading, setLoading] = useState(true);
   const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

   // Settings state
   const [defaultMemberRole, setDefaultMemberRole] = useState('VIEWER');
   const [require2FA, setRequire2FA] = useState(false);

   useEffect(() => {
      fetchOrg();
   }, []);

   const fetchOrg = async () => {
      try {
         const { data } = await api.get('/api/organizations/mine');
         setOrg(data);
         setDefaultMemberRole(data.defaultMemberRole || 'VIEWER');
         setRequire2FA(data.require2FA || false);
      } catch (e) {
         console.error('Failed to fetch org');
      } finally {
         setLoading(false);
      }
   };

   const handleUpdate = async () => {
      setSaveStatus('saving');
      try {
         await api.patch('/api/organizations/mine', {
            defaultMemberRole,
            require2FA
         });
         setSaveStatus('saved');
         setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
         setSaveStatus('error');
      }
   };

   const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
      <button
         onClick={() => onChange(!checked)}
         className={`w-10 h-6 rounded-full transition-colors relative ${checked ? 'bg-[#1C1C1C]' : 'bg-[rgba(28,28,28,0.1)]'}`}
      >
         <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${checked ? 'left-5' : 'left-1'}`} />
      </button>
   );

   if (loading) return (
      <div className="flex items-center justify-center py-20">
         <Loader2 size={32} className="animate-spin text-[rgba(28,28,28,0.1)]" />
      </div>
   );

   return (
      <div className="max-w-4xl mx-auto font-lato animate-in fade-in duration-500 pb-20">

         {/* Org Header */}
         <div className="bg-[#1C1C1C] rounded-[32px] p-8 mb-8 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px] -mr-32 -mt-32 rounded-full" />
            <div className="relative z-10 flex items-center justify-between">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[24px] bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                     <Building2 size={32} className="text-white" />
                  </div>
                  <div>
                     <h1 className="text-3xl font-extrabold tracking-tight">{org?.name}</h1>
                     <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                        <Tag size={12} /> ID: {org?.slug}
                     </p>
                  </div>
               </div>
               <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                  <Crown size={14} className="text-amber-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{org?.plan || 'TRIAL'}</span>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Policy Configuration */}
            <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm space-y-8">
               <h3 className="text-sm font-bold text-[#1C1C1C] flex items-center gap-2 uppercase tracking-tight">
                  <ShieldCheck size={16} className="text-green-500" /> Security Policies
               </h3>

               <div className="space-y-6">
                  <div className="flex items-center justify-between">
                     <div>
                        <span className="font-bold text-sm text-[#1C1C1C]">Enforce 2FA</span>
                        <p className="text-[10px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Require all members to have 2FA enabled to access devices</p>
                     </div>
                     <Toggle checked={require2FA} onChange={setRequire2FA} />
                  </div>

                  <div className="space-y-3 pt-2">
                     <span className="font-bold text-sm text-[#1C1C1C]">Default Member Role</span>
                     <p className="text-[10px] font-medium text-[rgba(28,28,28,0.4)] mb-4">Initial permissions assigned to newly invited organization members</p>
                     <div className="grid grid-cols-2 gap-2">
                        {['ADMIN', 'VIEWER'].map(r => (
                           <button
                              key={r}
                              onClick={() => setDefaultMemberRole(r)}
                              className={`py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${defaultMemberRole === r ? 'bg-[#1C1C1C] text-white border-[#1C1C1C]' : 'bg-[#F9F9FA] text-[rgba(28,28,28,0.4)] border-[rgba(28,28,28,0.04)] hover:border-[rgba(28,28,28,0.2)]'}`}
                           >
                              {r}
                           </button>
                        ))}
                     </div>
                  </div>
               </div>

               <div className="pt-4">
                  <button
                     onClick={handleUpdate}
                     disabled={saveStatus === 'saving'}
                     className="w-full py-3 bg-[#1C1C1C] text-white rounded-xl text-xs font-bold shadow-lg shadow-black/5 flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                  >
                     {saveStatus === 'saving' ? <Loader2 size={14} className="animate-spin" /> : saveStatus === 'saved' ? <Check size={14} /> : null}
                     {saveStatus === 'saved' ? 'Settings Saved' : 'Apply Changes'}
                  </button>
               </div>
            </div>

            {/* Access & Members Quick Links */}
            <div className="space-y-8">
               <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
                  <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 flex items-center gap-2 uppercase tracking-tight">
                     <Users size={16} className="text-blue-500" /> Fleet Management
                  </h3>
                  <div className="space-y-3">
                     <div className="p-4 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.04)] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[rgba(28,28,28,0.2)] shadow-sm">
                              <Users size={18} />
                           </div>
                           <div>
                              <span className="text-xs font-bold text-[#1C1C1C]">Active Members</span>
                              <p className="text-[10px] font-medium text-[rgba(28,28,28,0.4)] mt-0.5">{org?._count?.users || 0} Registered Seats</p>
                           </div>
                        </div>
                        <ChevronRight size={14} className="text-[rgba(28,28,28,0.2)]" />
                     </div>
                     <div className="p-4 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.04)] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[rgba(28,28,28,0.2)] shadow-sm">
                              <Tag size={18} />
                           </div>
                           <div>
                              <span className="text-xs font-bold text-[#1C1C1C]">Asset Tags</span>
                              <p className="text-[10px] font-medium text-[rgba(28,28,28,0.4)] mt-0.5">Global Device Organization Tags</p>
                           </div>
                        </div>
                        <ChevronRight size={14} className="text-[rgba(28,28,28,0.2)]" />
                     </div>
                  </div>
               </div>

               <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
                  <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 flex items-center gap-2 uppercase tracking-tight">
                     <CreditCard size={16} className="text-orange-500" /> Subscription & Limits
                  </h3>
                  <div className="p-5 bg-orange-50/40 border border-orange-100/50 rounded-2xl">
                     <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Active Plan</span>
                        <span className="text-[10px] font-mono font-bold text-orange-600">{org?.plan || 'TRIAL'}</span>
                     </div>
                     <div className="space-y-3">
                        <div className="flex items-center justify-between text-[11px] font-medium text-[rgba(28,28,28,0.6)]">
                           <span>Device Limit</span>
                           <span>{org?._count?.devices || 0} / {org?.plan === 'TRIAL' ? '3' : org?.plan === 'SOLO' ? '10' : org?.plan === 'PRO' ? '50' : org?.plan === 'BUSINESS' ? '200' : '∞'}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white rounded-full overflow-hidden">
                           <div
                              className="h-full bg-orange-400 rounded-full"
                              style={{ width: `${Math.min(100, ((org?._count?.devices || 0) / (org?.plan === 'TRIAL' ? 3 : org?.plan === 'SOLO' ? 10 : org?.plan === 'PRO' ? 50 : org?.plan === 'BUSINESS' ? 200 : Math.max(org?._count?.devices || 1, 1))) * 100)}%` }}
                           />
                        </div>
                     </div>
                     <button className="w-full mt-6 py-2.5 bg-white border border-orange-100 text-orange-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-orange-50 transition-all">
                        View Billing Console
                     </button>
                  </div>
               </div>
            </div>

         </div>

      </div>
   );
};
