import React, { useEffect, useRef } from 'react';

interface ThreeBackgroundProps {
  enabled?: boolean;
}

export const ThreeBackground: React.FC<ThreeBackgroundProps> = ({ enabled = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Lightweight star dust particles (low count for maximum 60fps performance without lag)
    const particleCount = Math.min(Math.floor((width * height) / 32000), 38);
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      baseAlpha: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      const baseAlpha = Math.random() * 0.35 + 0.15;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        radius: Math.random() * 1.5 + 0.5,
        alpha: baseAlpha,
        baseAlpha,
      });
    }

    let time = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      // Delta time check to prevent frame drops
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      time += delta * 0.5;

      // Deep, modern, non-neon background
      ctx.fillStyle = '#07080c';
      ctx.fillRect(0, 0, width, height);

      // Subtle ambient light (Slate & Deep Blue, non-neon, elegant)
      const grad = ctx.createRadialGradient(
        width * 0.5 + Math.sin(time * 0.4) * 80,
        height * 0.25 + Math.cos(time * 0.3) * 60,
        20,
        width * 0.5,
        height * 0.25,
        Math.max(width, height) * 0.7
      );
      grad.addColorStop(0, 'rgba(30, 41, 59, 0.35)');
      grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.2)');
      grad.addColorStop(1, 'rgba(7, 8, 12, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Render star dust particles with zero overhead
      ctx.fillStyle = '#94a3b8';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const pulse = Math.sin(time * 2 + i) * 0.1;
        ctx.globalAlpha = Math.max(0.05, Math.min(0.6, p.baseAlpha + pulse));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
};
