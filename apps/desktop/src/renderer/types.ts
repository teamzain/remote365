// Shared types used across App.tsx and renderer components.

export type FileTransferStatus = {
  direction: 'send' | 'receive';
  name?: string;
  progress: number;
  state: 'idle' | 'waiting' | 'transferring' | 'complete' | 'error';
  message?: string;
  path?: string;
};
