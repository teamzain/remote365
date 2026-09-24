import React from 'react';
import { Search } from 'lucide-react';

export type AccessType = 'none' | 'full' | 'groups' | 'specific';

export interface DeviceGroup {
  id: string;
  name: string;
  color?: string | null;
}

export interface OrgDevice {
  id: string;
  device_name: string;
  access_key: string;
  device_type?: string;
  is_online?: boolean;
}

export const accessOptions: Array<{ value: AccessType; label: string; help: string }> = [
  { value: 'none', label: 'None', help: 'This user will not see devices.' },
  { value: 'full', label: 'All Devices', help: 'This user can see every device in the organization.' },
  { value: 'groups', label: 'Specific Groups', help: 'This user can see devices inside selected groups.' },
  { value: 'specific', label: 'Specific Devices', help: 'This user can see only selected devices.' }
];

interface AccessPickerProps {
  accessType: AccessType;
  setAccessType: (value: AccessType) => void;
  groups: DeviceGroup[];
  groupIds: string[];
  onGroupToggle: (id: string) => void;
  deviceIds: string[];
  onDeviceToggle: (id: string) => void;
  search: string;
  setSearch: (value: string) => void;
  devices: OrgDevice[];
}

/**
 * Device-access chooser shared by the member invite/edit modal and the per-user
 * permissions page. Mirrors the four access modes (none / all / groups /
 * specific) the backend understands in resolveAccess().
 */
export const AccessPicker: React.FC<AccessPickerProps> = ({
  accessType,
  setAccessType,
  groups,
  groupIds,
  onGroupToggle,
  deviceIds,
  onDeviceToggle,
  search,
  setSearch,
  devices
}) => (
  <div>
    <label className="block text-[10px] font-bold text-[rgba(17,19,21,0.3)] uppercase tracking-widest mb-2 px-1">Access Type</label>
    <div className="grid grid-cols-2 gap-3 mb-3">
      {accessOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setAccessType(option.value)}
          style={accessType === option.value ? { background: '#FFB347' } : undefined}
          className={`h-10 px-4 rounded border text-[14px] font-medium transition-all ${accessType === option.value ? 'border-transparent text-white' : 'bg-white text-[rgba(17,19,21,0.6)] border-[rgba(26,29,33,0.3)] hover:border-[#FF8A00]'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
    <p className={`text-[13px] font-medium px-1 mb-3 ${accessType === 'none' ? 'text-[#D92D20]' : accessType === 'full' ? 'text-[#34C759]' : 'text-[#2563EB]'}`}>
      {accessOptions.find((option) => option.value === accessType)?.help}
    </p>

    {accessType === 'groups' && (
      <div className="flex flex-wrap gap-2 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-3">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => onGroupToggle(group.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[14px] font-medium border transition-all ${groupIds.includes(group.id) ? 'bg-white border-[rgba(26,29,33,0.3)] text-[#111315]' : 'bg-transparent border-transparent text-[rgba(17,19,21,0.55)] hover:bg-[#F3F4F6]'}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color || '#94a3b8' }} />
            {group.name}
          </button>
        ))}
        {groups.length === 0 && <span className="text-[12px] text-[rgba(17,19,21,0.35)]">No groups yet. Create one in Device groups.</span>}
      </div>
    )}

    {accessType === 'specific' && (
      <>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(17,19,21,0.3)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Devices..."
            className="w-full pl-9 pr-4 h-10 bg-white border border-[rgba(26,29,33,0.3)] rounded text-[14px] focus:border-[#FF8A00] outline-none transition-all"
          />
        </div>
        <div className="max-h-44 overflow-y-auto rounded-xl border border-[rgba(26,29,33,0.15)] bg-white divide-y divide-[rgba(26,29,33,0.08)]">
          {devices.map((device) => (
            <label key={device.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#FBFBFC] transition-colors">
              <input type="checkbox" checked={deviceIds.includes(device.id)} onChange={() => onDeviceToggle(device.id)} className="w-4 h-4 accent-[#FF8A00] rounded" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#111315] truncate">{device.device_name || 'Unnamed Device'}</div>
                <div className="text-[11px] text-[rgba(17,19,21,0.4)]">{device.access_key}</div>
              </div>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${device.is_online ? 'bg-[#34C759]' : 'bg-slate-300'}`} />
            </label>
          ))}
          {devices.length === 0 && <div className="py-6 text-center text-[11px] text-[rgba(17,19,21,0.3)]">No Devices Found</div>}
        </div>
      </>
    )}
  </div>
);
