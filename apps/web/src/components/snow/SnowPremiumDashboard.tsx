import React from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { t } from '../../lib/translations';
import type { RecentConnection } from '../../lib/recentConnections';

interface SnowPremiumDashboardProps {
  user: any;
  localAuthKey: string | null;
  devicePassword: string;
  onNavigate: (view: any) => void;
  onConnect: (partnerId?: string) => void;
  onOpenSetPassword: () => void;
  formatCode: (code: string) => string;
  onCopyAccessKey?: () => void;
  onCreateSession?: () => void;
  onJoinSession?: () => void;
  onEnableRemoteAccess?: () => void;
  hasContacts?: boolean;
  hasRemoteAccess?: boolean;
  recentConnections?: RecentConnection[];
  onRecentConnect?: (accessKey: string) => void;
  onCopyPassword?: () => void;
}

export const SnowPremiumDashboard: React.FC<SnowPremiumDashboardProps> = ({
  user,
  localAuthKey,
  devicePassword,
  onNavigate,
  onConnect,
  onOpenSetPassword,
  formatCode,
  onCopyAccessKey,
  hasContacts = false,
  recentConnections = [],
  onRecentConnect,
  onCopyPassword,
}) => {
  const [showPwd, setShowPwd] = React.useState(false);
  const [partnerId, setPartnerId] = React.useState('');
  const [now, setNow] = React.useState(() => new Date());
  const [copiedField, setCopiedField] = React.useState<'id' | 'password' | null>(null);

  const lang = user?.language;
  const cleanPartnerId = partnerId.replace(/\D/g, '');
  const formattedPartnerId = formatCode(partnerId);
  const formattedLocalId = formatCode(localAuthKey || '') || '--- --- ---';
  const displayName = user?.name || user?.displayName || user?.email?.split('@')?.[0] || 'there';

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!copiedField) return;
    const timer = window.setTimeout(() => setCopiedField(null), 1500);
    return () => window.clearTimeout(timer);
  }, [copiedField]);

  const greeting = React.useMemo(() => {
    const hour = now.getHours();
    if (hour >= 5 && hour < 12) return `Good morning, ${displayName}`;
    if (hour >= 12 && hour < 17) return `Good afternoon, ${displayName}`;
    if (hour >= 17 && hour < 21) return `Good evening, ${displayName}`;
    return `Good night, ${displayName}`;
  }, [displayName, now]);

  const copyText = async (value: string, field: 'id' | 'password') => {
    if (!value) return;
    const electronApi = (window as any).electronAPI;
    if (electronApi?.clipboard?.writeText) await electronApi.clipboard.writeText(value);
    else await navigator.clipboard.writeText(value);
    if (field === 'id') onCopyAccessKey?.();
    if (field === 'password') onCopyPassword?.();
    setCopiedField(field);
  };

  const onboardingTasks = [
    {
      id: 'photo',
      label: t('upload_photo', lang),
      completed: Boolean(user?.avatar),
      action: () => onNavigate('profile'),
    },
    {
      id: 'contact',
      label: t('add_contact', lang),
      completed: hasContacts,
      action: () => onNavigate('chat'),
    }
  ];

  const visibleTasks = onboardingTasks;

  const handlePartnerIdChange = (value: string) => {
    setPartnerId(value.replace(/\D/g, '').slice(0, 9));
  };

  const handleConnect = () => {
    if (cleanPartnerId.length < 6) return;
    onConnect(cleanPartnerId);
  };

  const recentInitials = (entry: RecentConnection) => {
    const name = entry.name || formatCode(entry.accessKey);
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'R';
  };

  return (
    <div className="min-h-full w-full bg-white px-5 pb-8 pt-[30px] font-['Mona_Sans',system-ui,sans-serif] text-[#111315] sm:px-8 xl:px-[55px]">
      <div className="mb-7 flex max-w-[900px] flex-col gap-1">
        <h1 className="m-0 text-[24px] font-bold leading-[34px] text-black">{greeting}</h1>
        <p className="m-0 text-[14px] font-normal leading-5 text-black">
          {t('home_support_line', lang)}
        </p>
      </div>

      <div className="flex w-full flex-col gap-[14px]">
        <div className="grid grid-cols-1 gap-[14px] xl:grid-cols-2">
          <section className="min-h-[270px] rounded-xl border border-[rgba(26,29,33,0.3)] bg-white px-4 py-8">
            <div className="flex h-full flex-col justify-between gap-7">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <h2 className="m-0 text-[18px] font-medium leading-[25px] text-black">{t('connect_remote_device', lang)}</h2>
                  <p className="m-0 text-[14px] font-normal leading-5 text-[#1A1D21]">{t('guest_connection', lang)}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="m-0 text-[14px] font-normal leading-5 text-[#1A1D21]">
                    {t('enter_shared_code', lang)}
                  </p>
                  <div className="flex h-10 gap-2">
                    <input
                      type="text"
                      placeholder={t('partner_id', lang)}
                      value={formattedPartnerId}
                      onChange={(event) => handlePartnerIdChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleConnect();
                        }
                      }}
                      className="h-10 min-w-0 flex-1 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-normal leading-5 text-[#111315] outline-none placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00]"
                    />
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={cleanPartnerId.length < 6}
                      className="h-10 w-[136px] rounded border border-[#F3F4F6] bg-[#F3F4F6] text-[14px] font-medium leading-5 text-[rgba(26,29,33,0.3)] transition-colors enabled:bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] enabled:text-white"
                    >
                      {t('connect', lang)}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-6">
                <div className="flex min-w-0 flex-col gap-0.5">
                  {visibleTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={task.completed ? undefined : task.action}
                      disabled={task.completed}
                      className="flex h-5 min-w-0 items-center gap-3 text-left disabled:cursor-default"
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${task.completed ? 'border-[#34C759] bg-[#34C759]' : 'border-[#FF8A00] bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)]'}`}>
                        {task.completed ? <Check size={12} className="text-white" /> : null}
                      </span>
                      <span className={`truncate text-[14px] font-normal leading-5 text-[#111315] ${task.completed ? 'text-[rgba(17,19,21,0.45)] line-through' : ''}`}>{task.label}</span>
                    </button>
                  ))}
                </div>
                <div className="hidden min-w-[190px] max-w-[260px] flex-col gap-2 md:flex">
                  <span className="text-[14px] font-normal leading-5 text-[#1A1D21]">{t('recently_connected', lang)}</span>
                  <div className="flex flex-col gap-1">
                    {recentConnections.length === 0 ? (
                      <span className="text-[12px] leading-4 text-[rgba(26,29,33,0.45)]">No recent connections</span>
                    ) : recentConnections.slice(0, 3).map((entry) => (
                      <button
                        key={entry.accessKey}
                        type="button"
                        onClick={() => onRecentConnect?.(entry.accessKey)}
                        className="flex h-7 min-w-0 items-center gap-2 rounded px-1 text-left hover:bg-[#F3F4F6]"
                      >
                        {entry.avatar ? (
                          <img src={entry.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-white bg-[#F9F5FF] text-[9px] font-semibold text-[#7F56D9]">
                            {recentInitials(entry)}
                          </span>
                        )}
                        <span className="min-w-0 truncate text-[13px] leading-5 text-[#111315]">{entry.name || formatCode(entry.accessKey)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="min-h-[270px] rounded-xl border border-[rgba(26,29,33,0.3)] bg-white px-4 py-8">
            <div className="flex h-full flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-[18px] font-medium leading-[25px] text-black">{t('connect_with_id', lang)}</h2>
                <p className="m-0 text-[14px] font-normal leading-5 text-[#1A1D21]">{t('id_desc', lang)}</p>
              </div>

              <div className="flex flex-1 flex-col justify-center rounded bg-[#F3F4F6]">
                <div className="flex min-h-[70px] items-center gap-6 rounded px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.7)]">{t('your_id', lang)}</p>
                    <p className="m-0 truncate text-[24px] font-bold leading-[34px] text-[#111315]">{formattedLocalId}</p>
                  </div>
                  <button type="button" onClick={() => copyText(formattedLocalId, 'id')} className="relative flex h-8 w-8 items-center justify-center text-[#111315]">
                    {copiedField === 'id' ? <Check size={16} className="text-[#34C759]" /> : <Copy size={16} />}
                    {copiedField === 'id' ? <span className="absolute -top-6 rounded bg-[#111315] px-2 py-0.5 text-[10px] text-white">Copied</span> : null}
                  </button>
                </div>
                <div className="flex min-h-[70px] items-center gap-6 rounded px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.7)]">{t('password', lang)}</p>
                    <p className="m-0 truncate text-[24px] font-bold leading-[34px] text-[#111315]">{showPwd ? (devicePassword || '--------') : '********'}</p>
                  </div>
                  <div className="flex items-center gap-6 text-[#111315]">
                    <button type="button" onClick={onOpenSetPassword} className="flex h-8 w-4 items-center justify-center">
                      <RefreshCw size={16} />
                    </button>
                    <button type="button" onClick={() => copyText(devicePassword, 'password')} disabled={!devicePassword} className="relative flex h-8 w-4 items-center justify-center disabled:opacity-40">
                      {copiedField === 'password' ? <Check size={16} className="text-[#34C759]" /> : <Copy size={16} />}
                      {copiedField === 'password' ? <span className="absolute -top-6 rounded bg-[#111315] px-2 py-0.5 text-[10px] text-white">Copied</span> : null}
                    </button>
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="flex h-8 w-4 items-center justify-center">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="flex min-h-[128px] items-center justify-between gap-8 rounded-xl bg-[#F3F4F6] p-5">
          <div className="flex max-w-[436px] flex-col gap-2">
            <h2 className="m-0 text-[24px] font-bold leading-[34px] text-black">{t('business_plan_banner', lang)}</h2>
            <p className="m-0 text-[14px] font-normal leading-5 text-black">
              {t('business_plan_desc', lang)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('billing')}
            className="h-10 w-[144px] shrink-0 rounded bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] px-4 text-[14px] font-medium leading-5 text-white"
          >
            {t('upgrade_plan_cta', lang)}
          </button>
        </section>
      </div>
    </div>
  );
};
