import React, { useState } from 'react';
import { X, Settings, User, Shield, Monitor, MessageSquare, Mic, Video, Info, Check } from 'lucide-react';

interface SnowSettingsModalProps {
  onClose: () => void;
  user: any;
}

export const SnowSettingsModal: React.FC<SnowSettingsModalProps> = ({ onClose, user }) => {
  const [activeTab, setActiveTab] = useState('General');
  
  const tabs = [
    { id: 'General', icon: Settings },
    { id: 'Account', icon: User },
    { id: 'Security', icon: Shield },
    { id: 'Remote Control', icon: Monitor },
    { id: 'Meeting', icon: MessageSquare },
    { id: 'Audio Conferencing', icon: Mic },
    { id: 'Video', icon: Video },
  ];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-[#1C1C1C]/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-4xl bg-white rounded-[32px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border border-[rgba(28,28,28,0.1)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 h-[640px]">
        
        {/* Modal Header */}
        <div className="bg-[#0A1229] p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center">
              <Settings size={14} className="text-white" />
            </div>
            <span className="text-xs font-bold text-white uppercase tracking-wider">Remote365 Options</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-64 bg-[#F8F9FA] border-r border-[rgba(28,28,28,0.06)] flex flex-col pt-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-4 px-6 py-4 text-left transition-all relative ${
                  activeTab === tab.id 
                    ? 'text-white' 
                    : 'text-[rgba(28,28,28,0.6)] hover:bg-[rgba(28,28,28,0.04)]'
                }`}
              >
                {activeTab === tab.id && (
                  <div className="absolute inset-0 bg-[#00A3FF] animate-in fade-in duration-300" />
                )}
                <tab.icon size={18} className="relative z-10" />
                <span className="text-sm font-bold relative z-10">{tab.id}</span>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
            <h2 className="text-2xl font-bold text-[#1C1C1C] mb-8">Most Popular Options</h2>
            
            <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-6 flex items-start gap-4 mb-10">
              <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                <Info size={18} />
              </div>
              <p className="text-xs font-medium text-blue-700 leading-relaxed">
                Hover your mouse over options to get additional info
              </p>
            </div>

            <div className="space-y-10">
              <div className="bg-[#F8F9FA] rounded-2xl p-2 px-6 py-4 border border-[rgba(28,28,28,0.04)]">
                <span className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Important Options For Working With Remote365</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1C1C1C]">Your Display Name</span>
                <input 
                  type="text" 
                  defaultValue={user?.name || 'Zain Ul Abidden'}
                  className="w-64 bg-white border border-[rgba(28,28,28,0.1)] rounded-lg px-4 py-2.5 text-sm font-medium outline-none focus:border-[#00A3FF] transition-all"
                />
              </div>

              <label className="flex items-center gap-4 cursor-pointer group">
                <div className="w-6 h-6 rounded-md bg-[#00A3FF] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <Check size={16} strokeWidth={3} />
                </div>
                <span className="text-sm font-semibold text-[#1C1C1C] group-hover:text-[#00A3FF] transition-colors">Start Remote365 With Windows</span>
              </label>

              <label className="flex items-center gap-4 cursor-pointer group opacity-60">
                <div className="w-6 h-6 rounded-md border-2 border-[rgba(28,28,28,0.1)] flex items-center justify-center text-[#1C1C1C] group-hover:border-[#1C1C1C] transition-colors">
                </div>
                <span className="text-sm font-semibold text-[#1C1C1C]">Close To Tray Menu</span>
              </label>

              <div className="pt-10 border-t border-[rgba(28,28,28,0.06)]">
                 <button className="px-8 py-3 bg-[#1C1C1C] text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-black/10">
                    Save Changes
                 </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
