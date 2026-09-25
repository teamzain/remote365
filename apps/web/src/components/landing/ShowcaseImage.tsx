import React from 'react'

interface ShowcaseImageProps {
  src: string
  alt?: string
}

// Full-width rounded image card, matching the site's other showcase slots.
const ShowcaseImage: React.FC<ShowcaseImageProps> = ({ src, alt = '' }) => (
  <section className="showcase-section">
    <img src={src} alt={alt} loading="lazy" decoding="async" className="showcase-img" />
    <style>{`
      .showcase-section {
        background: #FFFFFF;
        display: flex;
        justify-content: center;
        padding: 40px clamp(20px, 4vw, 40px);
      }
      .showcase-img {
        display: block;
        width: 100%;
        max-width: 1214px;
        aspect-ratio: 1214 / 680;
        object-fit: cover;
        border-radius: 12px;
      }
    `}</style>
  </section>
)

export default ShowcaseImage
