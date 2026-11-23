import { useEffect, useRef } from 'react';

/**
 * Global 3D parallax background.
 *
 * Renders a fixed, full-viewport 3D scene (depth layers + faint grid) that
 * reacts to scroll (parallax) and mouse movement (subtle perspective tilt).
 * Mounted once at the app shell so it covers the whole system. Purely
 * decorative: pointer-events are disabled and it sits behind all content.
 */
export function Global3DBackground() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const layer1 = useRef<HTMLDivElement>(null);
  const layer2 = useRef<HTMLDivElement>(null);
  const layer3 = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    let mouseX = 0;
    let mouseY = 0;
    let curX = 0;
    let curY = 0;
    let scrollY = 0;
    let rafLoop = 0;

    const readScroll = () => {
      const el = document.querySelector('[data-scroll-root]') as HTMLElement | null;
      scrollY = el && el.scrollTop > 0 ? el.scrollTop : window.scrollY || document.documentElement.scrollTop || 0;
    };

    const apply = () => {
      if (scene) {
        scene.style.transform = `rotateY(${curX * 2.2}deg) rotateX(${-curY * 2.2}deg)`;
      }
      if (layer1.current) {
        layer1.current.style.transform = `translate3d(0, ${scrollY * 0.06}px, -160px)`;
      }
      if (layer2.current) {
        layer2.current.style.transform = `translate3d(0, ${scrollY * 0.14}px, -60px)`;
      }
      if (layer3.current) {
        layer3.current.style.transform = `translate3d(0, ${scrollY * 0.26}px, 100px)`;
      }
      if (gridRef.current) {
        gridRef.current.style.transform = `translate3d(0, ${scrollY * 0.04}px, -340px)`;
      }
    };

    const onScroll = () => readScroll();

    const onMouse = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const loop = () => {
      curX += (mouseX - curX) * 0.04;
      curY += (mouseY - curY) * 0.04;
      apply();
      rafLoop = requestAnimationFrame(loop);
    };
    rafLoop = requestAnimationFrame(loop);

    const inner = document.querySelector('[data-scroll-root]') as HTMLElement | null;
    if (inner) inner.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouse);
    readScroll();

    return () => {
      if (inner) inner.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouse);
      cancelAnimationFrame(rafLoop);
    };
  }, []);

  return (
    <div className="global-3d-bg" aria-hidden="true">
      <div className="global-3d-scene" ref={sceneRef}>
        <div className="global-3d-grid" ref={gridRef} />
        <div className="global-3d-layer layer-1" ref={layer1} />
        <div className="global-3d-layer layer-2" ref={layer2} />
        <div className="global-3d-layer layer-3" ref={layer3} />
      </div>
    </div>
  );
}