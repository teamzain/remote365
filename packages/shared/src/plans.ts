export enum PlanId {
    TRIAL = 'TRIAL',
    SOLO = 'SOLO',
    PRO = 'PRO',
    BUSINESS = 'BUSINESS',
    ENTERPRISE = 'ENTERPRISE',
}

export interface PlanMetadata {
    id: PlanId;
    name: string;
    price: number | 'Custom';
    priceLabel: string;
    description: string;
    maxDevices: number | null;
    maxUsers: number | null;
    maxConcurrentSessions: number | null;
    trialDays?: number;
    auditRetentionDays?: number | 'Custom';
    features: string[];
    popular?: boolean;
}

export const PLAN_CATALOG: PlanMetadata[] = [
    {
        id: PlanId.TRIAL,
        name: 'Trial',
        price: 0,
        priceLabel: '15 days free',
        description: 'One organization owner gets full access for 15 days, with three devices and core remote support features.',
        maxDevices: 3,
        maxUsers: 1,
        maxConcurrentSessions: 1,
        trialDays: 15,
        features: [
            '1 member',
            '3 devices',
            '1 concurrent session',
            'Support sessions',
            'Unattended access',
            'File transfer',
            'Clipboard sync',
            'Meetings',
        ],
    },
    {
        id: PlanId.SOLO,
        name: 'Solo',
        price: 15,
        priceLabel: '$15 / month',
        description: 'For an individual managing their own machines, with no team administration screens.',
        maxDevices: 10,
        maxUsers: 2,
        maxConcurrentSessions: 1,
        features: [
            '2 members',
            '10 devices',
            '1 concurrent session',
            'Unattended access',
            'File transfer',
            'Clipboard sync',
            'Meetings',
            'No roles, groups, support queue, or team administration',
        ],
    },
    {
        id: PlanId.PRO,
        name: 'Pro',
        price: 40,
        priceLabel: '$40 / month',
        description: 'For small support teams that need assigned access and support workflows.',
        maxDevices: 50,
        maxUsers: 5,
        maxConcurrentSessions: 3,
        auditRetentionDays: 30,
        popular: true,
        features: [
            '5 members',
            '50 devices',
            '3 concurrent sessions',
            'Technician and Viewer roles',
            'Device groups',
            'Per-member device access',
            'Support queue',
            'Scripts library',
            'Basic analytics',
            '30-day audit log',
        ],
    },
    {
        id: PlanId.BUSINESS,
        name: 'Business',
        price: 100,
        priceLabel: '$100 / month',
        description: 'For delegated team management with full RBAC, policies, analytics, and branding.',
        maxDevices: 200,
        maxUsers: 25,
        maxConcurrentSessions: 10,
        auditRetentionDays: 365,
        features: [
            '25 members',
            '200 devices',
            '10 concurrent sessions',
            'Admin role and full RBAC',
            'Connection policies',
            'Forced two-factor authentication',
            'Session recording',
            'Full analytics',
            'Custom branding',
            '1-year audit log',
            'Priority support',
        ],
    },
    {
        id: PlanId.ENTERPRISE,
        name: 'Enterprise',
        price: 'Custom',
        priceLabel: 'Custom',
        description: 'For large organizations needing unlimited scale, compliance controls, SSO, and SLA support.',
        maxDevices: null,
        maxUsers: null,
        maxConcurrentSessions: null,
        auditRetentionDays: 'Custom',
        features: [
            'Unlimited members',
            'Unlimited devices',
            'Unlimited concurrent sessions',
            'Custom roles',
            'SSO/SAML login',
            'Custom audit retention',
            'Analytics export',
            'Dedicated support with SLA',
        ],
    },
];

export const PLAN_LIMITS = {
    [PlanId.TRIAL]: {
        maxConcurrentSessions: 1,
        maxDevices: 3,
        sessionDurationMinutes: -1,
        fileTransfer: true,
        sessionRecording: false,
        teamMembers: 1,
    },
    [PlanId.SOLO]: {
        maxConcurrentSessions: 1,
        maxDevices: 10,
        sessionDurationMinutes: -1,
        fileTransfer: true,
        sessionRecording: false,
        teamMembers: 2,
    },
    [PlanId.PRO]: {
        maxConcurrentSessions: 3,
        maxDevices: 50,
        sessionDurationMinutes: -1,
        fileTransfer: true,
        sessionRecording: false,
        teamMembers: 5,
    },
    [PlanId.BUSINESS]: {
        maxConcurrentSessions: 10,
        maxDevices: 200,
        sessionDurationMinutes: -1,
        fileTransfer: true,
        sessionRecording: true,
        teamMembers: 25,
    },
    [PlanId.ENTERPRISE]: {
        maxConcurrentSessions: -1,
        maxDevices: -1,
        sessionDurationMinutes: -1,
        fileTransfer: true,
        sessionRecording: true,
        teamMembers: -1,
    },
} as const;

/**
 * Per-FILE transfer cap by plan, in bytes (-1 = unlimited). The single source
 * for the number: the signaling service stamps the viewer's cap onto every
 * session join so the host enforces it, and the desktop shows it in the file
 * panel. Keep apps/desktop/src/renderer/lib/transferLimits.ts in step (the
 * renderer cannot import this package).
 */
const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
export const FILE_TRANSFER_MAX_BYTES: Record<PlanId, number> = {
    [PlanId.TRIAL]: 500 * MB,
    [PlanId.SOLO]: 2 * GB,
    [PlanId.PRO]: 5 * GB,
    [PlanId.BUSINESS]: 20 * GB,
    [PlanId.ENTERPRISE]: -1,
};

/** Cap for a plan id; unknown/custom plans get the tightest (Trial) cap unless they are unlimited. */
export function fileTransferMaxBytesForPlan(plan: string | null | undefined): number {
    const key = String(plan || '').toUpperCase() as PlanId;
    if (key in FILE_TRANSFER_MAX_BYTES) return FILE_TRANSFER_MAX_BYTES[key];
    return FILE_TRANSFER_MAX_BYTES[PlanId.TRIAL];
}

export const PLAN_ROLE_OPTIONS: Record<PlanId, string[]> = {
    [PlanId.TRIAL]: ['OWNER', 'ADMIN', 'VIEWER'],
    [PlanId.SOLO]: ['OWNER', 'ADMIN', 'VIEWER'],
    [PlanId.PRO]: ['OWNER', 'ADMIN', 'VIEWER'],
    [PlanId.BUSINESS]: ['OWNER', 'ADMIN', 'VIEWER'],
    [PlanId.ENTERPRISE]: ['OWNER', 'ADMIN', 'VIEWER'],
};

export const PLAN_ORDER: PlanId[] = [
    PlanId.TRIAL,
    PlanId.SOLO,
    PlanId.PRO,
    PlanId.BUSINESS,
    PlanId.ENTERPRISE,
];

export const normalizePlanId = (plan?: string | null): PlanId => {
    const upper = String(plan || '').toUpperCase();
    return (Object.values(PlanId) as string[]).includes(upper) ? upper as PlanId : PlanId.TRIAL;
};
