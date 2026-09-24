import api from './api';

export type SupportSessionStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'ASSIGNED'
  | 'RINGING'
  | 'CONNECTED'
  | 'ENDED'
  | 'RESOLVED'
  | 'EXPIRED';

export type SupportSession = {
  id: string;
  code: string;
  pin: string;
  status: SupportSessionStatus;
  orgId: string;
  customerUserId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  technicianId?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  issueCategory?: string | null;
  issueSummary?: string | null;
  notes?: string | null;
  systemInfo?: {
    os?: string;
    osVersion?: string;
    ram?: string;
    cpu?: string;
    ip?: string;
    ipLocal?: string;
    uptime?: string;
    capturedAt?: string;
  } | null;
  createdAt: string;
  acceptedAt?: string | null;
  connectedAt?: string | null;
  endedAt?: string | null;
  durationSec?: number | null;
  rating?: number | null;
  ratingComment?: string | null;
  recordingUrl?: string | null;
  expiresAt?: string;
};

export type SupportTechnician = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
};

export type CreateSupportSessionInput = {
  issueSummary: string;
  issueCategory?: string;
  deviceId?: string;
  deviceName?: string;
  technicianId?: string;
};

export const sessionsApi = {
  async list(params: { status?: string; assignedToMe?: boolean } = {}) {
    const { data } = await api.get<SupportSession[]>('/api/sessions', { params });
    return data;
  },

  async get(id: string) {
    const { data } = await api.get<SupportSession>(`/api/sessions/${id}`);
    return data;
  },

  async technicians() {
    const { data } = await api.get<{ technicians: SupportTechnician[] }>('/api/sessions/technicians');
    return data.technicians || [];
  },

  async create(input: CreateSupportSessionInput | string) {
    const body = typeof input === 'string' ? { issueSummary: input } : input;
    const { data } = await api.post<SupportSession>('/api/sessions', body);
    return data;
  },

  async accept(session: SupportSession) {
    const { data } = await api.post<SupportSession>(`/api/sessions/${session.id}/accept`, { pin: session.pin });
    return data;
  },

  async assign(id: string, technicianId: string) {
    const { data } = await api.post<SupportSession>(`/api/sessions/${id}/assign`, { technicianId });
    return data;
  },

  async update(id: string, body: { notes?: string; issueCategory?: string }) {
    const { data } = await api.patch<SupportSession>(`/api/sessions/${id}`, body);
    return data;
  },

  async connected(id: string) {
    const { data } = await api.post<SupportSession>(`/api/sessions/${id}/connected`);
    return data;
  },

  async systemInfo(id: string, systemInfo: Record<string, any>) {
    const { data } = await api.post<SupportSession>(`/api/sessions/${id}/system-info`, {
      ...systemInfo,
      ip: systemInfo.ip || systemInfo.ipLocal,
      os: systemInfo.osVersion ? `${systemInfo.os} ${systemInfo.osVersion}` : systemInfo.os,
    });
    return data;
  },

  async end(id: string, resolution?: string) {
    const { data } = await api.post<SupportSession & { ratingPromptUrl?: string }>(`/api/sessions/${id}/end`, { resolution });
    return data;
  },

  async rate(id: string, rating: number, comment?: string) {
    const { data } = await api.post<SupportSession>(`/api/sessions/${id}/rate`, { rating, comment });
    return data;
  },
};
