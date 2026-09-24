import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// One connection for publishing, one for subscribing (Redis requires separate connections for pub/sub)
export const redisPublisher = new Redis(redisUrl);
export const redisSubscriber = new Redis(redisUrl);

export enum EventChannel {
  SESSION_STARTED = 'session:started',
  SESSION_ENDED = 'session:ended',
  USER_CREATED = 'user:created',
  DEVICE_REGISTERED = 'device:registered',
  ORG_UPDATES = 'org:updates',
  SUPPORT_SESSION_UPDATES = 'support-session:updates',
}

export interface PublishEvent {
  channel: EventChannel;
  payload: Record<string, any>;
}

export const publishEvent = async (event: PublishEvent) => {
  await redisPublisher.publish(event.channel, JSON.stringify(event.payload));
};

export const subscribeToEvent = (
  channel: EventChannel,
  callback: (payload: any) => void
) => {
  redisSubscriber.subscribe(channel, (err: Error | null | undefined) => {
    if (err) console.error(`[Redis] Failed to subscribe to ${channel}`, err);
  });

  redisSubscriber.on('message', (chan: string, message: string) => {
    if (chan === channel) {
      try {
        const payload = JSON.parse(message);
        callback(payload);
      } catch (e) {
        console.error(`[Redis] Failed to parse message from ${channel}`, e);
      }
    }
  });
};

export const blacklistToken = async (token: string, ttl: number) => {
  await redisPublisher.set(`blacklist:${token}`, '1', 'EX', ttl);
};

export const isTokenBlacklisted = async (token: string) => {
  const result = await redisPublisher.get(`blacklist:${token}`);
  return result === '1';
};
