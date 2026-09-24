import React from 'react';
import { Terminal } from 'lucide-react';

const scripts = [
  { name: 'Clear Print Spooler', command: 'Stop-Service Spooler; Remove-Item C:\\Windows\\System32\\spool\\PRINTERS\\*; Start-Service Spooler' },
  { name: 'Restart Windows Update', command: 'Restart-Service wuauserv,bits' },
  { name: 'Collect Diagnostic Logs', command: 'Get-EventLog -LogName System -Newest 100' },
];

type Props = {
  disabled?: boolean;
  onRunScript?: (name: string, command: string) => void;
};

export const ScriptsLibrary: React.FC<Props> = ({ disabled, onRunScript }) => (
  <div className="border-t border-gray-100 dark:border-white/5">
    <div className="px-4 pt-4 pb-2 flex items-center justify-between">
      <h3 className="text-[13px] font-bold text-gray-900 dark:text-white">Scripts</h3>
      <Terminal size={15} className="text-gray-400" />
    </div>
    <div className="px-3 pb-3 space-y-2">
      {scripts.map((script) => (
        <div key={script.name} className="rounded-xl border border-gray-100 dark:border-white/5 p-3">
          <div className="text-[12px] font-bold text-gray-800 dark:text-gray-100">{script.name}</div>
          <div className="mt-1 text-[10px] font-mono text-gray-400 truncate">{script.command}</div>
          <button
            disabled={disabled}
            onClick={() => onRunScript?.(script.name, script.command)}
            className="mt-3 w-full rounded-lg bg-gray-900 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-45 dark:bg-white dark:text-black"
          >
            Run
          </button>
        </div>
      ))}
    </div>
  </div>
);
