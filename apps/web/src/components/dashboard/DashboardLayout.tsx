import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Bell, 
  Search as SearchIcon, 
  ShieldCheck, 
  User, 
  Activity,
  X,
  ChevronLeft
} from 'lucide-react';
import { SnowSidebar } from '../snow/SnowSidebar';
import { SnowRightBar } from '../snow/SnowRightBar';
import { useDeviceStore } from '../../store/deviceStore';
import { openSessionTab } from '../../lib/sessionLauncher';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 1440);
  const [isRightBarOpen, setIsRightBarOpen] = useState(window.innerWidth > 1440);
  const { devices, fetchDevices } = useDeviceStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([
    { action: 'Security scan completed.', time: 'Just now', icon: ShieldCheck, color: 'bg-blue-50' },
    { action: 'Client initialized.', time: 'Just now', icon: Activity, color: 'bg-indigo-50' },
  ]);

  const addNotification = (action: string, iconType: 'host' | 'security' | 'session' | 'system' = 'system') => {
    const iconMap = {
      host: Activity,
      security: ShieldCheck,
      session: User,
      system: Activity
    };
    const colorMap = {
      host: 'bg-indigo-50',
      security: 'bg-blue-50',
      session: 'bg-slate-50',
      system: 'bg-emerald-50'
    };
    
    const newNotif = {
      action,
      time: 'Just now',
      icon: iconMap[iconType],
      color: colorMap[iconType]
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 9)]);
  };

  // Keep track of previous devices to detect changes
  const [prevDevices, setPrevDevices] = useState<any[]>([]);

  useEffect(() => {
    fetchDevices(true);
    const interval = setInterval(() => fetchDevices(true), 10000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  useEffect(() => {
    if (devices.length > 0 && prevDevices.length > 0) {
      devices.forEach(device => {
        const prevDevice = prevDevices.find(d => d.id === device.id);
        if (prevDevice && prevDevice.is_online !== device.is_online) {
          addNotification(`${device.device_name} is now ${device.is_online ? 'online' : 'offline'}`, 'host');
        }
      });
    }
    setPrevDevices(devices);
  }, [devices]);

  // Handle window resize for default bar states
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      
      // Sidebar logic
      if (width < 1024) {
        setIsSidebarOpen(false);
      } else if (width < 1440) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }

      // Right bar logic
      if (width < 1280) {
        setIsRightBarOpen(false);
      } else {
        setIsRightBarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close overlays on route change
  useEffect(() => {
    setIsSidebarOpen(false);
    if (window.innerWidth < 1280) {
      setIsRightBarOpen(false);
    }
  }, [location.pathname]);

  const handleDeviceClick = (device: any) => {
    if (device.is_online) {
      openSessionTab(device.access_key);
    }
  };


  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden font-inter text-[#1C1C1C]">
      
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[45] lg:hidden pointer-events-auto"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* RightBar Overlay (Mobile/Tablet) */}
      {isRightBarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[45] xl:hidden pointer-events-auto"
          onClick={() => setIsRightBarOpen(false)}
        />
      )}

      {/* Sidebar - Web Responsive */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-all duration-300 ease-in-out bg-white
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarOpen ? 'w-[212px]' : isSidebarCollapsed ? 'w-[72px]' : 'w-[212px]'} shadow-2xl lg:shadow-none pointer-events-auto`}
      >
        {isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-4 -right-12 w-10 h-10 bg-white border border-[rgba(28,28,28,0.06)] rounded-xl shadow-xl flex items-center justify-center text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] z-[60] lg:hidden transition-all"
            style={{ pointerEvents: 'auto' }}
          >
            <X size={20} />
          </button>
        )}
        <SnowSidebar isCollapsed={!isSidebarOpen && isSidebarCollapsed} />
        
        {/* Toggle Button for Desktop */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`hidden lg:flex absolute top-1/2 -right-3 w-6 h-6 bg-white border border-[rgba(28,28,28,0.08)] rounded-full items-center justify-center shadow-sm z-50 transform -translate-y-1/2 transition-transform hover:scale-110 active:scale-95 text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] ${isSidebarCollapsed ? 'rotate-180' : ''}`}
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden transition-all duration-300">
        
        {/* Header / Top Bar */}
        <header className="h-16 border-b border-[rgba(28,28,28,0.04)] bg-white/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setIsSidebarOpen(true); setIsRightBarOpen(false); }}
              className="p-2 hover:bg-[rgba(28,28,28,0.05)] rounded-xl lg:hidden transition-colors pointer-events-auto"
            >
              <Menu size={20} />
            </button>
            
            <div className="flex flex-col lg:flex-row lg:items-center gap-0 lg:gap-2">
               <span className="text-[9px] font-black text-[rgba(28,28,28,0.2)] tracking-[0.2em] uppercase hidden sm:block">Control Center</span>
               <div className="w-1 h-1 rounded-full bg-[rgba(28,28,28,0.1)] hidden lg:block" />
               <h1 className="text-sm font-bold tracking-tight truncate max-w-[150px] sm:max-w-none">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <div className="hidden md:flex items-center bg-[#F8F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl px-3 py-1.5 focus-within:border-[rgba(28,28,28,0.2)] transition-all">
               <SearchIcon size={14} className="text-[rgba(28,28,28,0.3)] mr-2" />
               <input placeholder="Search Nodes..." className="bg-transparent border-none outline-none text-xs w-24 lg:w-32 placeholder:text-[rgba(28,28,28,0.2)] font-medium" />
               <span className="text-[9px] font-black text-[rgba(28,28,28,0.2)] ml-2 hidden lg:block">⌘K</span>
            </div>

            <button className="p-2 hover:bg-[rgba(28,28,28,0.05)] rounded-xl transition-colors relative">
              <Bell size={18} />
              <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full border-2 border-white" />
            </button>

            <button 
              onClick={() => { setIsRightBarOpen(!isRightBarOpen); setIsSidebarOpen(false); }}
              className={`p-2 rounded-xl transition-all ${isRightBarOpen ? 'bg-[rgba(28,28,28,0.04)] text-[#1C1C1C]' : 'hover:bg-[rgba(28,28,28,0.05)] text-[rgba(28,28,28,0.4)]'}`}
            >
              <Activity size={18} />
            </button>
          </div>
        </header>

        {/* Dynamic Content Wrapper */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8 flex justify-center">
           <div className="w-full max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-700">
              {children}
           </div>
        </div>
      </main>

      {/* Right Sidebar */}
      <div className={`
        fixed inset-y-0 right-0 z-50 transform xl:relative xl:translate-x-0 transition-transform duration-300 ease-in-out bg-white
        ${isRightBarOpen ? 'translate-x-0' : 'translate-x-full'}
        ${isRightBarOpen ? 'w-[280px] shadow-2xl xl:shadow-none' : 'w-0'}
      `}>
        {isRightBarOpen && (
          <div className="h-full relative overflow-hidden">
            <button 
              onClick={() => setIsRightBarOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-[rgba(28,28,28,0.05)] rounded-xl transition-colors z-10 xl:hidden"
            >
              <X size={20} />
            </button>
            <SnowRightBar 
              devices={devices} 
              notifications={notifications} 
              onDeviceClick={handleDeviceClick} 
            />
          </div>
        )}
      </div>

    </div>
  );
};

export default DashboardLayout;
