import React from 'react';
import { 
  Zap, 
  Shield, 
  Copy, 
  RefreshCw, 
  Power, 
  Globe, 
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Link,
  FolderPlus
} from 'lucide-react';
import { t } from '../lib/translations';
import { useAuthStore } from '../store/authStore';

interface SnowHostProps {
  status: 'idle' | 'connecting' | 'error' | 'status' | '';
  accessKey: string;
  isAutoHost: boolean;
  setIsAutoHost: (val: boolean) => void;
  handleStartHosting: () => void;
  handleStopHosting: () => void;
  copyAccessKey: () => void;
  openPasswordModal: () => void;
  bandwidth: string;
  activeUsers: number;
  devicePassword?: string;
  isRegistered?: boolean;
  onRegister?: () => void;
}

export const SnowHost: React.FC<SnowHostProps> = ({ 
  status, 
  accessKey, 
  isAutoHost, 
  setIsAutoHost,
  handleStartHosting,
  handleStopHosting,
  copyAccessKey,
  openPasswordModal,
  bandwidth,
  activeUsers,
  devicePassword,
  isRegistered = true,
  onRegister
}) => {
  const { user } = useAuthStore();
  const lang = user?.language;
  const isOnline = status === 'status' || status === 'connecting';
  const isConnecting = status === 'connecting';

  if (!isRegistered) {
    return (
      <div className="max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-8 duration-700 font-lato">
        <div className="w-24 h-24 rounded-[32px] bg-[rgba(28,28,28,0.04)] border border-[rgba(28,28,28,0.06)] flex items-center justify-center mb-8 relative group">
          <Globe size={40} className="text-[rgba(28,28,28,0.2)] group-hover:text-[#1C1C1C] transition-colors duration-500" />
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full border border-[rgba(28,28,28,0.06)] flex items-center justify-center shadow-sm">
             <Shield size={12} className="text-orange-400" />
          </div>
        </div>

        <h2 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-4 uppercase text-center">{t('identity_not_initialized', lang)}</h2>
        <p className="text-sm text-[rgba(28,28,28,0.4)] font-medium text-center max-w-md mb-12 leading-relaxed">
          {t('identity_not_initialized_desc', lang)}
        </p>

        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
           <button 
             onClick={onRegister}
             className="w-full h-14 bg-[#1C1C1C] text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3 group"
           >
             <Zap size={16} className="group-hover:scale-110 transition-transform" fill="currentColor" />
             {t('initialize_node', lang)}
           </button>
           
           <div className="flex items-center gap-6 pt-4 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">
              <div className="flex items-center gap-2">
                 <Lock size={12} /> {t('encrypted', lang)}
              </div>
              <div className="w-1 h-1 rounded-full bg-[rgba(28,28,28,0.1)]" />
              <div className="flex items-center gap-2">
                 <Shield size={12} /> {t('secure_link', lang)}
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-lato">
      
      {/* Hero Status Card */}
      <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm relative overflow-hidden">
        {/* Background Accent */}
        <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-20 ${isOnline ? 'bg-green-400' : 'bg-blue-400'}`} />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${isOnline ? 'bg-[rgba(113,221,140,0.1)] text-[#71DD8C]' : 'bg-[rgba(28,28,28,0.04)] text-[rgba(28,28,28,0.2)]'}`}>
              {isConnecting ? <Loader2 size={32} className="animate-spin" /> : <Zap size={32} fill={isOnline ? 'currentColor' : 'none'} />}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-[#1C1C1C] tracking-tight text-nowrap">
                  {isOnline ? t('broadcasting_active', lang) : t('hosting_offline', lang)}
                </h2>
                {isOnline && !isConnecting && (
                  <div className="flex items-center gap-2 bg-[#71DD8C]/10 px-2 py-0.5 rounded-full border border-[#71DD8C]/20">
                    <div className="w-2 h-2 rounded-full bg-[#71DD8C] animate-pulse" />
                    <span className="text-[10px] font-black text-[#71DD8C] tracking-widest uppercase">{t('live', lang)}</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-[rgba(28,28,28,0.4)] font-medium mt-1">
                {isOnline ? t('hosting_active_desc', lang) : t('hosting_offline_desc', lang)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
             {isOnline && (
               <button 
                 onClick={() => (window as any).electronAPI?.sendFileToViewer()}
                 className="h-11 px-6 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all flex items-center gap-2 border border-blue-100"
               >
                 <FolderPlus size={16} /> {t('deploy_payload', lang)}
               </button>
             )}
             {isOnline ? (
               <div className="h-11 px-6 flex items-center gap-2 text-[#71DD8C] font-bold text-xs uppercase tracking-widest">
                  <CheckCircle2 size={16} /> {t('live', lang)}
               </div>
             ) : (
               <button 
                 onClick={handleStartHosting}
                 disabled={isConnecting}
                 className="h-11 px-8 bg-[#1C1C1C] text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-black/10 disabled:opacity-50"
               >
                 {isConnecting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} {t('start_hosting', lang)}
               </button>
             )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Network Identity */}
        <div className="bg-[#F9F9FA] rounded-[24px] border border-[rgba(28,28,28,0.04)] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-[rgba(28,28,28,0.4)]" />
            <h3 className="text-sm font-semibold text-[#1C1C1C]">{t('network_identity', lang)}</h3>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl p-4 border border-[rgba(28,28,28,0.1)] flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mb-1">{t('access_key', lang)}</span>
                <span className="text-lg font-mono font-bold text-[#1C1C1C] tracking-wider">{accessKey || '--- --- ---'}</span>
              </div>
              <button 
                onClick={copyAccessKey}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-[rgba(28,28,28,0.02)] hover:bg-[rgba(28,28,28,0.05)] text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] transition-all"
              >
                <Copy size={18} />
              </button>
            </div>
            
            <p className="text-xs text-[rgba(28,28,28,0.4)] leading-relaxed px-1">
              {t('share_key_desc', lang)}
            </p>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm">
           <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-[rgba(28,28,28,0.4)]" />
            <h3 className="text-sm font-semibold text-[#1C1C1C]">{t('host_security', lang)}</h3>
          </div>

          <div className="flex flex-col gap-3">


             <div className="flex flex-col gap-2 py-2">
                <div className="flex items-center justify-between mb-1">
                   <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#1C1C1C]">{t('device_password', lang)}</span>
                      <span className="text-[10px] text-[rgba(28,28,28,0.4)]">System Generated Or Custom</span>
                   </div>
                   <button 
                     onClick={openPasswordModal}
                     className="px-3 py-1.5 bg-[rgba(28,28,28,0.02)] hover:bg-[rgba(28,28,28,0.05)] border border-[rgba(28,28,28,0.1)] rounded-lg text-xs font-bold text-[#1C1C1C] transition-all flex items-center gap-1.5"
                   >
                     <Lock size={12} /> {t('configure', lang)}
                   </button>
                </div>
                
                <div className="bg-[#F9F9FA] rounded-xl p-3 border border-[rgba(28,28,28,0.06)] flex items-center justify-between">
                   <span className="text-sm font-mono font-bold text-[#1C1C1C] tracking-widest">{devicePassword || '••••••••'}</span>
                   <button 
                     onClick={() => {
                        if (devicePassword) {
                            const electronApi = (window as any).electronAPI;
                            if (electronApi?.clipboard?.writeText) electronApi.clipboard.writeText(devicePassword);
                            else navigator.clipboard.writeText(devicePassword);
                        }
                     }}
                     className="w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-[rgba(28,28,28,0.05)] border border-[rgba(28,28,28,0.06)] text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] transition-all"
                   >
                     <Copy size={14} />
                   </button>
                </div>
             </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50/50 border border-blue-100/50 rounded-xl flex gap-3">
             <Lock size={14} className="text-blue-400 shrink-0 mt-0.5" />
             <p className="text-[10px] text-blue-600/80 font-medium leading-normal">
               {t('e2e_active', lang)}
             </p>
          </div>
        </div>

      </div>

      {/* Connection Log Section */}
      <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm overflow-hidden">
        <h3 className="text-sm font-semibold text-[#1C1C1C] mb-4">{t('traffic_insights', lang)}</h3>
        <div className="space-y-4">
           {[
             { name: t('bandwidth', lang), val: `${bandwidth || '0.00'} Mbps`, icon: RefreshCw },
             { name: t('active_users', lang), val: `${activeUsers || 0} ${t('authorized', lang)}`, icon: Zap },
             { name: t('stability', lang), val: isOnline ? `99.9% ${t('high', lang)}` : t('hosting_offline', lang), icon: CheckCircle2, color: isOnline ? 'text-green-500' : 'text-[rgba(28,28,28,0.2)]' }
           ].map((stat, i) => (
             <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-[rgba(28,28,28,0.01)] transition-all">
               <div className="flex items-center gap-3">
                 <stat.icon size={16} className={`text-[rgba(28,28,28,0.2)] ${stat.name === t('bandwidth', lang) && Number(bandwidth) > 0 ? 'animate-spin-slow' : ''}`} />
                 <span className="text-sm font-medium text-[#1C1C1C] opacity-80">{stat.name}</span>
               </div>
               <span className={`text-sm font-bold ${stat.color || 'text-[#1C1C1C]'}`}>{stat.val}</span>
             </div>
           ))}
        </div>
      </div>

    </div>
  );
};
