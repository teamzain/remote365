import React, { useEffect, useState } from 'react';
import { Check, Download, FolderOpen, Loader2, Upload, X, AlertCircle } from 'lucide-react';
import { formatBytes, setTransferPlan, subscribeTransferJobs, type TransferJob } from '../../lib/fileTransferEngine';
import { useLicenseStore } from '../../store/licenseStore';

/**
 * Progress for "Send files" / "Get files", as small cards in the corner of
 * the session — the whole file-transfer UI now that the two-pane manager is
 * gone. Newest first, at most four on screen; finished ones can be closed.
 */

type Props = {
  deviceName: string;
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
};

const MAX_VISIBLE = 4;

const isRunning = (job: TransferJob) => job.state === 'active' || job.state === 'preparing' || job.state === 'paused';

const percent = (job: TransferJob) =>
  job.totalBytes > 0 ? Math.max(0, Math.min(100, Math.round((job.transferredBytes / job.totalBytes) * 100))) : 0;

function statusLine(job: TransferJob, deviceName: string): string {
  if (job.hostPick) return job.state === 'error' ? job.message : job.message || `Choose the files on ${deviceName}'s screen.`;
  const where = job.destDir ? job.destDir : 'Downloads\\Remote365';
  switch (job.state) {
    case 'done': {
      const count = job.fileCount > 1 ? `${job.fileCount} files` : 'Saved';
      const place = job.direction === 'send' ? `on ${deviceName} in ${where}` : `to ${where}`;
      const renamed = job.renamedCount ? ` · ${job.renamedCount} renamed so nothing was overwritten` : '';
      return `${count} ${job.fileCount > 1 ? 'saved ' : ''}${place}${renamed}`;
    }
    case 'error':
      return job.message || 'The transfer failed.';
    case 'cancelled':
      return 'Cancelled';
    case 'paused':
      return job.message || 'Connection lost. It continues when the session is back.';
    case 'preparing':
      return job.message || 'Starting…';
    default: {
      const pct = percent(job);
      const speed = job.bytesPerSecond > 0 ? ` · ${formatBytes(job.bytesPerSecond)}/s` : '';
      const files = job.fileCount > 1 ? ` · ${job.filesDone}/${job.fileCount} files` : '';
      return job.message || `${pct}%${files}${speed}`;
    }
  }
}

export default function FileTransferToasts({ deviceName, onCancel, onDismiss }: Props) {
  const [jobs, setJobs] = useState<TransferJob[]>([]);
  useEffect(() => subscribeTransferJobs(setJobs), []);
  // Per-file limits follow the workspace plan. The old file manager panel
  // set this on mount; with the panel gone this (always mounted in a
  // session) is the place, or every send would be capped at the Trial size.
  const licensePlan = useLicenseStore((s) => s.plan);
  useEffect(() => { setTransferPlan(licensePlan); }, [licensePlan]);

  const visible = jobs.slice(0, MAX_VISIBLE);
  if (!visible.length) return null;

  return (
    <div className="pointer-events-none absolute bottom-24 right-4 z-[150] flex w-[300px] flex-col gap-2 sm:right-6">
      {visible.map((job) => {
        const running = isRunning(job);
        const failed = job.state === 'error';
        const done = job.state === 'done';
        const Icon = done ? Check : failed ? AlertCircle : job.hostPick ? Loader2 : job.direction === 'send' ? Upload : Download;
        const iconColor = done ? 'text-[#1E8E3E]' : failed ? 'text-[#FF383C]' : 'text-[#FF8A00]';
        return (
          <div
            key={job.id}
            className="pointer-events-auto rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[#111315] shadow-lg"
            role="status"
          >
            <div className="flex items-center gap-2">
              <Icon size={16} className={`flex-none ${iconColor} ${job.hostPick && running ? 'animate-spin' : ''}`} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{job.label}</span>
              {done && job.direction === 'receive' && job.destDir && (
                <button
                  type="button"
                  title="Show in folder"
                  aria-label="Show in folder"
                  onClick={() => { void (window as any).electronAPI?.files?.reveal?.(job.destDir); }}
                  className="flex h-6 w-6 items-center justify-center rounded text-[#111315]/60 hover:bg-black/5 hover:text-[#111315]"
                >
                  <FolderOpen size={14} />
                </button>
              )}
              <button
                type="button"
                title={running ? 'Cancel' : 'Close'}
                aria-label={running ? 'Cancel transfer' : 'Close'}
                onClick={() => (running ? onCancel(job.id) : onDismiss(job.id))}
                className="flex h-6 w-6 items-center justify-center rounded text-[#111315]/60 hover:bg-black/5 hover:text-[#111315]"
              >
                <X size={14} />
              </button>
            </div>
            <p className={`m-0 mt-1 line-clamp-2 text-[11px] leading-4 ${failed ? 'text-[#FF383C]' : 'text-[#111315]/60'}`}>
              {statusLine(job, deviceName)}
            </p>
            {running && !job.hostPick && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full bg-[#FF8A00] transition-[width] duration-300" style={{ width: `${percent(job)}%` }} />
              </div>
            )}
            {done && job.skipped && job.skipped.length > 0 && (
              <p className="m-0 mt-1 text-[11px] leading-4 text-[#B45309]">
                {job.skipped.length} skipped: {job.skipped.slice(0, 2).map((s) => s.name).join(', ')}
                {job.skipped.length > 2 ? '…' : ''}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
