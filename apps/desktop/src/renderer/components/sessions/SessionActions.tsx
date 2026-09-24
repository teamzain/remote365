import React, { useState } from 'react';
import { Clipboard, FileUp, LockKeyhole, Power, UserPlus, ListChecks, Square } from 'lucide-react';
import { SupportSession } from '../../lib/sessionsApi';
import { ScriptsLibrary } from './ScriptsLibrary';

type Props = {
  session: SupportSession | null;
  onAppendNote: (text: string) => void;
};

export const SessionActions: React.FC<Props> = ({ session, onAppendNote }) => {
  const [recording, setRecording] = useState(false);
  const disabled = !session || session.status === 'ENDED' || session.status === 'EXPIRED';
  const actions = [
    { label: 'Send File', icon: FileUp },
    { label: 'Paste Clipboard', icon: Clipboard },
    { label: 'Lock Screen', icon: LockKeyhole },
    { label: 'Reboot', icon: Power },
    { label: 'Task Manager', icon: ListChecks },
    { label: 'Win+L', icon: LockKeyhole },
    { label: 'Ctrl+Alt+Del', icon: ListChecks },
    { label: 'Invite Tech', icon: UserPlus },
  ];

  const runAction = (label: string) => {
    if (disabled) return;
    onAppendNote(`Quick action requested: ${label}`);
  };

  return (
    <aside className="h-full rounded-2xl border border-gray-100 dark:border-white/5 bg-white dark:bg-[#0F0F0F] overflow-hidden flex flex-col">
      <div className="px-4 py-4 border-b border-gray-100 dark:border-white/5">
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Actions</h2>
        <p className="text-[11px] text-gray-400">Technician Tools</p>
      </div>

      {recording && (
        <div className="mx-3 mt-3 rounded-xl bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[11px] font-bold uppercase text-red-600 dark:text-red-300 flex items-center gap-2">
          <Square size={9} fill="currentColor" />
          Recording Visible To Customer
        </div>
      )}

      <div className="p-3 grid grid-cols-2 gap-2">
        {actions.map(({ label, icon: Icon }) => (
          <button
            key={label}
            disabled={disabled}
            onClick={() => runAction(label)}
            className="min-h-[74px] rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.03] hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-45 disabled:hover:bg-gray-50 p-3 text-left transition-colors"
          >
            <Icon size={17} className="text-[#1D6DF5]" />
            <div className="mt-2 text-[11px] font-bold text-gray-800 dark:text-gray-100 leading-tight">{label}</div>
          </button>
        ))}
      </div>

      <ScriptsLibrary
        disabled={disabled}
        onRunScript={(name, command) => onAppendNote(`Script run requested: ${name}\n${command}`)}
      />

      <div className="mt-auto p-3 border-t border-gray-100 dark:border-white/5">
        <button
          disabled={!session}
          onClick={() => setRecording((value) => !value)}
          className={`w-full rounded-xl px-3 py-3 text-[12px] font-bold transition-colors disabled:opacity-45 ${
            recording
              ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
              : 'bg-gray-900 text-white dark:bg-white dark:text-black'
          }`}
        >
          {recording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
    </aside>
  );
};
