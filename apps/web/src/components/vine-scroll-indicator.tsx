'use client';

import React, { useEffect, useRef, useState } from 'react';

interface VineScrollIndicatorProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onActiveChange?: (active: boolean) => void;
}

export function VineScrollIndicator({ containerRef, onActiveChange }: VineScrollIndicatorProps) {
  const stemRef = useRef<SVGPathElement>(null);
  const leafRefs = useRef<Array<SVGGElement | null>>([]);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    // Check prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = motionQuery.matches;

    const onMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      updateVine();
    };
    motionQuery.addEventListener('change', onMotionChange);

    // 4 tiny forest green leaves (within the 3–5 requirement)
    const leafThresholds = [0.18, 0.40, 0.65, 0.88];
    const leafAngles = [35, -35, 30, -30];

    const updateVine = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const maxScroll = scrollHeight - clientHeight;
      const canScroll = maxScroll > 8;

      setIsScrollable((prev) => {
        if (prev !== canScroll) {
          onActiveChange?.(canScroll);
        }
        return canScroll;
      });

      if (!canScroll) return;

      const progress = Math.min(1, Math.max(0, scrollTop / maxScroll));

      // Update stem stroke-dashoffset (100 = 0% grown, 0 = 100% grown)
      if (stemRef.current) {
        if (prefersReducedMotion) {
          // Instant direct placement without transition lag
          stemRef.current.style.transition = 'none';
          stemRef.current.style.strokeDashoffset = `${100 - progress * 100}`;
        } else {
          stemRef.current.style.transition = 'stroke-dashoffset 40ms linear';
          stemRef.current.style.strokeDashoffset = `${100 - progress * 100}`;
        }
      }

      // Update each tiny leaf's growth and reversal
      leafThresholds.forEach((threshold, idx) => {
        const leafEl = leafRefs.current[idx];
        if (!leafEl) return;

        if (prefersReducedMotion) {
          const isPast = progress >= threshold;
          leafEl.style.transition = 'none';
          leafEl.style.opacity = isPast ? '1' : '0';
          leafEl.style.transform = isPast
            ? `scale(1) rotate(${leafAngles[idx]}deg)`
            : `scale(0) rotate(${leafAngles[idx]}deg)`;
        } else {
          // Bloom smoothly over a 6% scroll range after reaching threshold
          const bloom = Math.min(1, Math.max(0, (progress - threshold) / 0.06));
          leafEl.style.transition = 'opacity 60ms ease-out, transform 60ms ease-out';
          leafEl.style.opacity = `${bloom}`;
          leafEl.style.transform = `scale(${bloom}) rotate(${leafAngles[idx]}deg)`;
        }
      });
    };

    const handleScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateVine);
    };

    // Initial update
    updateVine();
    container.addEventListener('scroll', handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      updateVine();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', updateVine);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateVine);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, [containerRef, onActiveChange]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute right-2.5 top-3.5 bottom-3.5 w-3.5 z-10 select-none transition-opacity duration-200 ${
        isScrollable ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <svg
        className="w-full h-full overflow-visible"
        viewBox="0 0 14 100"
        preserveAspectRatio="none"
      >
        {/* Visible guide rail track aligned to the scroll indicator path in muted sage (#879B7A) */}
        <path
          d="M 7 0 C 8.5 12, 5.5 24, 7 36 S 8.5 60, 7 72 S 5.5 88, 7 100"
          fill="none"
          stroke="#879B7A"
          strokeOpacity="0.25"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />

        {/* Animated growing vine stem in muted sage (#879B7A) */}
        <path
          ref={stemRef}
          d="M 7 0 C 8.5 12, 5.5 24, 7 36 S 8.5 60, 7 72 S 5.5 88, 7 100"
          fill="none"
          stroke="#879B7A"
          strokeWidth="1.75"
          strokeLinecap="round"
          pathLength="100"
          style={{
            strokeDasharray: '100',
            strokeDashoffset: '100',
          }}
          vectorEffect="non-scaling-stroke"
        />

        {/* 4 Tiny leaves in forest green (#344E41) */}
        {/* Leaf 1 (y = 18%) */}
        <g transform="translate(7, 18)">
          <g
            ref={(el) => {
              leafRefs.current[0] = el;
            }}
            style={{
              transformOrigin: '0 0',
              transform: 'scale(0) rotate(35deg)',
              opacity: 0,
            }}
          >
            <path
              d="M 0 0 C 2.5 -2.5, 5.5 -1.5, 6 0 C 5.5 1.5, 2.5 2.5, 0 0 Z"
              fill="#344E41"
            />
          </g>
        </g>

        {/* Leaf 2 (y = 40%) */}
        <g transform="translate(7, 40)">
          <g
            ref={(el) => {
              leafRefs.current[1] = el;
            }}
            style={{
              transformOrigin: '0 0',
              transform: 'scale(0) rotate(-35deg)',
              opacity: 0,
            }}
          >
            <path
              d="M 0 0 C -2.5 -2.5, -5.5 -1.5, -6 0 C -5.5 1.5, -2.5 2.5, 0 0 Z"
              fill="#344E41"
            />
          </g>
        </g>

        {/* Leaf 3 (y = 65%) */}
        <g transform="translate(7, 65)">
          <g
            ref={(el) => {
              leafRefs.current[2] = el;
            }}
            style={{
              transformOrigin: '0 0',
              transform: 'scale(0) rotate(30deg)',
              opacity: 0,
            }}
          >
            <path
              d="M 0 0 C 2.5 -2.5, 5.5 -1.5, 6 0 C 5.5 1.5, 2.5 2.5, 0 0 Z"
              fill="#344E41"
            />
          </g>
        </g>

        {/* Leaf 4 (y = 88%) */}
        <g transform="translate(7, 88)">
          <g
            ref={(el) => {
              leafRefs.current[3] = el;
            }}
            style={{
              transformOrigin: '0 0',
              transform: 'scale(0) rotate(-30deg)',
              opacity: 0,
            }}
          >
            <path
              d="M 0 0 C -2.5 -2.5, -5.5 -1.5, -6 0 C -5.5 1.5, -2.5 2.5, 0 0 Z"
              fill="#344E41"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
