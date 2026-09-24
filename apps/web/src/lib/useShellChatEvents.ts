import { useEffect } from 'react';
import api from './api';
import { notify } from '../components/NotificationProvider';
import { openSessionHere } from './sessionLauncher';
import { useChatStore } from '../store/chatStore';
import { useNotificationStore } from '../store/notificationStore';

/**
 * Chat and session events (contact requests, session/meeting invites, a
 * collaborator joining a session we created) feed the notification centre and
 * the creator auto-connect. Shared by the desktop and phone shells so both
 * behave the same; the chat store exposes single-slot callbacks nobody else
 * uses on the web.
 */
export function useShellChatEvents(userId: string | undefined) {
  useEffect(() => {
    const add = useNotificationStore.getState().addNotification;
    useChatStore.setState({
      onInvite: (conversation: any) => {
        const from = conversation?.participants?.find((p: any) => p.userId !== userId)?.user?.name || 'Someone';
        add(`${from} wants to add you as a contact.`, 'session', 'New contact request', { view: 'chat', chatId: conversation?.id });
      },
      onSessionInvite: (invite: any) => {
        const from = invite?.senderName || invite?.fromName || 'Someone';
        if (String(invite?.type || '').toUpperCase() === 'SESSION_JOINED') {
          // Someone joined a session we created: their PC is hosting and we hold
          // an access grant. Close the waiting room and open the viewer to their
          // machine (the desktop app does the same; the web never did).
          const joinerName = invite?.joinerName || from;
          window.dispatchEvent(new CustomEvent('remote365:session-joined', { detail: { sessionId: invite?.sessionId } }));
          add(`${joinerName} joined "${invite?.sessionName || 'your session'}". Connecting to their computer now.`, 'accepted', 'Session joined', { view: 'connect' });
          notify(`${joinerName} joined. Connecting to their computer…`, 'success');
          (async () => {
            try {
              if (!invite?.grantId || !invite?.joinerDeviceKey) return;
              await new Promise((resolve) => setTimeout(resolve, 1200));
              const { data } = await api.post(`/api/chat/remote-access-grants/${invite.grantId}/token`);
              openSessionHere(String(invite.joinerDeviceKey), {
                accessToken: data.token,
                accessKey: String(invite.joinerDeviceKey),
                deviceName: invite?.joinerDeviceName || joinerName,
                deviceType: 'desktop',
              });
            } catch (err: any) {
              notify(err?.response?.data?.error || "Couldn't connect to their computer automatically. Open the session and try again.", 'error');
            }
          })();
          return;
        }
        if (String(invite?.type || '').toUpperCase() === 'VIDEO_MEETING') {
          add(`${from} is inviting you to a video meeting. Open to join.`, 'session', 'Meeting invitation', { view: 'meetings', meetingId: invite?.sessionCode });
        } else {
          add(`${from} is inviting you to ${invite?.sessionName || 'a remote session'}. Open to join.`, 'session', 'Session invitation', { view: 'connect', sessionCode: invite?.sessionCode });
        }
      },
      onConversationEvent: (event: any) => {
        if (event?.type === 'chat-conversation-removed') add('This conversation is no longer available.', 'blocked', 'Conversation closed', { view: 'chat' });
      },
    });
    return () => { useChatStore.setState({ onInvite: undefined, onSessionInvite: undefined, onConversationEvent: undefined }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
