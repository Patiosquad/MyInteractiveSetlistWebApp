const RING_COLOR = 'rgba(255,90,31,0.13)';

interface Ember {
  phase: number;
  radius: number;
  size: number;
  color: string;
  duration: number;
}

const EMBERS: Ember[] = [
  { phase: 15, radius: 540, size: 3, color: '#ff8a3f', duration: 28 },
  { phase: 95, radius: 540, size: 2, color: '#ffcf6b', duration: 40 },
  { phase: 210, radius: 594, size: 3, color: '#ffb703', duration: 33 },
  { phase: 305, radius: 594, size: 2, color: '#ff5a1f', duration: 47 },
  { phase: 60, radius: 648, size: 3, color: '#ff8a3f', duration: 37 },
  { phase: 160, radius: 648, size: 2, color: '#ffcf6b', duration: 44 },
  { phase: 255, radius: 648, size: 2, color: '#ffb703', duration: 30 },
  { phase: 125, radius: 702, size: 3, color: '#ff5a1f', duration: 51 },
  { phase: 340, radius: 702, size: 2, color: '#ff8a3f', duration: 35 },
  { phase: 45, radius: 486, size: 2, color: '#ffb703', duration: 42 },
  { phase: 235, radius: 486, size: 2, color: '#ffcf6b', duration: 39 },
  { phase: 40, radius: 756, size: 3, color: '#ff5a1f', duration: 55 },
  { phase: 190, radius: 756, size: 2, color: '#ffb703', duration: 61 },
  { phase: 100, radius: 864, size: 3, color: '#ff8a3f', duration: 68 },
  { phase: 300, radius: 864, size: 2, color: '#ffcf6b', duration: 73 },
  { phase: 20, radius: 972, size: 2, color: '#ffb703', duration: 80 },
  { phase: 220, radius: 972, size: 3, color: '#ff5a1f', duration: 86 },
  { phase: 130, radius: 1080, size: 2, color: '#ffcf6b', duration: 93 },
  { phase: 330, radius: 1080, size: 2, color: '#ff8a3f', duration: 99 },
];

interface GutterBackgroundProps {
  columnWidth: number;
}

export default function GutterBackground({ columnWidth }: GutterBackgroundProps) {
  const halfColumn = columnWidth / 2;
  const feather = 3; // 3px each side of the boundary = ~6px total transition

  const maskImage = `linear-gradient(to right,
    rgba(0,0,0,1) 0,
    rgba(0,0,0,1) calc(50% - ${halfColumn + feather}px),
    rgba(0,0,0,0) calc(50% - ${halfColumn - feather}px),
    rgba(0,0,0,0) calc(50% + ${halfColumn - feather}px),
    rgba(0,0,0,1) calc(50% + ${halfColumn + feather}px),
    rgba(0,0,0,1) 100%)`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        maskImage,
        WebkitMaskImage: maskImage,
      }}
    >
      {/* Ring pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-radial-gradient(circle at 50% 5%, ${RING_COLOR} 0px, ${RING_COLOR} 1.5px, transparent 1.5px, transparent 54px)`,
          animation: 'ringBreathe 6s ease-in-out infinite',
        }}
      />

      {/* Vignette — bottom glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(120% 85% at 50% 122%, rgba(28,19,16,0.6), rgba(10,8,6,0) 55%)',
        }}
      />

      {/* Vignette — edge darkening */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(118% 100% at 50% 40%, rgba(10,8,6,0) 50%, rgba(5,4,3,0.5) 100%)',
        }}
      />

      {/* Orbiting embers */}
      {EMBERS.map((ember, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '5%',
            width: 0,
            height: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 0,
              height: 0,
              transformOrigin: '0 0',
              animation: `emberSpin ${ember.duration}s linear infinite`,
              // a static transform is fully overridden once an animation targets the
              // same property, so the orbit phase is baked in as a negative delay
              animationDelay: `${-(ember.phase / 360) * ember.duration}s`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: `${-ember.size / 2}px`,
                top: `${ember.radius}px`,
                width: `${ember.size}px`,
                height: `${ember.size}px`,
                borderRadius: '50%',
                background: ember.color,
                filter: 'blur(0.3px)',
                boxShadow: `0 0 4px ${ember.color}`,
                animation: `emberTwinkle ${ember.duration * 0.25}s ease-in-out infinite`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
