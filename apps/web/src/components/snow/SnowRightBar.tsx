import React from 'react';
import {
  Activity,
  Monitor,
  Smartphone,
  ChevronRight
} from 'lucide-react';

interface SnowRightBarProps {
  devices: any[];
  notifications: any[];
  onDeviceClick: (device: any) => void;
}

export const SnowRightBar: React.FC<SnowRightBarProps> = ({ devices, notifications, onDeviceClick }) => {
  return (
    <aside className="w-[280px] min-w-[280px] h-full border-l border-[rgba(28,28,28,0.06)] p-6 flex flex-col bg-white overflow-y-auto custom-scrollbar font-inter z-20">
      
      {/* Top Section - Alerts */}
      <div className="mb-10 mt-8 xl:mt-0">
        <h3 className="text-[10px] font-black text-[rgba(28,28,28,0.2)] mb-6 tracking-[0.2em] uppercase">System Health</h3>
        <div className="flex flex-col gap-6">
          {notifications.map((act, i) => (
             <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
               <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${act.color} text-[#1C1C1C] shrink-0 shadow-sm transition-all`}>
                  <act.icon size={14} strokeWidth={2.5} />
               </div>
               <div className="flex flex-col">
                  <span className="text-xs text-[#1C1C1C] font-semibold leading-tight">{act.action}</span>
                  <span className="text-[10px] text-[rgba(28,28,28,0.4)] mt-1 font-medium">{act.time}</span>
               </div>
             </div>
          ))}
          {notifications.length === 0 && (
            <div className="py-4 text-center">
               <span className="text-xs text-[rgba(28,28,28,0.3)] font-medium italic">All systems reporting nominal</span>
            </div>
          )}
        </div>
      </div>

      {/* middle Section - Quick Access Devices */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6 px-1">
          <h3 className="text-[10px] font-black text-[rgba(28,28,28,0.2)] tracking-[0.2em] uppercase">Active Devices</h3>
          <span className="text-[10px] font-bold text-[#1C1C1C] px-2 py-0.5 bg-[rgba(28,28,28,0.04)] rounded-full">{devices.length}</span>
        </div>
        <div className="flex flex-col gap-2">
          {devices.slice(0, 8).map((device) => {
            const isOnline = device.is_online;
            return (
              <div 
                key={device.id} 
                onClick={() => onDeviceClick(device)}
                className={`flex items-center gap-3 p-2 rounded-2xl transition-all duration-300 border border-transparent 
                  ${isOnline 
                    ? 'cursor-pointer hover:bg-[rgba(28,28,28,0.04)] hover:border-[rgba(28,28,28,0.06)] hover:shadow-sm group' 
                    : 'opacity-50 grayscale select-none'
                  }`}
              >
                <div className={`w-9 h-9 rounded-[14px] flex items-center justify-center shrink-0 transition-all duration-500 relative
                  ${isOnline ? 'bg-[rgba(113,221,140,0.1)] text-[#71DD8C]' : 'bg-[rgba(28,28,28,0.04)] text-[rgba(28,28,28,0.2)]'}`}>
                   {device.device_type?.toLowerCase() === 'ios' || device.device_type?.toLowerCase() === 'android' ? <Smartphone size={16} /> : <Monitor size={16} />}
                   {isOnline && (
                     <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#71DD8C] rounded-full border-2 border-white animate-pulse" />
                   )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className={`text-xs font-bold truncate tracking-tight transition-colors ${isOnline ? 'text-[#1C1C1C] group-hover:text-blue-600' : 'text-[rgba(28,28,28,0.4)]'}`}>
                    {device.device_name || 'Unnamed Device'}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium font-mono uppercase tracking-wider">{device.access_key}</span>
                  </div>
                </div>
                {isOnline && (
                  <div className="flex items-center text-[rgba(28,28,28,0.1)] group-hover:text-blue-400 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <ChevronRight size={14} />
                  </div>
                )}
              </div>
            );
          })}
          
          {devices.length === 0 && (
            <div className="py-10 flex flex-col items-center justify-center gap-2 bg-[rgba(28,28,28,0.02)] rounded-2xl border border-dashed border-[rgba(28,28,28,0.1)]">
               <Activity size={24} className="text-[rgba(28,28,28,0.1)]" />
               <span className="text-[10px] text-[rgba(28,28,28,0.3)] font-bold uppercase tracking-widest">No Active Devices</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Visual Branding */}
      <div className="mt-auto pt-6 border-t border-[rgba(28,28,28,0.05)]">
         <div className="p-4 bg-[rgba(28,28,28,0.04)] rounded-[20px] border border-[rgba(28,28,28,0.04)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full translate-x-12 -translate-y-12" />
            <p className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] leading-relaxed relative z-10 uppercase tracking-tight">
              Remote365 utilizes E2E encryption for all remote sessions. Your session is currently protected.
            </p>
         </div>
      </div>

    </aside>
  );
};
