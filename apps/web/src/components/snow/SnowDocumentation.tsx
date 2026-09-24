import React from 'react';
import {
  Zap,
  Shield,
  Globe,
  Terminal,
  ChevronRight,
  ExternalLink,
  LifeBuoy,
  Search,
  MessageSquare,
  Key
} from 'lucide-react';

export const SnowDocumentation: React.FC = () => {
  const categories = [
    {
      title: 'Getting Started',
      icon: Zap,
      desc: 'Learn the fundamentals of Remote365 node architecture and initial setup.',
      items: ['System Requirements', 'Initial Node Setup', 'Authentication Flows'],
      color: 'text-blue-500',
      bg: 'bg-blue-50/50'
    },
    {
      title: 'P2P Connectivity',
      icon: Globe,
      desc: 'Master signaling, relay optimization, and NAT traversal techniques.',
      items: ['Signaling Servers', 'ICE/STUN/TURN Guides', 'Relay Optimization'],
      color: 'text-emerald-500',
      bg: 'bg-emerald-50/50'
    },
    {
      title: 'Security & Auth',
      icon: Shield,
      desc: 'Implement end-to-end encryption and secure access key management.',
      items: ['Access Keys', 'E2EE Setup', 'Hardware Partitioning'],
      color: 'text-purple-500',
      bg: 'bg-purple-50/50'
    }
  ];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700 font-inter pb-20">
      
      {/* Documentation Hero */}
      <div className="bg-[#1C1C1C] rounded-[40px] p-12 text-white relative overflow-hidden shadow-xl shadow-black/10 border border-[rgba(28,28,28,0.04)]">
         <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] -mr-32 -mt-32 rounded-full" />
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 blur-[80px] -ml-16 -mb-16 rounded-full" />
         
         <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="px-2 py-0.5 bg-white/10 rounded-full border border-white/10">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Knowledge Base</span>
              </div>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-4">Remote365 Technical Docs</h1>
            <p className="text-white/40 text-lg font-medium mb-8 leading-relaxed">
               Comprehensive guides and API references to help you build high-performance, secure P2P node networks.
            </p>
            
            <div className="flex items-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 pl-5 pr-2 py-2 w-full focus-within:ring-2 focus-within:ring-white/20 transition-all max-w-md">
               <Search size={18} className="text-white/40 mr-3" />
               <input placeholder="Search technical guides..." className="bg-transparent border-none outline-none text-sm text-white placeholder:text-white/20 w-full" />
               <button className="px-5 py-2 bg-white text-[#1C1C1C] rounded-xl text-xs font-bold hover:opacity-90 transition-all">Search</button>
            </div>
         </div>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {categories.map((cat, i) => (
           <div key={i} className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm hover:border-[rgba(28,28,28,0.2)] transition-all cursor-pointer group border border-[rgba(28,28,28,0.04)]">
              <div className={`w-12 h-12 rounded-2xl ${cat.bg} ${cat.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <cat.icon size={24} />
              </div>
              <h3 className="text-base font-bold text-[#1C1C1C] mb-2">{cat.title}</h3>
              <p className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] leading-relaxed mb-6">
                 {cat.desc}
              </p>
              
              <div className="space-y-3">
                 {cat.items.map((item, j) => (
                   <div key={j} className="flex items-center justify-between py-2 border-b border-[rgba(28,28,28,0.02)] last:border-0 hover:translate-x-1 transition-transform">
                      <span className="text-xs font-semibold text-[rgba(28,28,28,0.6)] group-hover:text-[#1C1C1C]">{item}</span>
                      <ChevronRight size={14} className="text-[rgba(28,28,28,0.1)] group-hover:text-[rgba(28,28,28,0.3)]" />
                   </div>
                 ))}
              </div>
           </div>
         ))}
      </div>

      {/* Detailed Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm border border-[rgba(28,28,28,0.04)]">
            <h3 className="text-lg font-bold text-[#1C1C1C] tracking-tight mb-8 flex items-center gap-3">
               <Terminal size={18} className="text-blue-500" /> API & CLI Reference
            </h3>
            <div className="space-y-4">
               {[
                 { title: 'Command Line Interface', sub: 'Control nodes via terminal', icon: Terminal },
                 { title: 'Auth Token Management', sub: 'Manage session lifecycle', icon: Key },
                 { title: 'Broadcasting Params', sub: 'Fine-tune streaming performance', icon: Zap }
               ].map((item, k) => (
                 <div key={k} className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[24px] border border-[rgba(28,28,28,0.02)] hover:border-[rgba(28,28,28,0.1)] transition-all cursor-pointer group border border-[rgba(28,28,28,0.04)]">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[rgba(28,28,28,0.3)] group-hover:text-black shadow-sm border border-[rgba(28,28,28,0.04)]">
                          <item.icon size={18} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-[#1C1C1C]">{item.title}</span>
                          <span className="text-[10px] text-[rgba(28,28,28,0.4)]">{item.sub}</span>
                       </div>
                    </div>
                    <ExternalLink size={14} className="text-[rgba(28,28,28,0.1)] group-hover:text-[rgba(28,28,28,0.3)] transition-colors" />
                 </div>
               ))}
            </div>
         </div>

         <div className="bg-[#F9F9FA] rounded-[32px] border border-[rgba(28,28,28,0.04)] p-8 flex flex-col items-center justify-center text-center border border-[rgba(28,28,28,0.04)]">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl shadow-black/5 mb-8">
               <MessageSquare size={32} className="text-[#1C1C1C]" />
            </div>
            <h3 className="text-xl font-bold text-[#1C1C1C] mb-2 tracking-tight">Need a custom guide?</h3>
            <p className="text-xs font-medium text-[rgba(28,28,28,0.4)] mb-8 leading-relaxed max-w-xs">
               If you can't find what you need, our solutions engineers can build a custom deployment guide for your enterprise.
            </p>
            <button className="px-8 py-3.5 bg-[#1C1C1C] text-white rounded-2xl font-bold text-xs shadow-lg shadow-black/10 hover:opacity-95 transition-all">Request Guide</button>
         </div>
      </div>

      {/* Footer Support Hub Link */}
      <div className="bg-white rounded-[40px] border border-[rgba(28,28,28,0.06)] p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm border border-[rgba(28,28,28,0.04)]">
         <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-50/50 text-blue-500 rounded-3xl flex items-center justify-center shadow-inner">
               <LifeBuoy size={32} />
            </div>
            <div className="flex flex-col">
               <h2 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">Documentation alone not enough?</h2>
               <p className="text-[rgba(28,28,28,0.4)] font-medium">Jump over to our Support Hub to chat with an expert directly.</p>
            </div>
         </div>
         <button className="px-8 py-3.5 bg-[#F9F9FA] text-[#1C1C1C] rounded-xl font-bold text-sm border border-[rgba(28,28,28,0.04)] hover:border-[rgba(28,28,28,0.2)] transition-all">
            Go to Support
         </button>
      </div>

    </div>
  );
};
