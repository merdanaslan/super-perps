import { BlurFade } from './BlurFade';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" aria-label="super perps">
      <img src="/brand/super-mark.png" width="36" height="36" alt="" />
      {!compact && (
        <span>
          super <span className="brand-light">perps</span>
        </span>
      )}
    </span>
  );
}
/** Shared artwork keeps the phone hero and desktop handoff on the same brand. */
export function BrandHero({ desktop = false }: { desktop?: boolean }) {
  const logo = (
    <img
      className="hero-logo"
      src="/brand/super-hero-logo.png"
      alt=""
      width="1152"
      height="768"
      fetchPriority="high"
    />
  );
  return (
    <div className={`hero-art${desktop ? ' handoff-art' : ''}`} aria-hidden="true">
      <img
        className="hero-base"
        src="/brand/super-hero-base.png"
        alt=""
        width="1152"
        height="768"
      />
      {desktop ? (
        <div className="hero-logo-layer">{logo}</div>
      ) : (
        <BlurFade className="hero-logo-layer">{logo}</BlurFade>
      )}
    </div>
  );
}
