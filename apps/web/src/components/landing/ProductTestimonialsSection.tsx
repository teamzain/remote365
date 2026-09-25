import React from 'react'

const ProductTestimonialsSection: React.FC = () => {
  const tweets = [
    {
      username: '@sharathpatali',
      name: 'Sharath Patali',
      content: 'Setting up remote access on all my devices was so damn easy thanks to @Remote365. A tightly sealed network of remote devices with almost no configuration and also ease of adding a new device is just what I wanted. Amazing work @Remote365!'
    },
    {
      username: '@simonw',
      name: 'Simon Willison',
      content: 'OK yeah @Remote365 is good. This morning I got it running on my iPhone and a Linux server JUST using my phone and they\'re now connected. Just got it running on my Mac too, so now it\'s a three-device setup. Completely free, took minutes.'
    },
    {
      username: '@danp128',
      name: 'Dan Peterson',
      content: 'I\'ve used other remote desktop tools for ages — and I\'m now seriously considering switching fully to @Remote365 because it does everything I want ... and has stuff I never quite got to work right elsewhere. No muss, no fuss; excellent.'
    },
    {
      username: '@plasticine',
      name: 'Justin Morris',
      content: 'Geez @Remote365 is just flat-out good technology 😍 The implications for improving developer and operator experience dramatically. The more I play with it the more impressed I am. Excellent tooling for remote support.'
    },
    {
      username: '@jashankj',
      name: 'Jashank Jeremy',
      content: 'The session code feature in @Remote365 is brilliant — I can help my parents with their computer issues without them needing an account. Just send a code, they join, and I\'m in. Game changer for family tech support.'
    }
  ]

  const TweetCard: React.FC<{ tweet: typeof tweets[0] }> = ({ tweet }) => (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '20.25px 21px 21px',
        width: 'min(400px, 82vw)',
        minWidth: 'min(400px, 82vw)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        // Dark glass over the site's video backdrop. No backdrop blur: a few
        // dozen cards scrolling over moving video is too costly on phones.
        background: 'rgba(18, 16, 16, 0.6)',
        flexShrink: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: 0,
          gap: '13px',
          width: '100%'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px',
            width: '100%'
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              flexShrink: 0
            }}
          >
            {tweet.username[1].toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Mona Sans', sans-serif",
                fontWeight: 400,
                fontSize: '15px',
                lineHeight: '22px',
                letterSpacing: '-0.15px',
                color: '#FFFFFF',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {tweet.username}
            </div>
            <div
              style={{
                fontFamily: "'Mona Sans', sans-serif",
                fontWeight: 400,
                fontSize: '13px',
                lineHeight: '20px',
                letterSpacing: '-0.16px',
                color: 'rgba(255, 255, 255, 0.4)'
              }}
            >
              {tweet.name}
            </div>
          </div>
        </div>
        <div
          style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: '22px',
            letterSpacing: '-0.48px',
            color: '#FFFFFF'
          }}
        >
          {tweet.content}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '24px',
          marginTop: '21px',
          flexWrap: 'wrap'
        }}
      >
        <span
          style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 400,
            fontSize: '13px',
            lineHeight: '20px',
            letterSpacing: '-0.16px',
            color: 'rgba(255, 255, 255, 0.54)',
            cursor: 'pointer'
          }}
        >
          Reply
        </span>
        <span
          style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 400,
            fontSize: '13px',
            lineHeight: '20px',
            letterSpacing: '-0.16px',
            color: 'rgba(255, 255, 255, 0.54)',
            cursor: 'pointer'
          }}
        >
          Share
        </span>
        <span
          style={{
            fontFamily: "'Mona Sans', sans-serif",
            fontWeight: 400,
            fontSize: '13px',
            lineHeight: '20px',
            letterSpacing: '-0.16px',
            color: 'rgba(255, 255, 255, 0.54)',
            cursor: 'pointer'
          }}
        >
          ...
        </span>
      </div>
    </div>
  )

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 0,
        width: '100%',
        minHeight: 'auto',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <style>
        {`
          @keyframes marqueeLeft {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes marqueeRight {
            0% { transform: translateX(-50%); }
            100% { transform: translateX(0); }
          }
          .marquee-row {
            display: flex;
            gap: 24px;
            width: fit-content;
            animation: marqueeLeft 40s linear infinite;
          }
          .marquee-row.reverse {
            animation: marqueeRight 40s linear infinite;
          }
          .marquee-row.blur {
            filter: blur(2px);
            opacity: 0.6;
          }
          .marquee-row:hover {
            animation-play-state: paused;
          }
        `}
      </style>

      {/* Main content — full-bleed so the marquee rows run edge to edge */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '120px 0 80px',
          isolation: 'isolate',
          width: '100%',
          gap: '24px'
        }}
      >
        {/* Row 1 - Marquee left to right */}
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <div className="marquee-row">
            {[...tweets, ...tweets].map((tweet, index) => (
              <TweetCard key={`row1-${index}`} tweet={tweet} />
            ))}
          </div>
        </div>

        {/* Row 2 - Marquee right to left */}
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <div className="marquee-row reverse">
            {[...tweets.slice(2), ...tweets.slice(0, 2), ...tweets.slice(2), ...tweets.slice(0, 2)].map((tweet, index) => (
              <TweetCard key={`row2-${index}`} tweet={tweet} />
            ))}
          </div>
        </div>

        {/* Row 3 - Marquee left to right with blur */}
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <div className="marquee-row blur">
            {[...tweets.slice(1), ...tweets.slice(0, 1), ...tweets.slice(1), ...tweets.slice(0, 1)].map((tweet, index) => (
              <TweetCard key={`row3-${index}`} tweet={tweet} />
            ))}
          </div>
        </div>
      </div>

    </section>
  )
}

export default ProductTestimonialsSection
