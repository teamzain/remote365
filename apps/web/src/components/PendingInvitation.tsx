import React from 'react';
import pendingIllustration from '../assets/pending.jpeg';

interface PendingInvitationProps {
  /** Name of the other person in the conversation. */
  name: string;
  /** True when the current user is the one who sent the request (waiting state). */
  isRequester: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /** Optional translator so copy follows the user's language, matching the rest of the chat. */
  tx?: (text: string) => string;
}

export const PendingInvitation: React.FC<PendingInvitationProps> = ({
  name,
  isRequester,
  onAccept,
  onDecline,
  tx = (text) => text,
}) => {
  const title = isRequester ? tx('Invitation Sent') : tx('Pending Invitation');
  const description = isRequester
    ? `${tx('Waiting for')} ${name} ${tx("to accept your chat request. You can't send messages until they accept.")}`
    : `${name} ${tx('wants to chat with you. Accept the invitation to start exchanging messages.')}`;

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 font-['Mona_Sans',system-ui,sans-serif]">
      <div className="flex flex-col items-center gap-[45px] w-[377px] max-w-full">
        <img
          src={pendingIllustration}
          alt=""
          className="w-[251px] h-[214px] object-contain select-none pointer-events-none"
          draggable={false}
        />
        <div className="flex flex-col items-center gap-3.5 w-full">
          <h3 className="text-[24px] font-medium leading-[34px] text-center text-black dark:text-[#F5F5F5]">
            {title}
          </h3>
          <p className="text-[14px] font-medium leading-5 text-center text-black dark:text-[#A0A0A0] w-full">
            {description}
          </p>

          {!isRequester && (
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={onAccept}
                className="flex-1 h-10 rounded-[4px] bg-gradient-to-r from-[#FF8A00] to-[#FFB347] text-[#111315] text-[14px] font-medium leading-5 transition-all hover:brightness-105 active:scale-[0.98] shadow-sm shadow-[#FF8A00]/20"
              >
                {tx('Accept')}
              </button>
              <button
                onClick={onDecline}
                className="flex-1 h-10 rounded-[4px] bg-white dark:bg-transparent border border-[rgba(26,29,33,0.3)] dark:border-white/15 text-[#111315] dark:text-[#F5F5F5] text-[14px] font-medium leading-5 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
              >
                {tx('Decline')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
