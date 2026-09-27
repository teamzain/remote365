import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { PlanId, PLAN_ORDER, getPlanLimits, normalizePlanId, prisma, redisPublisher, generateToken, verifyToken, checkPlanLimit, userHasPermission, recordActivity, normalizeHostSecret, hashHostSecret, hostSecretMatches } from '@remotelink/shared';
import { createHash, randomBytes, randomInt } from 'crypto';
import { canAccessDevice, canRequestControl } from '../utils/rbac';

const REMOTE_SESSION_LINK_TTL_MS = Number(process.env.REMOTE_SESSION_LINK_TTL_MINUTES || 1440) * 60 * 1000;

// Helper to generate 9-digit CSPRNG key
function generateAccessKey(): string {
  return randomInt(0, 1000000000).toString().padStart(9, '0');
}

function generateAccessPassword(): string {
  return randomInt(0, 100000000).toString().padStart(8, '0');
}

async function generateUniqueAccessKey(): Promise<string> {
  let accessKey = generateAccessKey();
  while (await prisma.device.findUnique({ where: { accessKey } })) {
    accessKey = generateAccessKey();
  }
  return accessKey;
}

// One machine = one permanent ID. The key is a pure function of the hardware
// fingerprint, so the same machine always computes back to the same 9-digit ID —
// across reinstalls, wiped caches, device removal, even a reset database. On the
// (rare) collision where another machine already holds the derived key, walk the
// hash chain for a new deterministic candidate; random keys are the last resort.
async function deriveStableAccessKey(fingerprint: string): Promise<string> {
  let seed = fingerprint;
  for (let i = 0; i < 5; i++) {
    const digest = createHash('sha256').update(`r365-device-id:${seed}`).digest('hex');
    const candidate = (BigInt('0x' + digest.slice(0, 16)) % 900000000n + 100000000n).toString();
    const holder = await prisma.device.findUnique({ where: { accessKey: candidate } });
    if (!holder || holder.machineFingerprint === fingerprint) return candidate;
    seed = digest;
  }
  return generateUniqueAccessKey();
}

async function mapDevice(device: any, userId: string): Promise<any> {
  const cleanKey = String(device.accessKey).replace(/\s/g, '');
  const [presence, activeSession] = await Promise.all([
    redisPublisher.get(`presence:${cleanKey}`),
    redisPublisher.get(`session:active:${cleanKey}`)
  ]);

  // Handle nested organization info if present (from includes)
  const org = device.organization || device.owner?.organization || null;
  // Unified device groups are org-level (DeviceGroup). Show every group the
  // device belongs to; the same groups drive member access grants.
  const deviceGroups = Array.isArray(device.groups)
    ? device.groups
    : await prisma.deviceGroup.findMany({
        where: { devices: { some: { id: device.id } } },
        select: { id: true, name: true, color: true }
      });

  return {
    id: device.id,
    device_name: device.name,
    device_type: (device.deviceType || 'DESKTOP').toLowerCase(),
    access_key: device.accessKey,
    last_seen_at: device.lastSeenAt,
    last_seen: device.lastSeenAt,
    is_online: presence === 'online',
    in_session: Boolean(activeSession),
    is_owned: device.ownerId === userId,
    has_password: !!device.accessPasswordHash,
    password_required: device.passwordRequired !== false,
    tags: device.tags || [],
    settings: device.settings || {},
    // Archive is PER USER: the same device can be archived by one member and
    // still visible to another, which matches how the web's local-only
    // version behaved. Stored as a userId list inside the existing settings
    // JSON, so no migration is needed.
    // Device-wide: archived by ANY account = archived for every account. The
    // fleet is managed from multiple logins (personal on desktop, business on
    // web), so per-user archive read as "not syncing".
    is_archived: Array.isArray(((device.settings || {}) as any).archivedBy)
      && ((device.settings || {}) as any).archivedBy.length > 0,
    device_groups: deviceGroups.map((group: any) => ({
      id: group.id,
      name: group.name,
      color: group.color || null
    })),
    org_name: org?.name || null,
    org_slug: org?.slug || null,
    org_id: org?.id || null
  };
}

function isBootstrapOnlyDevice(device: any): boolean {
  const name = String(device?.name || '').trim().toLowerCase();
  return !device?.ownerId || name === 'unknown machine' || name === 'remote 365 device';
}

function isDefaultDeviceName(name: any): boolean {
  const normalized = String(name || '').trim().toLowerCase();
  return !normalized || normalized === 'unknown machine' || normalized === 'remote 365 device' || normalized === 'remote pc';
}

// A device name is how a person picks one machine out of the list, so two
// devices sharing it makes the list ambiguous. Names must be unique within the
// organization — or within the owner's own devices when there is no org.
// Machine-driven registration is exempt (hostnames arrive as-is); this guards
// the name fields a user types.
async function findDuplicateDeviceName(
  device: { id: string; ownerId?: string | null; organizationId?: string | null },
  name: string
): Promise<{ id: string; name: string | null } | null> {
  const cleanName = String(name || '').trim();
  if (!cleanName) return null;

  const scope = device.organizationId
    ? { organizationId: device.organizationId }
    : (device.ownerId ? { ownerId: device.ownerId, organizationId: null } : null);
  if (!scope) return null;

  return prisma.device.findFirst({
    where: {
      ...scope,
      id: { not: device.id },
      name: { equals: cleanName, mode: 'insensitive' }
    },
    select: { id: true, name: true }
  });
}

async function publishAccountSync(targetUserIds: Array<string | null | undefined>, scope: string, action: string, entityId?: string) {
  const uniqueUserIds = Array.from(new Set(targetUserIds.filter(Boolean))) as string[];
  if (uniqueUserIds.length === 0) return;
  await redisPublisher.publish('account:sync', JSON.stringify({
    type: 'account-sync',
    scope,
    action,
    entityId,
    targetUserIds: uniqueUserIds,
    changedAt: new Date().toISOString()
  }));
}

async function getSavedDeviceUserIds(deviceId: string): Promise<string[]> {
  const saved = await prisma.savedDevice.findMany({
    where: { deviceId },
    select: { userId: true }
  });
  return saved.map((row: any) => row.userId).filter(Boolean);
}

// Every user in a device's organization, so an add/remove of a device fans out to
// each teammate in real time. Safe to over-broadcast: each client refetches
// /mine, which is permission-filtered, so a member only ever sees the devices
// they're actually granted — the sync event just tells them WHEN to refetch.
async function getOrgMemberUserIds(organizationId: string | null | undefined): Promise<string[]> {
  if (!organizationId) return [];
  const members = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true }
  });
  return members.map((row: any) => row.id).filter(Boolean);
}

async function getDeviceViewerUserIds(deviceId: string): Promise<string[]> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: {
      ownerId: true,
      organizationId: true,
      groups: { select: { id: true } }
    }
  });
  if (!device) return [];

  const savedViewerIds = await getSavedDeviceUserIds(deviceId);
  const targetUserIds = new Set(savedViewerIds.filter(Boolean));
  if (!device.organizationId) return Array.from(targetUserIds);

  const groupIds = (device.groups || []).map((group: any) => group.id).filter(Boolean);
  const ownerFilter = device.ownerId ? { id: { not: device.ownerId } } : {};
  const orgViewers = await prisma.user.findMany({
    where: {
      organizationId: device.organizationId,
      ...ownerFilter,
      OR: [
        { allowedDeviceIds: { has: '__all__' } },
        { allowedDeviceIds: { has: deviceId } },
        ...(groupIds.length ? [{ allowedGroups: { some: { id: { in: groupIds } } } }] : [])
      ]
    },
    select: { id: true }
  });
  orgViewers.forEach((viewer: any) => targetUserIds.add(viewer.id));
  return Array.from(targetUserIds);
}

// Helper to check device access based on role/tags/deviceIds
function hasDevicePermission(user: any, device: any): boolean {
  if (user.organizationId !== device.organizationId) return false;
  if (user.organizationId && user.organizationId === device.organizationId) return true;

  // Full org access granted explicitly
  if (user.allowedDeviceIds?.includes('__all__')) return true;

  // Tag-based access
  if (user.allowedTags?.length > 0) {
    if (user.allowedTags.some((tag: string) => device.tags.includes(tag))) return true;
  }

  // Specific device access
  if (user.allowedDeviceIds?.length > 0) {
    if (user.allowedDeviceIds.includes(device.id)) return true;
  }

  // No access granted — default deny
  if (user.allowedGroups?.length > 0 && device.groups?.length > 0) {
    const allowedGroupIds = new Set(user.allowedGroups.map((group: any) => group.id));
    if (device.groups.some((group: any) => allowedGroupIds.has(group.id))) return true;
  }

  return false;
}

function canManageDeviceMetadata(user: any, device: any): boolean {
  if (device.ownerId === user?.id) return true;
  if (!user?.organizationId || user.organizationId !== device.organizationId) return false;
  return true;
}

async function getAuthenticatedDeviceUser(authHeader?: string) {
  if (!authHeader) return { error: 'Unauthorized' as const };
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded?.userId) return { error: 'Invalid token' as const };

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { allowedGroups: { select: { id: true } } }
  });
  if (!user) return { error: 'User not found' as const };
  return { decoded, user };
}

// Per-user capability check: honours the acting user's permissionOverrides on
// top of their role default. `actor` may be a full user record (has
// permissionOverrides) or any object with { role, permissionOverrides }.
function hasDeviceCapability(
  actor: { role?: string | null; permissionOverrides?: any } | null | undefined,
  permission: 'devices:view' | 'devices:register' | 'devices:remove' | 'devices:assign' | 'devices:configure' | 'devices:groups:create' | 'devices:groups:delete'
) {
  return userHasPermission(actor, permission);
}

// For routes that only decoded the JWT (no user record loaded), fetch the
// acting user's role + overrides once so the capability check is per-user.
async function loadDeviceActor(userId: string | null | undefined) {
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, permissionOverrides: true },
  });
}

// --- Device access settings & one-time access codes (Settings → Device management) ---

// Unambiguous alphabet (no I/L/O/0/1) for codes people read out loud.
const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateOneTimeCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += ACCESS_CODE_ALPHABET[randomInt(0, ACCESS_CODE_ALPHABET.length)];
  return code;
}

const normalizeAccessCode = (raw: string) => String(raw || '').replace(/[\s-]/g, '').toUpperCase();

const hashAccessCode = (code: string) => createHash('sha256').update(normalizeAccessCode(code)).digest('hex');

// Evaluates device.settings.accessSchedule ({ enabled, days[0-6 Sun-Sat],
// start "HH:MM", end "HH:MM", timezone }) against the current time in the
// device's own timezone. Malformed schedules fail OPEN so a bad write can
// never brick access; overnight windows (start > end) span midnight.
function isWithinAccessSchedule(schedule: any): boolean {
  if (!schedule || schedule.enabled !== true) return true;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: schedule.timezone || 'UTC',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const byType: Record<string, string> = {};
    for (const p of parts) byType[p.type] = p.value;
    const dayIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(byType.weekday);

    const days: number[] = Array.isArray(schedule.days) ? schedule.days.map(Number) : [];
    if (days.length > 0 && !days.includes(dayIdx)) return false;

    const toMinutes = (value: string): number | null => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
      return m ? Math.min(23, parseInt(m[1], 10)) * 60 + Math.min(59, parseInt(m[2], 10)) : null;
    };
    const nowMin = parseInt(byType.hour, 10) * 60 + parseInt(byType.minute, 10);
    const start = toMinutes(schedule.start);
    const end = toMinutes(schedule.end);
    if (start === null || end === null || start === end) return true;
    return start < end ? nowMin >= start && nowMin < end : nowMin >= start || nowMin < end;
  } catch {
    return true;
  }
}

// Changing access settings / minting codes is allowed for the device owner,
// an org member with device rights over it, or the machine itself: the app
// sends its access key + device password (deviceAuth) — the same credentials
// that already grant full remote control — so "This Device" settings work for
// whichever account is signed in at the keyboard.
async function canManageDeviceAccess(
  userId: string,
  device: any,
  deviceAuth?: { accessKey?: string; password?: string }
): Promise<boolean> {
  if (device.ownerId === userId) return true;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { allowedGroups: { select: { id: true } } }
  });
  if (user && hasDevicePermission(user, device)) return true;

  const presentedKey = String(deviceAuth?.accessKey || '').replace(/\D/g, '');
  if (!presentedKey || presentedKey !== String(device.accessKey)) return false;
  // A passwordless (Easy Access) device is fully controllable with the key
  // alone, so the key is sufficient proof of possession.
  if (device.passwordRequired === false) return true;
  const presentedPassword = String(deviceAuth?.password || '');
  if (device.accessPasswordHash && presentedPassword) {
    return bcrypt.compare(presentedPassword, device.accessPasswordHash);
  }
  return false;
}

async function requireDevicePlan(userId: string, minimumPlan: PlanId) {
  const { plan } = await getPlanLimits(userId);
  // Super-admin-created custom plans aren't in PLAN_ORDER (normalizePlanId
  // would collapse them to TRIAL and deny them); treat them as paid plans
  // that include device groups.
  const planId = String(plan || '').toUpperCase();
  if (planId && !PLAN_ORDER.includes(planId as PlanId)) {
    return { plan };
  }
  const currentIndex = PLAN_ORDER.indexOf(normalizePlanId(plan));
  const minimumIndex = PLAN_ORDER.indexOf(minimumPlan);
  if (currentIndex < minimumIndex) {
    return { error: `Device groups are available on ${minimumPlan} and higher plans.` as const };
  }
  return { plan };
}

async function listVisibleDevicesForUser(user: any, deviceInclude: any) {
  if (!user.organizationId) return [];

  return prisma.device.findMany({
    where: { organizationId: user.organizationId },
    include: deviceInclude,
    orderBy: { lastSeenAt: 'desc' }
  });
}

// Org devices the member is granted access to, honoring their access type:
//  - allowedDeviceIds includes '__all__'  -> every device in the org
//  - allowedGroups                        -> devices inside those groups
//  - allowedDeviceIds (specific ids)      -> exactly those devices
// Returns [] when the user has no org or no grant.
async function fetchGrantedOrgDevices(user: any, deviceInclude: any) {
  if (!user?.organizationId) return [];
  const allowedIds: string[] = Array.isArray(user.allowedDeviceIds) ? user.allowedDeviceIds : [];
  const allowedGroupIds: string[] = Array.isArray(user.allowedGroups)
    ? user.allowedGroups.map((g: any) => g.id).filter(Boolean)
    : [];

  // Owners and super-admins see every device in their org — same full-access
  // rule the rest of the code uses (e.g. the device-groups query). Without this,
  // a device an owner doesn't personally own showed up in the admin list (/all,
  // which is org-wide) but never on their own Devices page (/mine).
  const role = String(user.role || '').toUpperCase();
  const fullAccess = role === 'OWNER' || role === 'SUPER_ADMIN' || allowedIds.includes('__all__');
  if (fullAccess) {
    return prisma.device.findMany({
      where: { organizationId: user.organizationId },
      include: deviceInclude
    });
  }

  const specificIds = allowedIds.filter((id) => id && id !== '__all__');
  if (specificIds.length === 0 && allowedGroupIds.length === 0) return [];

  const or: any[] = [];
  if (specificIds.length) or.push({ id: { in: specificIds } });
  if (allowedGroupIds.length) or.push({ groups: { some: { id: { in: allowedGroupIds } } } });

  return prisma.device.findMany({
    where: { organizationId: user.organizationId, OR: or },
    include: deviceInclude
  });
}

async function userCanManageDeviceGroup(user: any, deviceId: string) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: {
      groups: { select: { id: true } },
      savedByUsers: { where: { userId: user.id }, select: { userId: true } }
    }
  });
  if (!device) return { error: 'Device not found' as const };
  if (device.ownerId === user.id || device.savedByUsers.length > 0 || hasDevicePermission(user, device)) {
    return { device };
  }
  return { error: 'Not authorized for this device' as const };
}

export default async function deviceRoutes(fastify: FastifyInstance) {

  // 0. Add Existing Device (Moved to top for matching priority)
  fastify.post('/add-existing', { preHandler: [checkPlanLimit('maxDevices')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });
    const actor = await loadDeviceActor(decoded.userId);
    if (!hasDeviceCapability(actor, 'devices:view')) {
      return reply.code(403).send({ error: 'Device view access required' });
    }

    let { accessKey, password, name, tags, claimOwnership, remember } = request.body as any;
    if ((name || (tags && Array.isArray(tags))) && !hasDeviceCapability(actor, 'devices:configure')) {
      return reply.code(403).send({ error: 'Device configuration access required' });
    }
    if (!accessKey) return reply.code(400).send({ error: 'accessKey required' });
    accessKey = String(accessKey).replace(/\s/g, '');
    console.log(`[Device-Debug] Attempting to add existing device: ${accessKey}`);

    const device = await prisma.device.findUnique({ where: { accessKey } });
    if (!device) {
      console.log(`[Device-Debug] Device not found in DB for key: ${accessKey}`);
      return reply.code(404).send({ error: 'Device not found' });
    }

    // Owning the device does not skip the password: trust must be earned with
    // the current credential so a rotated password cuts everyone over cleanly.
    let passwordVerified = device.passwordRequired === false;
    if (!passwordVerified && device.passwordRequired !== false) {
      if (!password) return reply.code(401).send({ error: 'Password required to add this device' });
      if (!device.accessPasswordHash) {
        console.log(`[Device-Debug] Device found but has no accessPasswordHash: ${accessKey}`);
        return reply.code(404).send({ error: 'Device has no access password set yet' });
      }
      const isMatch = await bcrypt.compare(password, device.accessPasswordHash as string);
      if (!isMatch) {
        console.log(`[Device-Debug] Password mismatch for device: ${accessKey}`);
        return reply.code(401).send({ error: 'Incorrect password' });
      }
      passwordVerified = true;
    }

    // Safe to link
    const existingLink = await prisma.savedDevice.findUnique({
      where: { userId_deviceId: { userId: decoded.userId, deviceId: device.id } }
    });

    // The same ID can only be in a list once. Adding a device that is already
    // there is a no-op the user should be told about — unless they are
    // deliberately restoring one they archived/hid locally (allowRelink), which
    // is how the desktop/web "Archived devices" restore path re-adds by ID.
    const alreadyInList = Boolean(existingLink) || device.ownerId === decoded.userId;
    if (alreadyInList && (request.body as any)?.allowRelink !== true) {
      return reply.code(409).send({
        error: 'This device is already in your device list',
        code: 'DEVICE_ALREADY_ADDED',
        deviceId: device.id
      });
    }

    // Update device name/tags if provided
    if (name || (tags && Array.isArray(tags))) {
      const cleanName = String(name || '').trim();
      if (cleanName) {
        // A device claimed during this add lands in the adder's org, so scope the
        // name check there when the device has no owner/org of its own yet.
        const adder = (device.organizationId || device.ownerId)
          ? null
          : await prisma.user.findUnique({ where: { id: decoded.userId }, select: { organizationId: true } });
        const duplicateName = await findDuplicateDeviceName({
          id: device.id,
          ownerId: device.ownerId || decoded.userId,
          organizationId: device.organizationId || adder?.organizationId || null
        }, cleanName);
        if (duplicateName) {
          return reply.code(409).send({ error: `Another device is already named "${duplicateName.name}"` });
        }
      }
      await prisma.device.update({
        where: { id: device.id },
        data: {
          name: cleanName || undefined,
          tags: (tags && Array.isArray(tags)) ? { set: tags } : undefined
        }
      });
    }

    if (!existingLink) {
      await prisma.savedDevice.create({
        data: { userId: decoded.userId, deviceId: device.id }
      });
    }

    // "Remember this device" decides whether the verified password persists as
    // a trust row (passwordless reconnects). Unchecked ⇒ no trust — and drop
    // any prior trust so the device genuinely prompts on every connect again.
    // Omitted (mobile/legacy clients) keeps the old always-remember behavior.
    const rememberTrust = remember !== false;
    if (passwordVerified && rememberTrust) {
      await prisma.trustedDevice.upsert({
        where: { viewerUserId_hostDeviceId: { viewerUserId: decoded.userId, hostDeviceId: device.id } },
        update: {},
        create: { viewerUserId: decoded.userId, hostDeviceId: device.id }
      });
    } else if (!rememberTrust) {
      await prisma.trustedDevice.deleteMany({
        where: { viewerUserId: decoded.userId, hostDeviceId: device.id }
      });
    }

    let linkedDevice = device;
    if (claimOwnership === true && !device.ownerId) {
      if (!hasDeviceCapability(actor, 'devices:register')) {
        return reply.code(403).send({ error: 'Device registration access required' });
      }
      // Adopt a freshly-claimed device into the claimer's organization so Super Admin
      // attributes it to that org (org device list + counts). A self-registered device
      // has organizationId = null; without this it keeps showing as Unregistered and
      // never appears under any organization even after it gains an owner.
      const adder = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { organizationId: true, departmentId: true }
      });
      linkedDevice = await prisma.device.update({
        where: { id: device.id },
        data: {
          ownerId: decoded.userId,
          ...(device.organizationId ? {} : {
            organizationId: adder?.organizationId ?? undefined,
            departmentId: adder?.departmentId ?? undefined
          })
        }
      });
    }

    const mapped = await mapDevice(linkedDevice, decoded.userId);
    await publishAccountSync([decoded.userId, linkedDevice.ownerId], 'devices', 'linked', linkedDevice.id);
    return reply.send({ success: true, device: mapped });
  });

  // 1. Verify access key + password and return 60s JWT (Viewer Step 2)
  fastify.post('/verify-access', async (request: FastifyRequest, reply: FastifyReply) => {
    const verifyStartedAt = process.hrtime.bigint();
    reply.raw.once('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - verifyStartedAt) / 1e6;
      console.log(`[Perf] verify-access status=${reply.statusCode} elapsedMs=${elapsedMs.toFixed(1)}`);
    });
    let { accessKey, password, approvalOnly } = request.body as any;
    if (!accessKey) return reply.code(400).send({ error: 'Access Key required' });
    accessKey = String(accessKey).replace(/\s/g, '');
    console.log(`[Device-Debug] verify-access attempt for: ${accessKey}`);

    const device = await prisma.device.findUnique({ where: { accessKey }, include: { groups: { select: { id: true } } } });
    if (!device) {
      console.log(`[Device-Debug] verify-access: Device not found in DB for key: ${accessKey}`);
      return reply.code(404).send({ error: 'Device not found' });
    }

    // Platform "Block Device" — refuse everyone, owner included. Until this
    // check the block only changed a badge in the super admin console.
    if (String((device as any).status || '').toUpperCase() === 'BLOCKED') {
      console.log(`[Device-Debug] verify-access: device is platform-blocked: ${accessKey}`);
      return reply.code(403).send({ error: 'This device has been disabled by the platform administrator.', blocked: true });
    }

    // Owner-controlled access settings (Settings → Device management). The
    // device owner is exempt so they can never lock themselves out.
    const deviceSettings: any = (device as any).settings || {};
    const authHeader = request.headers.authorization;
    const decodedRequester = authHeader ? verifyToken(authHeader.split(' ')[1]) : null;
    const requesterUserId: string | null = decodedRequester?.userId || null;
    const requesterIsOwner = !!requesterUserId && requesterUserId === (device as any).ownerId;
    if (!requesterIsOwner) {
      if (deviceSettings.allowIncoming === false) {
        return reply.code(403).send({ error: 'This device is not accepting incoming connections right now.' });
      }
      if (!isWithinAccessSchedule(deviceSettings.accessSchedule)) {
        return reply.code(403).send({ error: 'This device only accepts connections during its scheduled access hours.' });
      }
    }

    const passwordRequired = device.passwordRequired !== false;
    const requiresHostApprovalOnly = Boolean(approvalOnly);
    // An approval-only grant skips the password and leaves the decision to the
    // person at the host, whose prompt names the account asking. Anonymous
    // callers have no name to show or account to ban, and could otherwise
    // raise prompts on any device ID they guess.
    if (requiresHostApprovalOnly && !requesterUserId) {
      return reply.code(401).send({ error: 'Sign in to ask this device for access.' });
    }

    // "Unattended" = the owner said this machine may be driven with nobody
    // sitting at it, so the in-session control prompt is skipped. It is a
    // property of the DEVICE, and deliberately NOT derived from isTrusted or
    // passwordVerified: presenting today's password (or a one-time code, or
    // having ticked "don't ask again") proves a human is there to be asked,
    // which is the attended case and must still request control.
    // controlMode 'view' is the owner saying this machine is never to be driven,
    // and it wins: without this it would be contradicted silently, because an
    // unattended session never raises the request that the host app's
    // controlMode check runs on.
    const unattended = deviceSettings.controlMode !== 'view'
      && (!passwordRequired || deviceSettings.allowControlWithoutPrompt === true);

    if (!requiresHostApprovalOnly && passwordRequired && !device.accessPasswordHash) {
      console.log(`[Device-Debug] verify-access: Device found but has no accessPasswordHash: ${accessKey}`);
      return reply.code(404).send({ error: 'Device has no access password set yet. Go to host settings and set one.' });
    }

    // These checks are independent once the device and requester id are known.
    // Running them together removes three serial database/Redis round trips from
    // every connection before WebRTC is even allowed to start.
    const [viewer, ownerSecurity, presence, trustCheck] = await Promise.all([
      requesterUserId
        ? prisma.user.findUnique({
            where: { id: requesterUserId },
            select: {
              id: true,
              email: true,
              role: true,
              organizationId: true,
              permissionOverrides: true,
              allowedDeviceIds: true,
              allowedGroups: { select: { id: true } },
            },
          })
        : Promise.resolve(null),
      (device as any).ownerId
        ? prisma.user.findUnique({
            where: { id: (device as any).ownerId },
            select: { securitySettings: true } as any,
          })
        : Promise.resolve(null),
      redisPublisher.get(`presence:${accessKey}`),
      requesterUserId
        ? prisma.trustedDevice.findUnique({
            where: { viewerUserId_hostDeviceId: { viewerUserId: requesterUserId, hostDeviceId: device.id } },
          })
        : Promise.resolve(null),
    ]);

    // Effective check: honours per-user grants and revokes.
    if (requesterUserId && !canRequestControl(viewer)) {
      return reply.code(403).send({ error: 'You do not have permission to start remote sessions. Ask your organization owner for access.' });
    }

    // Owner's block/allow list (Settings → Security). Blocked accounts are
    // always rejected; a non-empty allow list restricts connections to the
    // listed accounts (anonymous viewers included). The owner always passes.
    if ((device as any).ownerId) {
      const sec: any = (ownerSecurity as any)?.securitySettings;
      const blockList: string[] = Array.isArray(sec?.blockList) ? sec.blockList : [];
      const allowList: string[] = Array.isArray(sec?.allowList) ? sec.allowList : [];
      if (blockList.length > 0 || allowList.length > 0) {
        const viewerIdent: string | null = requesterUserId;
        const viewerEmail: string | null = (viewer as any)?.email?.toLowerCase() || null;
        const isDeviceOwner = !!viewerIdent && viewerIdent === (device as any).ownerId;
        if (!isDeviceOwner) {
          const matches = (entry: string) => {
            const e = entry.trim().toLowerCase();
            return (!!viewerEmail && e === viewerEmail) || (!!viewerIdent && entry.trim() === viewerIdent);
          };
          if (blockList.some(matches)) {
            return reply.code(403).send({ error: 'The device owner has blocked your account from connecting to this device.' });
          }
          if (allowList.length > 0) {
            if (!viewerEmail) {
              return reply.code(403).send({ error: 'This device only accepts connections from approved accounts. Please sign in.' });
            }
            if (!allowList.some(matches)) {
              return reply.code(403).send({ error: 'Your account is not on the allow list for this device.' });
            }
          }
        }
      }
    }

    if (presence !== 'online') {
      return reply.code(409).send({ error: 'Device is offline' });
    }

    // Devices support multiple concurrent viewers, so we no longer refuse a
    // connection while a session is live. The signaling service still tracks
    // `session:active:<accessKey>` for the "In session" activity badge.

    // Check if user is trusted (Passwordless bypass). Owners are NOT exempt:
    // trust comes only from a TrustedDevice row ("Remember this machine" /
    // add-existing with the correct password). Rotating the device password
    // deletes those rows, so every viewer — the owner included — must present
    // the new password before they can connect again.
    const isTrusted = Boolean(trustCheck);
    const viewerUserId: string | null = requesterUserId;

    let passwordVerified = !requiresHostApprovalOnly && (isTrusted || !passwordRequired);

    if (!requiresHostApprovalOnly && !isTrusted && passwordRequired) {
      if (!password) return reply.code(401).send({ error: 'Password required for untrusted device connections' });
      if (!device.accessPasswordHash) {
        return reply.code(404).send({ error: 'Device has no access password set yet. Go to host settings and set one.' });
      }

      const lockoutKey = `lockout:${accessKey}`;
      const attempts = await redisPublisher.get(lockoutKey);
      if (attempts && parseInt(attempts) >= 5) {
        const ttl = await redisPublisher.ttl(lockoutKey);
        return reply.code(429).send({ error: 'Too many attempts', retryAfter: ttl });
      }

      // A one-time access code (Settings → Device management → Temporary
      // access) stands in for the device password exactly once. Failed code
      // guesses fall through to the bcrypt check and count toward lockout.
      const normalizedCode = normalizeAccessCode(password);
      if (/^[A-Z0-9]{6,10}$/.test(normalizedCode)) {
        const codeRow = await (prisma as any).deviceAccessCode.findFirst({
          where: { deviceId: device.id, codeHash: hashAccessCode(normalizedCode), usedAt: null, expiresAt: { gt: new Date() } }
        });
        if (codeRow) {
          await (prisma as any).deviceAccessCode.update({
            where: { id: codeRow.id },
            data: { usedAt: new Date(), usedById: viewerUserId }
          });
          await redisPublisher.del(lockoutKey);
          passwordVerified = true;
          console.log(`[Device-Debug] verify-access: one-time code redeemed for ${accessKey}`);
        }
      }

      if (!passwordVerified) {
        const isMatch = await bcrypt.compare(password, device.accessPasswordHash);
        if (!isMatch) {
          const fails = await redisPublisher.incr(lockoutKey);
          if (fails === 1) await redisPublisher.expire(lockoutKey, 300);
          return reply.code(401).send({ error: 'Incorrect password' });
        }

        await redisPublisher.del(lockoutKey);
        passwordVerified = true;
      }
    }

    // Record this join in session history WITHOUT spamming a new row per (re)connect.
    // Reuse an existing ACTIVE session for this code — preferring the host-created one
    // (from "New Session") so the host and every joiner share a single history entry and
    // the host can see who joined. Only create a fresh record if none exists yet.
    const hostOwnerId: string | null = device.ownerId || null;
    const now = new Date();
    let remoteSession = hostOwnerId
      ? await (prisma as any).remoteSession.findFirst({
          where: { sessionCode: device.accessKey, type: 'REMOTE_CONTROL', status: 'ACTIVE', createdById: hostOwnerId, expiresAt: { gt: now } },
          orderBy: { createdAt: 'desc' }
        })
      : null;
    if (!remoteSession && viewerUserId) {
      // Fall back to (and dedupe against) the viewer's own active session for this code.
      remoteSession = await (prisma as any).remoteSession.findFirst({
        where: { sessionCode: device.accessKey, type: 'REMOTE_CONTROL', status: 'ACTIVE', createdById: viewerUserId, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' }
      });
    }
    if (!remoteSession) {
      remoteSession = await (prisma as any).remoteSession.create({
        data: {
          name: `Remote control for ${device.name}`,
          sessionCode: device.accessKey,
          createdById: hostOwnerId || viewerUserId,
          type: 'REMOTE_CONTROL',
          status: 'ACTIVE',
          startedAt: now,
          expiresAt: new Date(Date.now() + REMOTE_SESSION_LINK_TTL_MS)
        }
      });
    }

    // Mark the joining viewer as a JOINED collaborator so it shows in their history and the
    // host sees them. Skip when the viewer is the session creator/owner (already visible).
    if (viewerUserId && remoteSession.createdById !== viewerUserId) {
      const existingCollaborator = await (prisma as any).remoteSessionCollaborator.findFirst({
        where: { sessionId: remoteSession.id, userId: viewerUserId }
      });
      if (existingCollaborator) {
        if (existingCollaborator.status !== 'JOINED') {
          await (prisma as any).remoteSessionCollaborator.update({
            where: { id: existingCollaborator.id },
            data: { status: 'JOINED', joinedAt: now }
          });
        }
      } else {
        await (prisma as any).remoteSessionCollaborator.create({
          data: {
            sessionId: remoteSession.id,
            userId: viewerUserId,
            email: `viewer-${viewerUserId}@remote.local`,
            status: 'JOINED',
            joinedAt: now
          }
        }).catch(() => { /* ignore unique-constraint race on concurrent joins */ });
      }
      // Nudge both the host and the viewer to refresh their session history in real time.
      await publishAccountSync([hostOwnerId, viewerUserId], 'remote-sessions', 'updated', remoteSession.id);
    }

    const sessionExpiresAt = remoteSession.expiresAt ? new Date(remoteSession.expiresAt) : new Date(Date.now() + REMOTE_SESSION_LINK_TTL_MS);
    const remoteSessionTokenTtlSeconds = Math.max(
      60,
      Math.floor((sessionExpiresAt.getTime() - Date.now()) / 1000)
    );
    const accessJWT = generateToken({
      type: 'remote-access',
      deviceId: device.id,
      accessKey: device.accessKey,
      viewerUserId,
      remoteSessionId: remoteSession.id,
      isTrusted: requiresHostApprovalOnly ? false : isTrusted,
      passwordVerified,
      // Carries "may take control without asking" to the host, separately from
      // "may join" (isTrusted/passwordVerified). The host is the enforcer.
      unattended
    }, remoteSessionTokenTtlSeconds);

    return reply.send({
      token: accessJWT,
      remoteSessionId: remoteSession.id,
      expiresAt: remoteSession.expiresAt?.toISOString(),
      device: { id: device.id, name: device.name, isTrusted, passwordRequired }
    });
  });

  // 1. Register a new device for the current user or organization
  fastify.post('/register', { preHandler: [checkPlanLimit('maxDevices')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`[Device-Debug] Registration attempt received`);
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return reply.code(401).send({ error: 'User not found' });
      if (!hasDeviceCapability(user,'devices:register')) {
        return reply.code(403).send({ error: 'Device registration access required' });
      }

      const { name, deviceType, enrollmentToken, claimExisting } = request.body as any || {};
      const deviceName = name || 'Remote PC';
      const validDeviceType = ['WINDOWS', 'MACOS', 'LINUX', 'IOS', 'ANDROID'].includes(deviceType?.toUpperCase()) ? deviceType.toUpperCase() : 'WINDOWS';

      let organizationId = user.organizationId;
      let departmentId = user.departmentId;

      // Handle Enrollment Token
      if (enrollmentToken) {
        const et = await prisma.enrollmentToken.findUnique({ where: { token: enrollmentToken } });
        if (!et) return reply.code(400).send({ error: 'Invalid enrollment token' });
        if (et.expiresAt && et.expiresAt < new Date()) return reply.code(400).send({ error: 'Enrollment token expired' });

        organizationId = et.organizationId;
        departmentId = et.departmentId || departmentId;
        console.log(`[Device-Debug] Enrolling device into Org: ${organizationId}`);
      }

      let accessKey = (request.body as any)?.accessKey;
      if (accessKey) accessKey = String(accessKey).replace(/\s/g, ''); // Standardize

      let password = (request.body as any)?.password;

      let existing = null;
      if (accessKey) {
        existing = await prisma.device.findUnique({ where: { accessKey } });
      }

      if (!existing) {
        existing = await prisma.device.findFirst({
          where: { ownerId: decoded.userId, name: deviceName }
        });
      }

      if (existing) {
        // If the access key belongs to another user, do not take it over.
        // Unowned self-registered devices can be claimed by the signed-in installer.
        if (existing.ownerId && existing.ownerId !== decoded.userId) {
          console.warn(`[Device-Debug] Conflict: Access key ${accessKey} is already owned by another user (${existing.ownerId}). Generating a new one for user ${decoded.userId}.`);
          existing = null; // Proceed as if not found to generate a new key
        } else {
          let updateData: any = {};
          if (!existing.ownerId && claimExisting === true) {
            updateData.ownerId = decoded.userId;
            updateData.organizationId = organizationId;
            updateData.departmentId = departmentId;
          } else if (!existing.ownerId) {
            return reply.code(409).send({
              error: 'Device exists but is not linked to this account. Confirm adding this device before claiming it.',
              requiresConfirmation: true
            });
          }

          // Never overwrite a user-defined device name during registration or
          // software update sync. Renames must go through PATCH /:id/name.
          if (claimExisting === true && isDefaultDeviceName(existing.name) && deviceName && deviceName !== existing.name) {
            updateData.name = deviceName;
          }

          if (accessKey && accessKey !== existing.accessKey) {
            // Ensure the new deterministic key doesn't clash
            const clash = await prisma.device.findUnique({ where: { accessKey } });
            if (!clash) updateData.accessKey = accessKey;
          }
          if (password) {
            updateData.accessPasswordHash = await bcrypt.hash(password, 10);
          }
          if (typeof (request.body as any)?.passwordRequired === 'boolean') {
            updateData.passwordRequired = Boolean((request.body as any).passwordRequired);
          }

          if (Object.keys(updateData).length > 0) {
            existing = await prisma.device.update({ where: { id: existing.id }, data: updateData });
          }

          // Registering runs on the machine itself, so the registrant holds its
          // credentials by definition — seed the account's trust row. A later
          // password rotation deletes it, which is what flips every signed-in
          // machine's button to "Update password".
          await prisma.trustedDevice.upsert({
            where: { viewerUserId_hostDeviceId: { viewerUserId: decoded.userId, hostDeviceId: existing.id } },
            update: {},
            create: { viewerUserId: decoded.userId, hostDeviceId: existing.id }
          });

          const mapped = await mapDevice(existing, decoded.userId);
          const claimOrgMemberIds = await getOrgMemberUserIds(existing.organizationId);
          const claimSavedUserIds = await getSavedDeviceUserIds(existing.id);
          await publishAccountSync([decoded.userId, existing.ownerId, ...claimOrgMemberIds, ...claimSavedUserIds], 'devices', 'updated', existing.id);
          return reply.code(200).send(mapped);
        }
      }

      if (!accessKey || (await prisma.device.findUnique({ where: { accessKey } }))) {
        accessKey = generateAccessKey();
        while (await prisma.device.findUnique({ where: { accessKey } })) {
          accessKey = generateAccessKey();
        }
      }

      const device = await prisma.device.create({
        data: {
          accessKey,
          ownerId: decoded.userId,
          organizationId,
          departmentId,
          name: deviceName,
          deviceType: validDeviceType as any,
          accessPasswordHash: password ? await bcrypt.hash(String(password), 10) : undefined,
          passwordRequired: typeof (request.body as any)?.passwordRequired === 'boolean' ? Boolean((request.body as any).passwordRequired) : undefined
        }
      });

      await recordActivity(organizationId, 'DEVICE_ADDED', `Device "${deviceName}" was added`, { id: decoded.userId });

      // Same trust seeding as the claim path above: the registering machine
      // is the device, so its account starts trusted until a rotation.
      await prisma.trustedDevice.upsert({
        where: { viewerUserId_hostDeviceId: { viewerUserId: decoded.userId, hostDeviceId: device.id } },
        update: {},
        create: { viewerUserId: decoded.userId, hostDeviceId: device.id }
      });

      const mapped = await mapDevice(device, decoded.userId);
      // Fan out to every teammate in the org so a device added by one member
      // shows up live for everyone who has access (no force reload).
      const orgMemberIds = await getOrgMemberUserIds(device.organizationId);
      await publishAccountSync([decoded.userId, ...orgMemberIds], 'devices', 'created', device.id);
      return reply.code(201).send(mapped);
    } catch (err: any) {
      console.error('[Device Registration Error]', err);
      return reply.code(500).send({ error: 'Failed to register device: ' + err.message });
    }
  });

  // 2. Format devices including online status
  fastify.get('/mine', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'Unauthorized' || auth.error === 'Invalid token' ? 401 : 404).send({ error: auth.error });
    const { decoded, user } = auth;
    if (!hasDeviceCapability(user,'devices:view')) {
      return reply.code(403).send({ error: 'Device view access required' });
    }

    const deviceInclude = {
      organization: { select: { id: true, name: true, slug: true } },
      groups: { select: { id: true, name: true, color: true } },
      owner: {
        select: {
          organization: { select: { id: true, name: true, slug: true } }
        }
      }
    };

    // /mine is intentionally account-scoped. Org-wide visibility belongs to
    // /all so one user's computers do not appear in every account.
    const ownedDevices = await prisma.device.findMany({
      where: { ownerId: decoded.userId },
      include: deviceInclude
    });

    // Fetch saved devices
    const savedRelations = await prisma.savedDevice.findMany({
      where: { userId: decoded.userId },
      include: {
        device: {
          include: deviceInclude
        }
      }
    });
    const savedDeviceIds = new Set(savedRelations.map((s: any) => s.deviceId).filter(Boolean));
    const savedDevices = savedRelations
      .map((s: any) => s.device)
      .filter(Boolean);
    // Org devices this member is granted access to (access-type aware). This is
    // what makes a Viewer/Admin see exactly the group/specific/all devices the
    // owner assigned, rather than only devices they personally own or saved.
    const grantedDevices = await fetchGrantedOrgDevices(user, deviceInclude);

    // Combine them
    const allDevicesMap = new Map();
    [...ownedDevices].forEach(d => {
      allDevicesMap.set(d.id, { ...d, _isOwned: true });
    });
    [...savedDevices].forEach(d => {
      if (!allDevicesMap.has(d.id)) allDevicesMap.set(d.id, { ...d, _isOwned: false });
    });
    [...grantedDevices].forEach(d => {
      if (!allDevicesMap.has(d.id)) allDevicesMap.set(d.id, { ...d, _isOwned: d.ownerId === decoded.userId });
    });

    let allDevices = Array.from(allDevicesMap.values())
      .filter((device: any) => !isBootstrapOnlyDevice(device) || savedRelations.some((s: any) => s.deviceId === device.id));
    const visibleDeviceIds = allDevices.map((device: any) => device.id).filter(Boolean);
    const trustedVisibleDeviceIds = new Set(
      visibleDeviceIds.length
        ? (await prisma.trustedDevice.findMany({
            where: {
              viewerUserId: decoded.userId,
              hostDeviceId: { in: visibleDeviceIds }
            },
            select: { hostDeviceId: true }
          })).map((trust: any) => trust.hostDeviceId)
        : []
    );

    // Look up redis presence
    const enrichedDevices = await Promise.all(allDevices.map(async (device) => {
      const mapped = await mapDevice(device, decoded.userId);
      return {
        ...mapped,
        // Owners are not exempt: connecting to your own device also requires
        // the password unless a trust row exists, so a rotation must surface
        // "Update password" on owned rows too. The client suppresses the flag
        // for the machine's own local row (you never connect to yourself).
        needs_password_update: Boolean(
          mapped.password_required &&
          mapped.has_password &&
          !trustedVisibleDeviceIds.has(device.id)
        )
      };
    }));

    // Sort: Online first, then by lastSeenAt DESC
    enrichedDevices.sort((a, b) => {
      if (a.is_online && !b.is_online) return -1;
      if (!a.is_online && b.is_online) return 1;
      return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    });

    return reply.send(enrichedDevices);
  });

  // Viewer reports a device problem to the owner + admins. There's no reports
  // table — the report is delivered in real time to the org's owner/admins as
  // an in-app notification (signaling relays 'device:report' to those users).
  fastify.post('/:id/report', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'Unauthorized' || auth.error === 'Invalid token' ? 401 : 404).send({ error: auth.error });
    const { decoded, user } = auth;
    if (!userHasPermission(user, 'devices:reportIssue')) {
      return reply.code(403).send({ error: 'You do not have permission to report a device.' });
    }
    if (!user.organizationId) return reply.code(400).send({ error: 'You are not part of an organization.' });

    const { id } = request.params as { id: string };
    const { message } = (request.body || {}) as { message?: string };
    const note = String(message || '').trim().slice(0, 1000);
    if (!note) return reply.code(400).send({ error: 'Please describe the problem.' });

    const device = await prisma.device.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { groups: { select: { id: true } } }
    });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    // The reporter must actually have this device in their access grant
    // (access-type aware: all / specific ids / group membership).
    const allowedIds: string[] = Array.isArray(user.allowedDeviceIds) ? user.allowedDeviceIds : [];
    const allowedGroupIds: string[] = Array.isArray(user.allowedGroups) ? user.allowedGroups.map((g: any) => g.id) : [];
    const deviceGroupIds: string[] = ((device as any).groups || []).map((g: any) => g.id);
    const hasAccess = allowedIds.includes('__all__')
      || allowedIds.includes(device.id)
      || deviceGroupIds.some((gid) => allowedGroupIds.includes(gid));
    if (!hasAccess) {
      return reply.code(403).send({ error: 'You do not have access to this device.' });
    }

    // Recipients: the org owner(s) + admins.
    const recipients = await prisma.user.findMany({
      where: { organizationId: user.organizationId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { id: true }
    });
    const targetUserIds = recipients.map((r) => r.id).filter((rid) => rid !== decoded.userId);

    const payload = {
      type: 'device-report',
      deviceId: device.id,
      deviceName: (device as any).name || 'a device',
      accessKey: device.accessKey,
      message: note,
      reporterId: decoded.userId,
      reporterName: user.name || user.email,
      reporterEmail: user.email,
      organizationId: user.organizationId,
      targetUserIds,
      createdAt: new Date().toISOString()
    };

    try {
      await redisPublisher.publish('device:report', JSON.stringify(payload));
    } catch (err) {
      console.error('[Devices] Failed to publish device report:', err);
    }

    return reply.send({ success: true });
  });

  // Role-aware all-devices view with server-side org/group filtering.
  fastify.get('/all', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'Unauthorized' || auth.error === 'Invalid token' ? 401 : 404).send({ error: auth.error });
    const { decoded, user } = auth;
    if (!hasDeviceCapability(user,'devices:view')) {
      return reply.code(403).send({ error: 'Device view access required' });
    }

    const deviceInclude = {
      organization: { select: { id: true, name: true, slug: true } },
      groups: { select: { id: true, name: true, color: true } },
      owner: {
        select: {
          organization: { select: { id: true, name: true, slug: true } }
        }
      }
    };

    const devices = await listVisibleDevicesForUser(user, deviceInclude);

    const visibleDevices = devices.filter((device: any) => !isBootstrapOnlyDevice(device));

    const enrichedDevices = await Promise.all(visibleDevices.map(async (device: any) => {
      return mapDevice(device, decoded.userId);
    }));

    enrichedDevices.sort((a: any, b: any) => {
      if (a.is_online && !b.is_online) return -1;
      if (!a.is_online && b.is_online) return 1;
      return 0;
    });

    return reply.send(enrichedDevices);
  });

  // Maintain backward compatibility for older GET /
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });
    const actor = await loadDeviceActor(decoded.userId);
    if (!hasDeviceCapability(actor, 'devices:view')) {
      return reply.code(403).send({ error: 'Device view access required' });
    }

    const devices = await prisma.device.findMany({
      where: { ownerId: decoded.userId }
    });
    return reply.send(devices);
  });

  // Account-scoped device groups for the Devices page.
  // These are intentionally separate from org-wide DeviceGroup records.
  fastify.get('/user-groups', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'Unauthorized' || auth.error === 'Invalid token' ? 401 : 404).send({ error: auth.error });
    const { decoded, user } = auth;
    if (!hasDeviceCapability(user,'devices:view')) {
      return reply.code(403).send({ error: 'Device view access required' });
    }
    // Unified: device groups are org-level (DeviceGroup) — the same groups the
    // member-access picker grants and the admin Device groups tab manages.
    const orgId = (user as any).organizationId || decoded.orgId;
    if (!orgId) return reply.send({ groups: [] });

    // Full-access users (owner/super-admin, or granted every device) see and
    // manage all org groups. Other members only see the groups they've been
    // granted, so a member granted one group doesn't see the whole org's groups.
    const groupsRole = String((user as any).role || '').toUpperCase();
    const groupsAllowedDeviceIds: string[] = Array.isArray((user as any).allowedDeviceIds) ? (user as any).allowedDeviceIds : [];
    const groupsFullAccess = groupsRole === 'OWNER' || groupsRole === 'SUPER_ADMIN' || groupsAllowedDeviceIds.includes('__all__');

    const groups = await prisma.deviceGroup.findMany({
      where: groupsFullAccess ? { orgId } : { orgId, members: { some: { id: user.id } } },
      include: {
        devices: { select: { id: true } },
        _count: { select: { devices: true } }
      },
      orderBy: { name: 'asc' }
    });

    return reply.send({
      groups: groups.map((group: any) => ({
        id: group.id,
        name: group.name,
        color: group.color,
        deviceIds: group.devices.map((device: any) => device.id),
        deviceCount: group._count.devices,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      }))
    });
  });

  fastify.post('/user-groups', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'Unauthorized' || auth.error === 'Invalid token' ? 401 : 404).send({ error: auth.error });
    const { decoded, user } = auth;
    if (!hasDeviceCapability(user,'devices:groups:create')) {
      return reply.code(403).send({ error: 'Group creation access required' });
    }
    const orgId = (user as any).organizationId || decoded.orgId;
    if (!orgId) return reply.code(400).send({ error: 'You must belong to an organization to create groups' });
    const name = String((request.body as any)?.name || '').trim();
    const color = (request.body as any)?.color ? String((request.body as any).color).trim() : null;

    if (!name) return reply.code(400).send({ error: 'Group name is required' });
    if (name.length > 50) return reply.code(400).send({ error: 'Group name must be 50 characters or fewer' });

    // The DB unique index is case-sensitive, so "Sales" and "sales" would both
    // be accepted and read as duplicates to a human. Reject the collision here.
    const duplicate = await prisma.deviceGroup.findFirst({
      where: { orgId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true }
    });
    if (duplicate) {
      return reply.code(409).send({ error: `A group named "${duplicate.name}" already exists` });
    }

    try {
      const group = await prisma.deviceGroup.create({
        data: { orgId, name, color }
      });
      return reply.code(201).send({ group: { id: group.id, name: group.name, color: group.color, deviceIds: [], deviceCount: 0 } });
    } catch (err: any) {
      if (err?.code === 'P2002') return reply.code(409).send({ error: 'A group with this name already exists' });
      return reply.code(400).send({ error: err.message || 'Failed to create group' });
    }
  });

  // Rename / recolor a device group (same groups the Devices page + invite picker use).
  fastify.patch('/user-groups/:groupId', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'Unauthorized' || auth.error === 'Invalid token' ? 401 : 404).send({ error: auth.error });
    const { decoded, user } = auth;
    if (!hasDeviceCapability(user,'devices:groups:create')) {
      return reply.code(403).send({ error: 'Group management access required' });
    }
    const orgId = (user as any).organizationId || decoded.orgId;
    const { groupId } = request.params as { groupId: string };
    const existing = await prisma.deviceGroup.findFirst({ where: { id: groupId, orgId }, select: { id: true } });
    if (!existing) return reply.code(404).send({ error: 'Group not found' });

    const body = (request.body || {}) as any;
    const data: any = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return reply.code(400).send({ error: 'Group name is required' });
      if (name.length > 50) return reply.code(400).send({ error: 'Group name must be 50 characters or fewer' });
      const duplicate = await prisma.deviceGroup.findFirst({
        where: { orgId, name: { equals: name, mode: 'insensitive' }, id: { not: groupId } },
        select: { name: true }
      });
      if (duplicate) {
        return reply.code(409).send({ error: `A group named "${duplicate.name}" already exists` });
      }
      data.name = name;
    }
    if (body.color !== undefined) data.color = body.color ? String(body.color).trim() : null;

    try {
      const group = await prisma.deviceGroup.update({ where: { id: groupId }, data });
      await publishAccountSync([decoded.userId], 'devices', 'user-group-updated', groupId);
      return reply.send({ group: { id: group.id, name: group.name, color: group.color } });
    } catch (err: any) {
      if (err?.code === 'P2002') return reply.code(409).send({ error: 'A group with this name already exists' });
      return reply.code(400).send({ error: err.message || 'Failed to update group' });
    }
  });

  fastify.delete('/user-groups/:groupId', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'Unauthorized' || auth.error === 'Invalid token' ? 401 : 404).send({ error: auth.error });
    const { decoded, user } = auth;
    if (!hasDeviceCapability(user,'devices:groups:delete')) {
      return reply.code(403).send({ error: 'Group deletion access required' });
    }
    const orgId = (user as any).organizationId || decoded.orgId;
    const { groupId } = request.params as { groupId: string };

    const group = await prisma.deviceGroup.findFirst({ where: { id: groupId, orgId }, select: { id: true } });
    if (!group) return reply.code(404).send({ error: 'Group not found' });

    // Deleting the group only removes the grouping relation (and any member
    // grants to it). Devices remain owned/saved and keep appearing in the list.
    await prisma.deviceGroup.delete({ where: { id: groupId } });
    await publishAccountSync([decoded.userId], 'devices', 'user-group-deleted', groupId);
    return reply.send({ success: true });
  });

  fastify.patch('/:id/user-groups', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'Unauthorized' || auth.error === 'Invalid token' ? 401 : 404).send({ error: auth.error });
    const { user } = auth;
    if (!hasDeviceCapability(user,'devices:assign')) {
      return reply.code(403).send({ error: 'Device assignment access required' });
    }
    // Device groups are available on every plan — no Pro-plan gate.
    const { id } = request.params as { id: string };
    const groupIds: string[] = Array.isArray((request.body as any)?.groupIds)
      ? Array.from(new Set((request.body as any).groupIds.map((groupId: any) => String(groupId).trim()).filter(Boolean)))
      : [];

    const allowedDevice = await userCanManageDeviceGroup(user, id);
    if ('error' in allowedDevice) return reply.code(allowedDevice.error === 'Device not found' ? 404 : 403).send({ error: allowedDevice.error });

    const orgId = (user as any).organizationId || (user as any).orgId;
    if (groupIds.length > 0) {
      const count = await prisma.deviceGroup.count({ where: { id: { in: groupIds }, orgId } });
      if (count !== groupIds.length) return reply.code(400).send({ error: 'One or more groups do not belong to this organization' });
    }

    const currentGroups = await prisma.deviceGroup.findMany({
      where: { orgId, devices: { some: { id } } },
      select: { id: true }
    });
    const nextGroupIdSet = new Set(groupIds);
    const disconnectGroupIds = currentGroups
      .map((group: any) => group.id)
      .filter((groupId: string) => !nextGroupIdSet.has(groupId));

    await prisma.device.update({
      where: { id },
      data: {
        groups: {
          disconnect: disconnectGroupIds.map((groupId) => ({ id: groupId })),
          connect: groupIds.map((groupId) => ({ id: groupId }))
        }
      }
    });

    await publishAccountSync([user.id], 'devices', 'user-groups-updated', id);
    return reply.send({ success: true, groupIds });
  });

  // 3. Rename Device
  fastify.patch('/:id/name', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });
    const actor = await loadDeviceActor(decoded.userId);
    if (!hasDeviceCapability(actor, 'devices:configure')) {
      return reply.code(403).send({ error: 'Device configuration access required' });
    }

    const { id } = request.params as { id: string };
    const { device_name } = request.body as any;

    if (!device_name) return reply.code(400).send({ error: 'device_name is required' });

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        savedByUsers: { select: { userId: true } },
        trustedByViewers: { select: { viewerUserId: true } },
        groups: { select: { id: true } }
      }
    });
    if (!device) return reply.code(404).send({ error: 'Not found' });

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { allowedGroups: true }
    });
    if (!user) return reply.code(401).send({ error: 'User not found' });

    const canRename = device.savedByUsers.some((link: any) => link.userId === decoded.userId)
      || device.trustedByViewers.some((link: any) => link.viewerUserId === decoded.userId)
      || device.groups.length > 0
      || hasDevicePermission(user, device)
      || await canAccessDevice(user, device, false);
    if (!canRename) return reply.code(403).send({ error: 'You do not have access to rename this device' });

    const cleanName = String(device_name).trim();
    if (!cleanName) return reply.code(400).send({ error: 'device_name is required' });

    const duplicateName = await findDuplicateDeviceName(device, cleanName);
    if (duplicateName) {
      return reply.code(409).send({ error: `Another device is already named "${duplicateName.name}"` });
    }

    const updated = await prisma.device.update({
      where: { id },
      data: { name: cleanName }
    });
    await publishAccountSync([
      decoded.userId,
      device.ownerId,
      ...device.savedByUsers.map((link: any) => link.userId),
      ...device.trustedByViewers.map((link: any) => link.viewerUserId),
    ], 'devices', 'renamed', id);
    return reply.send({ success: true, device: updated });
  });

  // 4. Delete Device (Remove from account)
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'Unauthorized' || auth.error === 'Invalid token' ? 401 : 404).send({ error: auth.error });
    const { decoded, user } = auth;

    const { id } = request.params as { id: string };
    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        savedByUsers: { where: { userId: decoded.userId }, select: { userId: true } },
        trustedByViewers: { where: { viewerUserId: decoded.userId }, select: { viewerUserId: true } },
        groups: { select: { id: true } }
      }
    });
    if (!device) return reply.code(404).send({ error: 'Not found' });

    if (device.ownerId === decoded.userId) {
      if (!hasDeviceCapability(user,'devices:remove')) {
        return reply.code(403).send({ error: 'Device removal access required' });
      }
      // Removing a device from the account UNLINKS it — it must NOT destroy the
      // machine's identity. The device keeps its permanent ID and its current
      // password, stays reachable while its host app runs, and can be re-added
      // immediately with that same ID + password. Destroying the row here left
      // a live host pointing at a dead ID ("We couldn't find a device with
      // that ID") until its app happened to restart and re-register.
      await prisma.savedDevice.deleteMany({ where: { deviceId: id } });
      await prisma.trustedDevice.deleteMany({ where: { hostDeviceId: id } });
      await prisma.device.update({
        where: { id },
        data: {
          ownerId: null,
          organizationId: null,
          departmentId: null,
          groups: { set: [] }
        }
      });
      // device.organizationId still holds the pre-unlink org here, so every
      // teammate who could see this device gets a live update to drop it.
      const deletedOrgMemberIds = await getOrgMemberUserIds(device.organizationId);
      await publishAccountSync([decoded.userId, ...deletedOrgMemberIds], 'devices', 'deleted', id);
      return reply.send({ success: true });
    } else {
      if (!hasDeviceCapability(user,'devices:view')) {
        return reply.code(403).send({ error: 'Device view access required' });
      }
      const canUnlink = device.savedByUsers.length > 0
        || device.trustedByViewers.length > 0
        || device.groups.length > 0
        || hasDevicePermission(user, device)
        || await canAccessDevice(user, device, false);
      if (!canUnlink) return reply.code(403).send({ error: 'Not authorized for this device' });

      // Unlink this user's personal relationships to the device. Org device
      // groups are shared, so unlinking a saved device leaves them untouched.
      await prisma.savedDevice.deleteMany({ where: { userId: decoded.userId, deviceId: id } });
      await prisma.trustedDevice.deleteMany({ where: { viewerUserId: decoded.userId, hostDeviceId: id } });
      const unlinkedOrgMemberIds = await getOrgMemberUserIds(device.organizationId);
      await publishAccountSync([decoded.userId, ...unlinkedOrgMemberIds], 'devices', 'unlinked', id);
      return reply.send({ success: true });
    }
  });


  // 6. Trust Device
  fastify.post('/:id/trust', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });
    const actor = await loadDeviceActor(decoded.userId);
    if (!hasDeviceCapability(actor, 'devices:view')) {
      return reply.code(403).send({ error: 'Device view access required' });
    }

    const { id } = request.params as { id: string };

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    const existing = await prisma.trustedDevice.findUnique({
      where: { viewerUserId_hostDeviceId: { viewerUserId: decoded.userId, hostDeviceId: id } }
    });

    if (!existing) {
      await prisma.trustedDevice.create({
        data: { viewerUserId: decoded.userId, hostDeviceId: id }
      });
    }

    return reply.send({ success: true });
  });

  // 7. Revoke Trust
  fastify.delete('/:id/trust', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });
    const actor = await loadDeviceActor(decoded.userId);
    if (!hasDeviceCapability(actor, 'devices:view')) {
      return reply.code(403).send({ error: 'Device view access required' });
    }

    const { id } = request.params as { id: string };

    await prisma.trustedDevice.deleteMany({
      where: { viewerUserId: decoded.userId, hostDeviceId: id }
    });

    return reply.send({ success: true });
  });

  // Regenerate Access Key
  fastify.post('/regenerate-key', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });
    const actor = await loadDeviceActor(decoded.userId);
    if (!hasDeviceCapability(actor, 'devices:configure')) {
      return reply.code(403).send({ error: 'Device configuration access required' });
    }

    const { deviceId } = request.body as any;
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.ownerId !== decoded.userId) {
      return reply.code(403).send({ error: 'Not authorized for this device' });
    }

    let accessKey = generateAccessKey();
    while (await prisma.device.findUnique({ where: { accessKey } })) {
      accessKey = generateAccessKey();
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: { accessKey }
    });

    await publishAccountSync([decoded.userId], 'devices', 'key-regenerated', deviceId);
    return reply.send({ access_key: updated.accessKey });
  });

  // Set/Update machine password
  fastify.post('/set-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });
    const actor = await loadDeviceActor(decoded.userId);
    if (!hasDeviceCapability(actor, 'devices:configure')) {
      return reply.code(403).send({ error: 'Device configuration access required' });
    }
    const { deviceId, password, passwordRequired } = request.body as any;

    if (!deviceId || (!password && typeof passwordRequired !== 'boolean')) {
      return reply.code(400).send({ error: 'DeviceID and password or passwordRequired setting required' });
    }

    const [device, user] = await Promise.all([
      prisma.device.findUnique({ where: { id: deviceId } }),
      prisma.user.findUnique({ where: { id: decoded.userId } })
    ]);
    if (!device || !user || !canManageDeviceMetadata(user, device)) {
      return reply.code(403).send({ error: 'Not authorized for this device' });
    }

    const updateData: any = {};
    let passwordChanged = false;
    if (password) {
      passwordChanged = device.accessPasswordHash
        ? !(await bcrypt.compare(String(password), device.accessPasswordHash))
        : true;
      const salt = await bcrypt.genSalt(12);
      updateData.accessPasswordHash = await bcrypt.hash(password, salt);
    }
    const requiredChanged = typeof passwordRequired === 'boolean' && device.passwordRequired !== passwordRequired;
    if (typeof passwordRequired === 'boolean') {
      updateData.passwordRequired = passwordRequired;
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: updateData
    });

    const viewerIds = await getDeviceViewerUserIds(deviceId);
    if (passwordChanged) {
      await prisma.trustedDevice.deleteMany({ where: { hostDeviceId: deviceId } });
    }
    // Only a real change is worth a broadcast: the host app re-sends its
    // current flag on every hosting start, and each echo used to pop an
    // "Access Password Updated Remotely" toast on that same machine.
    if (passwordChanged || requiredChanged) {
      await publishAccountSync([device.ownerId, ...viewerIds], 'devices', 'password-updated', deviceId);

      // Push the new secret straight to the live host so its own screen reflects the
      // change in real time. The host stores only a plaintext copy for display; it can't
      // derive it from the bcrypt hash, so the plaintext travels once over the internal
      // Redis bus and the signaling service relays it to that single host connection.
      try {
        await redisPublisher.publish('host:command', JSON.stringify({
          command: 'password-updated',
          accessKey: device.accessKey,
          password: passwordChanged ? password : undefined,
          passwordRequired: requiredChanged ? passwordRequired : undefined,
        }));
      } catch (err) {
        console.warn('[Devices] Failed to publish host password command:', err);
      }
    }

    return reply.send({ success: true });
  });

  // 8. Update Device Tags (Grouping)
  fastify.patch('/:id/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });
    const actor = await loadDeviceActor(decoded.userId);
    if (!hasDeviceCapability(actor, 'devices:configure')) {
      return reply.code(403).send({ error: 'Device configuration access required' });
    }

    const { id } = request.params as { id: string };
    const { tags } = request.body as { tags: string[] };

    if (!Array.isArray(tags)) return reply.code(400).send({ error: 'tags must be an array of strings' });

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    // Only owner or admin can update tags
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.code(401).send({ error: 'User not found' });

    if (!canManageDeviceMetadata(user, device)) {
      return reply.code(403).send({ error: 'Not authorized to manage tags for this device' });
    }

    const updated = await prisma.device.update({
      where: { id },
      data: { tags }
    });

    await publishAccountSync([device.ownerId], 'devices', 'tags-updated', id);
    return reply.send({ success: true, tags: updated.tags });
  });

  // Status Check (Unauthenticated Viewer Step 1)
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    let { key } = request.query as any;
    if (!key) return reply.code(400).send({ error: 'Access Key required' });
    key = String(key).replace(/\s/g, ''); // Strip spaces

    const ip = request.ip || 'unknown';
    const rlKey = `rl:status:${ip}`;
    const reqs = await redisPublisher.incr(rlKey);
    if (reqs === 1) await redisPublisher.expire(rlKey, 60);
    if (reqs > 10) return reply.code(429).send({ error: 'Too many requests' });

    const device = await prisma.device.findUnique({ where: { accessKey: key } });
    if (!device) return reply.code(404).send({ exists: false, error: 'Device not found' });

    const presence = await redisPublisher.get(`presence:${key}`);
    const online = presence === 'online';

    return reply.send({ exists: true, online, password_required: device.passwordRequired !== false });
  });

  // POST /connect/lookup (Guest Viewer Step 1)
  fastify.post('/connect/lookup', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accessKey } = request.body as any;
    if (!accessKey) return reply.code(400).send({ error: 'Access Key required' });
    const key = String(accessKey).replace(/\s/g, '');

    const device = await prisma.device.findUnique({ where: { accessKey: key }, select: { id: true, name: true, accessKey: true, passwordRequired: true, ownerId: true, deviceType: true } });
    if (!device) return reply.code(404).send({ exists: false, error: 'No machine found with that access key' });

    const presence = await redisPublisher.get(`presence:${key}`);
    const online = presence === 'online';
    if (!online) return reply.code(409).send({ exists: true, online: false, error: 'That machine is offline. Ask the owner to open Remote 365 and check their connection.' });

    let isTrusted = false;
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const decoded = verifyToken(authHeader.replace('Bearer ', ''));
      if (decoded?.userId) {
        // Trust rows only — owners get no automatic bypass, so a password
        // rotation (which clears trust) re-prompts them like everyone else.
        const trustCheck = await prisma.trustedDevice.findUnique({
          where: { viewerUserId_hostDeviceId: { viewerUserId: decoded.userId, hostDeviceId: device.id } }
        });
        isTrusted = Boolean(trustCheck);
      }
    }

    return reply.send({
      exists: true,
      online: true,
      name: device.name,
      device_type: String(device.deviceType || '').toLowerCase(),
      password_required: !isTrusted && device.passwordRequired !== false,
      trusted: isTrusted
    });
  });

  // POST /host-credential — provision this machine's unattended host credential.
  //
  // A Windows host normally registers with the signed-in user's access token,
  // which is stored per Windows profile (DPAPI). That makes the device
  // unreachable whenever nobody is signed in — i.e. every reboot that stops at
  // the sign-in screen. This mints a machine-scoped secret the host keeps
  // outside any user profile, so the pre-logon instance (launched by
  // Remote365InputSvc as SYSTEM) can register on its own.
  //
  // Authenticated + ownership-checked: only someone who can already configure
  // the device may hand it a standing credential. Re-issuing rotates it, which
  // instantly invalidates the previous secret.
  fastify.post('/host-credential', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded?.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { accessKey: rawKey, fingerprint } = request.body as any;
    const accessKey = String(rawKey || '').replace(/\s/g, '');
    if (!accessKey) return reply.code(400).send({ error: 'accessKey required' });

    const device = await prisma.device.findUnique({
      where: { accessKey },
      select: { id: true, ownerId: true, organizationId: true, machineFingerprint: true }
    });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    // The requester must be able to configure this device: its owner, or an
    // org member holding devices:configure. An unowned (bootstrap) device is
    // claimable by the machine itself, but only when it proves the hardware
    // fingerprint on the row — otherwise anyone could mint a credential for a
    // device ID they merely know.
    const actor = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, organizationId: true, permissionOverrides: true }
    });
    let allowed = device.ownerId === decoded.userId;
    if (!allowed && device.ownerId) {
      allowed = actor?.organizationId === device.organizationId
        && hasDeviceCapability(actor, 'devices:configure');
    }
    if (!allowed && !device.ownerId) {
      const machineFingerprint = String(fingerprint || '').toLowerCase();
      allowed = Boolean(machineFingerprint) && machineFingerprint === device.machineFingerprint;
    }
    if (!allowed) return reply.code(403).send({ error: 'Not authorized to configure this device' });

    // 32 random bytes, base64url — matches HOST_SECRET_PATTERN (43 chars).
    const secret = randomBytes(32).toString('base64url');
    await prisma.device.update({
      where: { id: device.id },
      data: { hostSecretHash: hashHostSecret(secret) } as any
    });
    console.log(`[Device-Debug] Issued unattended host credential for ${accessKey}`);
    return reply.send({ host_secret: secret });
  });

  // POST /self-register — unauthenticated host bootstrap
  // Registers this machine in the DB so viewers can look it up.
  // Idempotent: safe to call on every app start.
  fastify.post('/self-register', async (request: FastifyRequest, reply: FastifyReply) => {
    let { accessKey, name, password, passwordRequired, deviceType, fingerprint, hostSecret: rawHostSecret } = request.body as any;
    accessKey = accessKey ? String(accessKey).replace(/\s/g, '') : '';
    // Hardware-derived hash (hex) the desktop app computes locally. It is the
    // durable machine identity: even when the app lost its cached access key
    // (reinstall, wiped localStorage), the fingerprint finds the same Device
    // row again instead of minting a brand-new ID on every launch.
    const machineFingerprint = /^[a-f0-9]{16,128}$/i.test(String(fingerprint || ''))
      ? String(fingerprint).toLowerCase()
      : '';
    const rawMachineName = String(name || '').trim();
    const machineName = (rawMachineName && rawMachineName !== 'Unknown Machine' ? rawMachineName : 'Remote 365 Device').slice(0, 64);
    const normalizedDeviceType = String(deviceType || '').toUpperCase();
    const validDeviceType = ['WINDOWS', 'MACOS', 'LINUX', 'IOS', 'ANDROID'].includes(normalizedDeviceType)
      ? normalizedDeviceType
      : 'WINDOWS';
    const hostSecret = normalizeHostSecret(rawHostSecret);
    // Self-register is a bootstrap path: it makes a device connectable by ID,
    // but it does not add the device to any user's managed list. Users must
    // explicitly add/claim it through /add-existing.

    let existing = accessKey
      ? await prisma.device.findUnique({ where: { accessKey } })
      : null;
    if (!existing && machineFingerprint) {
      existing = await prisma.device.findUnique({ where: { machineFingerprint } });
      if (existing) {
        console.log(`[Device-Debug] self-register: recovered identity ${existing.accessKey} via machine fingerprint.`);
      }
    }

    if (existing) {
      const existingRecord = existing as any;
      if (validDeviceType === 'ANDROID') {
        if (existingRecord.hostSecretHash) {
          if (!hostSecretMatches(hostSecret, existingRecord.hostSecretHash)) {
            return reply.code(403).send({ error: 'Invalid host credential' });
          }
        } else {
          // One-time migration for Android hosts created before host credentials
          // existed. The non-public hardware fingerprint must still match the row.
          if (!hostSecret || !machineFingerprint || machineFingerprint !== existing.machineFingerprint) {
            return reply.code(403).send({ error: 'Host credential enrollment requires this device fingerprint' });
          }
        }
      }
      // Keep the fingerprint pinned to this machine's current row. A physical
      // machine has exactly one live identity, so strip the fingerprint from
      // any other row it may have been left on (e.g. an older registration).
      if (machineFingerprint && existing.machineFingerprint !== machineFingerprint) {
        await prisma.device.updateMany({
          where: { machineFingerprint, id: { not: existing.id } },
          data: { machineFingerprint: null }
        });
        await prisma.device.update({ where: { id: existing.id }, data: { machineFingerprint } });
      }
      const updateData: any = {};
      if (validDeviceType === 'ANDROID' && !existingRecord.hostSecretHash) {
        updateData.hostSecretHash = hashHostSecret(hostSecret);
      }
      let autoPassword: string | undefined;
      // Only adopt the OS machine name while the device still has a placeholder name.
      // Previously this used isBootstrapOnlyDevice(), which is true for ANY unowned
      // device — so a user-set name (e.g. "laptop") was clobbered back to the machine
      // name on every app start / auto-update. Gate on the existing name instead so a
      // real, user-chosen name is never overwritten.
      if (
        machineName &&
        machineName !== 'Remote 365 Device' &&
        machineName !== existing.name &&
        isDefaultDeviceName(existing.name)
      ) {
        updateData.name = machineName;
      }
      if (validDeviceType !== existing.deviceType) updateData.deviceType = validDeviceType;
      if (typeof passwordRequired === 'boolean') {
        updateData.passwordRequired = passwordRequired;
      }
      let passwordChanged = false;
      if (password) {
        // Only treat it as a real change when the new password differs from the
        // current one — the host resends its cached password on every boot.
        const sameAsCurrent = existing.accessPasswordHash
          ? await bcrypt.compare(String(password), existing.accessPasswordHash)
          : false;
        if (!sameAsCurrent) passwordChanged = true;
        updateData.accessPasswordHash = await bcrypt.hash(String(password), 10);
      } else if (!existing.accessPasswordHash && existing.passwordRequired !== false) {
        autoPassword = generateAccessPassword();
        updateData.accessPasswordHash = await bcrypt.hash(autoPassword, 10);
      }
      // NOTE deliberately NO other password branch: the stored password is
      // permanent until the user explicitly changes it. Restarts, reinstalls
      // and identity recovery must never mint or alter credentials — a host
      // that lost its local copy keeps hosting against the stored hash and
      // the owner can set a new password from the app whenever they choose.
      const updated = Object.keys(updateData).length > 0
        ? await prisma.device.update({ where: { id: existing.id }, data: updateData })
        : existing;
      // When the host changes its access password, previously-trusted viewers must
      // re-authenticate with the new password. Without this, the trust record would
      // silently bypass the password change and the viewer would never be re-prompted.
      const viewerIds = passwordChanged ? await getDeviceViewerUserIds(updated.id) : [];
      if (passwordChanged) {
        await prisma.trustedDevice.deleteMany({ where: { hostDeviceId: updated.id } });
      }
      await publishAccountSync([updated.ownerId, ...viewerIds], 'devices', 'updated', updated.id);
      return reply.send({
        id: updated.id,
        access_key: updated.accessKey,
        name: updated.name,
        has_password: !!updated.accessPasswordHash,
        password_required: updated.passwordRequired !== false,
        auto_password: !password ? autoPassword : undefined,
      });
    }

    // Create path: no record matched the cached key or the fingerprint.
    // Fingerprinted machines get a DETERMINISTIC key derived from their
    // hardware identity, so even here — removed device, reset database —
    // the machine comes back with the exact ID it always had. Only clients
    // that can't provide a fingerprint (web/mobile/legacy) get random IDs.
    const clientSentStaleKey = Boolean(accessKey);
    accessKey = machineFingerprint
      ? await deriveStableAccessKey(machineFingerprint)
      : await generateUniqueAccessKey();

    // Fresh identity ⇒ fresh credentials: a password cached alongside a stale
    // key is discarded with it (the app adopts the returned auto_password).
    // Only a true first-time registration (no cached key) may bring its own.
    const requiresPassword = typeof passwordRequired === 'boolean' ? passwordRequired : true;
    const clientPassword = !clientSentStaleKey && password ? String(password) : '';
    const autoPassword = clientPassword || (requiresPassword ? generateAccessPassword() : '');
    const passwordHash = autoPassword ? await bcrypt.hash(autoPassword, 10) : null;
    if (validDeviceType === 'ANDROID' && !hostSecret) {
      return reply.code(400).send({ error: 'A secure host credential is required for Android registration' });
    }

    let device;
    try {
      device = await prisma.device.create({
        data: {
          accessKey,
          machineFingerprint: machineFingerprint || undefined,
          name: machineName,
          deviceType: validDeviceType as any,
          accessPasswordHash: passwordHash,
          passwordRequired: requiresPassword,
          hostSecretHash: validDeviceType === 'ANDROID' ? hashHostSecret(hostSecret) : undefined,
        },
      });
    } catch (err: any) {
      // Unique-fingerprint race: a concurrent self-register from the same
      // machine created the row first — adopt it instead of failing the boot.
      if (err?.code === 'P2002' && machineFingerprint) {
        const raced = await prisma.device.findUnique({ where: { machineFingerprint } });
        if (raced) {
          return reply.send({
            id: raced.id,
            access_key: raced.accessKey,
            name: raced.name,
            has_password: !!raced.accessPasswordHash,
            password_required: raced.passwordRequired !== false,
          });
        }
      }
      throw err;
    }

    await publishAccountSync([device.ownerId], 'devices', 'created', device.id);
    return reply.code(201).send({
      id: device.id,
      access_key: device.accessKey,
      name: device.name,
      has_password: !!device.accessPasswordHash,
      password_required: device.passwordRequired !== false,
      // Returned whenever the server minted the password (first registration,
      // or a fresh identity that discarded the stale cached one) so the app
      // can persist and display it.
      auto_password: !clientPassword && autoPassword ? autoPassword : undefined,
    });
  });

  // POST /api/devices/:id/archive — hide a device from THIS user's lists without
  // deleting it. Deliberately not part of /settings: that endpoint needs
  // devices:configure and device ownership, while archiving is a personal view
  // preference any user who can see the device may set for themselves.
  fastify.post('/:id/archive', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'User not found' ? 404 : 401).send({ error: auth.error });
    const { id } = request.params as { id: string };
    const archived = (request.body as any)?.archived !== false;

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    // Anyone who can see the device may archive it for themselves; seeing it is
    // already gated by devices:view on the listing endpoints.
    if (!hasDeviceCapability(auth.user, 'devices:view')) {
      return reply.code(403).send({ error: 'Device view access required' });
    }

    const settings: any = { ...((device as any).settings || {}) };
    console.log(`[Archive] device=${(request.params as any).id} archived=${(request.body as any)?.archived !== false} by=${auth.decoded.userId} ua=${String(request.headers["user-agent"] || "").slice(0, 90)}`);
    const current: string[] = Array.isArray(settings.archivedBy) ? settings.archivedBy.filter((x: any) => typeof x === 'string') : [];
    const userId = auth.decoded.userId;
    // Restore clears the whole list (device-wide semantics): whoever restores
    // it wants it back for everyone, not merely for their own login.
    settings.archivedBy = archived
      ? Array.from(new Set([...current, userId]))
      : [];

    await prisma.device.update({ where: { id }, data: { settings } });
    // Both clients refresh from one event, so archiving on desktop shows up on
    // the web without a reload.
    await publishAccountSync([userId], 'devices', 'updated', id).catch(() => { /* best effort */ });
    return reply.send({ id, archived });
  });

  // PATCH /api/devices/:id/settings — owner-controlled access settings
  // (allowIncoming, accessSchedule). Enforced in verify-access above.
  fastify.patch('/:id/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'User not found' ? 404 : 401).send({ error: auth.error });
    if (!hasDeviceCapability(auth.user,'devices:configure')) {
      return reply.code(403).send({ error: 'Device configuration access required' });
    }

    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    if (!(await canManageDeviceAccess(auth.decoded.userId, device, body.deviceAuth))) {
      return reply.code(403).send({ error: 'You do not manage this device' });
    }

    const next: any = { ...((device as any).settings || {}) };

    if (typeof body.allowIncoming === 'boolean') next.allowIncoming = body.allowIncoming;
    // Skip the in-session "allow control" prompt without giving up the access
    // password — for machines nobody sits at. Read by verify-access when it
    // stamps the `unattended` claim.
    if (typeof body.allowControlWithoutPrompt === 'boolean') {
      next.allowControlWithoutPrompt = body.allowControlWithoutPrompt;
    }
    if (body.accessSchedule !== undefined) {
      const s = body.accessSchedule;
      if (!s) {
        delete next.accessSchedule;
      } else {
        const validTime = (v: any, fallback: string) => (/^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v) : fallback);
        next.accessSchedule = {
          enabled: s.enabled === true,
          days: Array.isArray(s.days) ? s.days.map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
          start: validTime(s.start, '09:00'),
          end: validTime(s.end, '18:00'),
          timezone: typeof s.timezone === 'string' && s.timezone.length > 0 && s.timezone.length < 64 ? s.timezone : 'UTC',
        };
      }
    }

    // Remote-control session settings (enforced by the host app, persisted here
    // so they follow the device / are visible to admins).
    if (['view', 'ask', 'allow'].includes(body.controlMode)) next.controlMode = body.controlMode;
    if (body.panicHotkey !== undefined) {
      next.panicHotkey = typeof body.panicHotkey === 'string' ? body.panicHotkey.slice(0, 64) : '';
    }
    if (typeof body.panicKillIncoming === 'boolean') next.panicKillIncoming = body.panicKillIncoming;
    if (body.idleDisconnectMinutes !== undefined) {
      const m = Number(body.idleDisconnectMinutes);
      next.idleDisconnectMinutes = Number.isFinite(m) ? Math.min(1440, Math.max(0, Math.round(m))) : 0;
    }
    if (body.receivedFilesDir !== undefined) {
      next.receivedFilesDir = typeof body.receivedFilesDir === 'string' ? body.receivedFilesDir.slice(0, 512) : '';
    }
    // Wake-on-LAN: opt-in flag + this machine's MAC (so a same-LAN device can wake it).
    if (typeof body.wolEnabled === 'boolean') next.wolEnabled = body.wolEnabled;
    if (body.wolMac !== undefined) {
      next.wolMac = typeof body.wolMac === 'string' ? body.wolMac.slice(0, 32) : '';
    }

    const updated = await prisma.device.update({ where: { id }, data: { settings: next } as any });
    return { success: true, settings: (updated as any).settings || {} };
  });

  // POST /api/devices/:id/access-codes — mint a single-use, time-boxed code
  // that substitutes for the device password (shown in full exactly once).
  fastify.post('/:id/access-codes', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'User not found' ? 404 : 401).send({ error: auth.error });
    if (!hasDeviceCapability(auth.user,'devices:configure')) {
      return reply.code(403).send({ error: 'Device configuration access required' });
    }

    const { id } = request.params as { id: string };
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    if (!(await canManageDeviceAccess(auth.decoded.userId, device, (request.body as any)?.deviceAuth))) {
      return reply.code(403).send({ error: 'You do not manage this device' });
    }

    const ttlMinutes = Math.min(7 * 24 * 60, Math.max(5, Number((request.body as any)?.ttlMinutes) || 60));
    const code = generateOneTimeCode();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // Opportunistic cleanup so dead codes don't pile up.
    await (prisma as any).deviceAccessCode.deleteMany({
      where: { deviceId: id, OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] }
    });

    const row = await (prisma as any).deviceAccessCode.create({
      data: {
        deviceId: id,
        codeHash: hashAccessCode(code),
        hint: `${code[0]}••••${code[code.length - 1]}`,
        createdById: auth.decoded.userId,
        expiresAt,
      }
    });

    return reply.code(201).send({
      id: row.id,
      code: `${code.slice(0, 3)}-${code.slice(3)}`,
      hint: row.hint,
      expiresAt,
    });
  });

  // POST /api/devices/:id/access-codes/list — active (unused, unexpired)
  // codes. POST so deviceAuth can travel in the body.
  fastify.post('/:id/access-codes/list', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'User not found' ? 404 : 401).send({ error: auth.error });

    const { id } = request.params as { id: string };
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    if (!(await canManageDeviceAccess(auth.decoded.userId, device, (request.body as any)?.deviceAuth))) {
      return reply.code(403).send({ error: 'You do not manage this device' });
    }

    const codes = await (prisma as any).deviceAccessCode.findMany({
      where: { deviceId: id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, hint: true, createdAt: true, expiresAt: true }
    });
    return { codes };
  });

  // DELETE /api/devices/:id/access-codes/:codeId — revoke before expiry.
  fastify.delete('/:id/access-codes/:codeId', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await getAuthenticatedDeviceUser(request.headers.authorization);
    if ('error' in auth) return reply.code(auth.error === 'User not found' ? 404 : 401).send({ error: auth.error });

    const { id, codeId } = request.params as { id: string; codeId: string };
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    if (!(await canManageDeviceAccess(auth.decoded.userId, device, (request.body as any)?.deviceAuth))) {
      return reply.code(403).send({ error: 'You do not manage this device' });
    }

    await (prisma as any).deviceAccessCode.deleteMany({ where: { id: codeId, deviceId: id } });
    return { success: true };
  });

}
