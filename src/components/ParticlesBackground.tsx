import { useCallback, useMemo, useEffect, useState } from "react";

const ParticlesBackground = () => {
  const [ParticlesComponent, setParticlesComponent] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [reactParticles, slim] = await Promise.all([
          import("@tsparticles/react"),
          import("@tsparticles/slim"),
        ]);
        const Particles = reactParticles.default;
        const initParticlesEngine = (reactParticles as any).initParticlesEngine;
        if (initParticlesEngine) {
          await initParticlesEngine(async (engine: any) => {
            await slim.loadSlim(engine);
          });
        }
        if (mounted) setParticlesComponent(() => Particles);
      } catch (e) {
        console.warn("Particles failed to load", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const options = useMemo(() => ({
    background: { color: { value: "transparent" } },
    fpsLimit: 60,
    particles: {
      color: { value: "#00e639" },
      links: {
        color: "#00e639",
        distance: 150,
        enable: true,
        opacity: 0.15,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.8,
        direction: "none" as const,
        outModes: { default: "bounce" as const },
      },
      number: {
        density: { enable: true },
        value: 40,
      },
      opacity: { value: 0.2 },
      shape: { type: "circle" },
      size: { value: { min: 1, max: 3 } },
    },
    detectRetina: true,
  }), []);

  if (!ParticlesComponent) return null;

  return (
    <ParticlesComponent
      id="tsparticles"
      options={options}
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
};

export default ParticlesBackground;
