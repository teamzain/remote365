import React from 'react'

const ProductShareSection: React.FC = () => {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '120px 40px',
        background: '#FFFFFF',
        width: '100%',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: '1200px',
          gap: '24px'
        }}
      >
        {/* Left Column - Text Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: 0,
            gap: '24px',
            width: '528px',
            maxWidth: '528px',
            height: '218.25px',
            flex: 'none',
            flexGrow: 0
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: 0,
              gap: '24px',
              position: 'relative',
              height: '219.79px',
              left: '12px',
              right: 0,
              top: '-0.83px'
            }}
          >
            {/* Heading */}
            <h2
              style={{
                fontFamily: "'Mona Sans', sans-serif",
                fontWeight: 500,
                fontSize: '48px',
                lineHeight: '57px',
                letterSpacing: '-0.96px',
                color: '#111315',
                margin: 0,
                padding: '0 6.5px 0.795px 0',
                width: '407px',
                maxWidth: '407px',
                height: '114px',
                flex: 'none',
                flexGrow: 0
              }}
            >
              Share with friends and family
            </h2>

            {/* Description */}
            <p
              style={{
                fontFamily: "'Mona Sans', sans-serif",
                fontWeight: 400,
                fontSize: '18px',
                lineHeight: '27px',
                letterSpacing: '-0.18px',
                color: 'rgba(26, 29, 33, 0.65)',
                margin: 0,
                padding: '0 6.44px 0 0',
                width: '516px',
                height: '81px',
                flex: 'none',
                flexGrow: 0
              }}
            >
              You can also share device access with friends to give them access to specific machines without exposing your entire network to the public internet.
            </p>
          </div>
        </div>

        {/* Right Column - Image */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-end',
            padding: 0,
            margin: '0 auto',
            width: '728px',
            height: '501px',
            flex: 'none',
            flexGrow: 0
          }}
        >
          <img
            src="/62.png"
            alt="Share with friends and family illustration"
            style={{
              width: '605px',
              maxWidth: '728px',
              height: '501px',
              flex: 'none',
              flexGrow: 0
            }}
          />
        </div>
      </div>
    </section>
  )
}

export default ProductShareSection
