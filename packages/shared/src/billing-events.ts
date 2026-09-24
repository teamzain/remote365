import { prisma } from './db';
import { redisPublisher } from './redis';

/**
 * Broadcast a subscription/plan change so signed-in apps refresh their plan
 * state live (no restart needed). Members inherit the org owner's
 * subscription, so every member of the subscription holder's organization is
 * targeted. The signaling service relays this to connected clients as an
 * `account-sync` message with scope `billing`.
 */
export async function publishBillingSync(userId: string | null | undefined) {
  if (!userId) return;
  try {
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true }
    });

    let targetUserIds = [userId];
    if (user?.organizationId) {
      const members = await (prisma as any).user.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true }
      });
      targetUserIds = members.map((member: any) => member.id);
    }

    await redisPublisher.publish('account:sync', JSON.stringify({
      type: 'account-sync',
      scope: 'billing',
      action: 'updated',
      entityId: userId,
      targetUserIds,
      changedAt: new Date().toISOString()
    }));
  } catch (err) {
    // Best-effort: a failed broadcast must never fail the billing mutation.
    console.error('[Billing] Failed to publish billing sync:', err);
  }
}
