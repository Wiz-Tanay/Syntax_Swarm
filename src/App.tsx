import { motion, AnimatePresence } from 'motion/react';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { sounds } from './services/soundService';
import { Settings, Check, Volume2, VolumeX, Cpu, Type, Bug, RefreshCw, Home, XCircle, AlertTriangle, Activity, Shield, Zap, ChevronRight, Code2, X } from 'lucide-react';

const COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];
const CHARS = ['=>', ';', '//', '()', '[]', 'const', 'let', 'var', 'async', '{...}', '=>', 'import', 'from', 'await', 'fetch'];
const COLLECTIBLES = ['*', '¤', '§', '†', '‡', '¶', 'Ψ', 'Ω'];
const VIBRATION_INTENSITY = 0.5;

class CodeSnippet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  opacity: number;
  size: number;

  constructor(w: number, h: number) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 0.2;
    this.vy = 1.5 + Math.random() * 2.5; // Faster rain
    this.text = CHARS[Math.floor(Math.random() * CHARS.length)];
    this.opacity = 0.03 + Math.random() * 0.12; // Slightly more visible
    this.size = 10 + Math.random() * 8;
  }

  update(h: number) {
    this.y += this.vy;
    this.x += this.vx;
    if (this.y > h) {
        this.y = -20;
        this.x = Math.random() * window.innerWidth;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.font = `${this.size}px monospace`;
    ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
    ctx.fillText(this.text, this.x, this.y);
  }
}

interface DifficultyPreset {
  name: string;
  timeLimit: number;
  speedMult: number;
  erraticism: number;
}

const DIFFICULTIES: Record<string, DifficultyPreset> = {
  easy: { name: 'Relaxed', timeLimit: 360000, speedMult: 0.7, erraticism: 0.01 },
  normal: { name: 'Protocol', timeLimit: 240000, speedMult: 1.0, erraticism: 0.02 },
  hard: { name: 'Overclock', timeLimit: 120000, speedMult: 1.4, erraticism: 0.04 },
};

const NUMBER_STYLES = [
  { id: 'industrial', name: 'Industrial', class: 'font-sans font-black', canvasFont: '900 INTER_SIZE sans-serif' },
  { id: 'terminal', name: 'Terminal', class: 'font-mono font-bold', canvasFont: 'bold INTER_SIZE monospace' },
  { id: 'classical', name: 'Classical', class: 'font-serif italic font-bold', canvasFont: 'italic bold INTER_SIZE serif' },
  { id: 'ghost', name: 'Ghost', class: 'font-sans font-black [text-shadow:0_0_20px_white] [-webkit-text-stroke:1px_white] text-transparent', canvasFont: '900 INTER_SIZE sans-serif', ghost: true },
];

class Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number = 1.0;
  color: string;

  constructor(x: number, y: number, color: string = '#FBBC05') {
    this.x = x;
    this.y = y;
    const ang = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 8;
    this.vx = Math.cos(ang) * spd;
    this.vy = Math.sin(ang) * spd;
    this.color = color;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.life -= 0.02;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Particle {
  x: number;
  y: number;
  tx: number; // target x
  ty: number; // target y
  baseTx: number;
  baseTy: number;
  ox: number = 0; // offset x from swiping
  oy: number = 0; // offset y from swiping
  vx: number = 0;
  vy: number = 0;
  char: string;
  color: string;
  size: number;
  isCollectible: boolean = false;
  collected: boolean = false;
  hoverX: number = 0;
  hoverY: number = 0;
  bugTimer: number = 0;

  constructor(x: number, y: number, tx: number, ty: number, char: string, color: string, size: number) {
    this.x = x;
    this.y = y;
    this.tx = tx;
    this.ty = ty;
    this.baseTx = tx;
    this.baseTy = ty;
    this.char = char;
    this.color = color;
    this.size = size;
    this.bugTimer = Math.random() * 100;
  }

  update(mode: 'normal' | 'exploding', mouse: { x: number, y: number } | null, difficulty: DifficultyPreset, errativeness: number = 50) {
    if (mode === 'exploding') {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.98;
      this.vy *= 0.98;
    } else {
      const errRatio = errativeness / 50;
      // Exponentially increase scuttle speed at high errativeness
      const finalErrRatio = Math.pow(errRatio, 1.5);
      this.bugTimer += 0.08 * finalErrRatio; 
      
      // Bug autonomous movement (crawling within boundaries)
      if (this.isCollectible && !this.collected) {
        // Drift around base target
        const crawlRadius = 45 * finalErrRatio; 
        const crawlSpd = 1.2 * finalErrRatio;
        this.tx = this.baseTx + Math.sin(this.bugTimer * crawlSpd) * crawlRadius;
        this.ty = this.baseTy + Math.cos(this.bugTimer * crawlSpd * 1.8) * crawlRadius;
        
        // Evasion (temporary offset that decays)
        if (mouse) {
          const mdx = this.x - mouse.x;
          const mdy = this.y - mouse.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < 160 && mdist > 30) {
            this.ox += mdx * 0.06 * finalErrRatio; // More aggressive evasion
            this.oy += mdy * 0.06 * finalErrRatio;
          }
        }
      }

      if (mouse) {
        const hdx = this.x - mouse.x;
        const hdy = this.y - mouse.y;
        const hdist = Math.sqrt(hdx * hdx + hdy * hdy);
        if (hdist < 120) {
          const force = (120 - hdist) / 120;
          this.hoverX = (this.hoverX + hdx * force * 0.25) * 0.7;
          this.hoverY = (this.hoverY + hdy * force * 0.25) * 0.7;
        } else {
          this.hoverX *= 0.8;
          this.hoverY *= 0.8;
        }
      }

      // Organic drift and vibration
      const driftX = Math.sin(this.bugTimer * 1.4) * 5 * difficulty.speedMult * finalErrRatio;
      const driftY = Math.cos(this.bugTimer * 1.2) * 5 * difficulty.speedMult * finalErrRatio;
      const vibration = (Math.random() - 0.5) * 3 * difficulty.erraticism * 50 * finalErrRatio;

      const targetX = this.tx + this.ox + this.hoverX + driftX + vibration;
      const targetY = this.ty + this.oy + this.hoverY + driftY + vibration;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      
      this.vx = (this.vx + dx * 0.08) * 0.8;
      this.vy = (this.vy + dy * 0.08) * 0.8;
      this.x += this.vx;
      this.y += this.vy;

      // Teleportation-style jitter at high errativeness
      if (errativeness > 80 && Math.random() > 0.95) {
        this.x += (Math.random() - 0.5) * 40;
        this.y += (Math.random() - 0.5) * 40;
      }

      this.x += (Math.random() - 0.5) * 0.5 * finalErrRatio;
      this.y += (Math.random() - 0.5) * 0.5 * finalErrRatio;

      this.ox *= 0.95;
      this.oy *= 0.95;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.collected && this.isCollectible) return;
    ctx.fillStyle = this.color;
    ctx.font = this.isCollectible ? `bold ${this.size + 4}px monospace` : `${this.size}px monospace`;
    ctx.globalAlpha = this.isCollectible ? 1.0 : 0.7;

    if (this.isCollectible) {
      // Draw actual bug legs
      ctx.save();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      const legCount = 6;
      for (let i = 0; i < legCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const legIdx = Math.floor(i/2);
        const baseAngle = (Math.PI / 4) * (legIdx + 1);
        // Scuttling motion: vary frequency and phase
        const scuttle = Math.sin(this.bugTimer * 12 + i * 0.5) * 0.3;
        const angle = baseAngle * side + scuttle;
        
        const legLen = 14 + Math.sin(this.bugTimer * 8 + i) * 2;
        const legX = Math.cos(angle) * legLen;
        const legY = Math.sin(angle) * legLen;
        
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + legX, this.y + legY);
        ctx.stroke();
      }

      const pulse = 8 + Math.sin(this.bugTimer * 4) * 6;
      ctx.shadowBlur = pulse;
      ctx.shadowColor = this.color;
      ctx.fillText(this.char, this.x - this.size/2, this.y);
      ctx.restore();
    } else {
      ctx.fillText(this.char, this.x, this.y);
    }
  }
}

interface ScoutingBugProps {
  id: number;
}

const ScoutingBug: React.FC<ScoutingBugProps> = ({ id }) => {
  // Each bug starts in a different corner/area
  const startPos = useMemo(() => {
    const positions = [
      { x: -900, y: -500 }, // NW
      { x: 900, y: -500 },  // NE
      { x: 900, y: 500 },   // SE
      { x: -900, y: 500 },  // SW
      { x: 0, y: -800 },    // N
      { x: 1000, y: 0 },    // East Center
      { x: 800, y: 300 },   // East Bottom
      { x: 0, y: 1200 },    // Far Bottom Center
    ];
    return positions[id % positions.length];
  }, [id]);

  const [coords, setCoords] = useState({ ...startPos, rotate: 0 });
  const [trail, setTrail] = useState<{x: number, y: number, id: number}[]>([]);
  
  // Generate a unique path for this bug instance that covers the whole screen
  const waypoints = useMemo(() => {
    const pts: {x: number, y: number}[] = [];
    
    const logoPoints = [
      { x: -280, y: -80 }, { x: 0, y: -120 }, { x: 280, y: -80 },
      { x: 250, y: 100 }, { x: 0, y: 150 }, { x: -250, y: 100 }
    ];

    const wideNodes = [
      { x: -1200, y: -700 }, { x: 1200, y: -700 },
      { x: 1200, y: 700 }, { x: -1200, y: 700 },
      { x: 600, y: 0 }, { x: -600, y: 0 },
      { x: 0, y: 600 }, { x: 0, y: -600 }
    ];

    const rightSideNodes = [
      { x: 800, y: -600 }, { x: 1100, y: -200 }, { x: 700, y: 300 },
      { x: 1000, y: 600 }, { x: 500, y: 100 }, { x: 1200, y: 0 }
    ];

    const bottomNodes = [
      { x: 0, y: 400 }, { x: -300, y: 700 }, { x: 300, y: 800 },
      { x: -500, y: 500 }, { x: 500, y: 600 }, { x: 0, y: 900 }
    ];
    
    // Different behaviors based on ID
    if (id === 0) {
      pts.push(...logoPoints, ...wideNodes);
    } else if (id === 1) {
      pts.push(...wideNodes.reverse(), ...logoPoints.reverse());
    } else if (id === 7) {
      // Bottom Center specialist
      pts.push(...bottomNodes.sort(() => Math.random() - 0.5));
      pts.push({ x: 0, y: 200 }); // Peek up
    } else if (id >= 5) {
      // Right side specialists (weird zig-zag patterns)
      pts.push(...rightSideNodes.sort(() => Math.random() - 0.5));
      pts.push({ x: 300, y: 0 }); // Peek at logo
    } else {
      // Random scramble covering all screen sectors
      const combined = [...logoPoints, ...wideNodes].sort(() => Math.random() - 0.5);
      pts.push(...combined);
    }

    // Add random jitter to make trajectories "weird" and erratic
    return pts.map(p => ({
      x: p.x + (Math.random() - 0.5) * 150,
      y: p.y + (Math.random() - 0.5) * 150
    }));
  }, [id]);

  const pathIndex = useRef(0);

  useEffect(() => {
    const updateTime = 2500 + (id * 300); // Faster crawl
    const interval = setInterval(() => {
      setCoords(prev => {
        pathIndex.current = (pathIndex.current + 1) % waypoints.length;
        const next = waypoints[pathIndex.current];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

        // Drop a trail point at the target location
        setTrail(tPrev => [{ x: next.x, y: next.y, id: Math.random() }, ...tPrev.slice(0, 10)]);
        return { x: next.x, y: next.y, rotate: angle };
      });
    }, updateTime);

    return () => clearInterval(interval);
  }, [waypoints, id]);

  return (
    <motion.div 
      className="absolute z-50 pointer-events-none"
      initial={startPos}
      animate={{ 
        x: coords.x,
        y: coords.y,
        rotate: coords.rotate,
        opacity: [0, 1]
      }}
      transition={{ 
        duration: 2.5 + (id * 0.3), // Snappier but fluid
        ease: "easeInOut"
      }}
    >
      {/* Motion Trail Particles - brighter and bigger */}
      <AnimatePresence>
        {trail.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0.8, scale: 1.5 }}
            animate={{ opacity: 0, scale: 0.1 }}
            exit={{ opacity: 0 }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-[#4285F4]/30 blur-2xl"
            style={{ left: t.x - coords.x, top: t.y - coords.y }}
            transition={{ duration: 3.5 }}
          />
        ))}
      </AnimatePresence>

      <motion.div
        className="relative"
        animate={{ 
          scale: [1, 1.3, 1],
          filter: [
            "drop-shadow(0 0 10px rgba(66, 133, 244, 0.6))",
            "drop-shadow(0 0 35px rgba(66, 133, 244, 0.9))",
            "drop-shadow(0 0 10px rgba(66, 133, 244, 0.6))"
          ],
        }}
        transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
      >
        <Bug className="w-10 h-10 text-[#4285F4] drop-shadow-[0_0_20px_#4285F4] filter brightness-150" />
        
        {/* Pulsing energy core */}
        <motion.div 
          className="absolute top-1/2 left-1/2 w-8 h-8 bg-[#4285F4]/40 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl"
          animate={{ scale: [1, 4, 1], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      </motion.div>
    </motion.div>
  );
};

const Counter = ({ value, duration = 1 }: { value: number, duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    let start = previousValue.current;
    let end = value;
    if (start === end) return;

    let startTime: number | null = null;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
      const current = Math.floor(start + (end - start) * progress);
      setDisplayValue(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousValue.current = value;
      }
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
};

interface SuccessParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  char: string;
  alpha: number;
  size: number;
  life: number;
}

const SuccessEffect: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<SuccessParticle[]>([]);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Initial burst
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 15;
      particles.current.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        alpha: 1,
        size: 10 + Math.random() * 20,
        life: 1 + Math.random()
      });
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(6, 6, 6, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.current.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.005;
        p.size *= 0.99;
        
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px monospace`;
        ctx.fillText(p.char, p.x, p.y);
        
        // Motion trail
        ctx.beginPath();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size / 4;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
        ctx.stroke();
        ctx.restore();

        if (p.alpha <= 0) {
          particles.current.splice(index, 1);
        }
      });

      // Continuous smaller bursts
      if (Math.random() > 0.8) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        for (let i = 0; i < 5; i++) {
           const angle = Math.random() * Math.PI * 2;
           const speed = 1 + Math.random() * 5;
           particles.current.push({
             x, y,
             vx: Math.cos(angle) * speed,
             vy: Math.sin(angle) * speed,
             color: COLORS[Math.floor(Math.random() * COLORS.length)],
             char: CHARS[Math.floor(Math.random() * CHARS.length)],
             alpha: 0.8,
             size: 8 + Math.random() * 12,
             life: 1
           });
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
};

const FailureEffect: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<SuccessParticle[]>([]);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const FAILURE_COLORS = ['#ff0000', '#ff4d00', '#ff7b00', '#990000'];
    const FAILURE_CHARS = ['ERR!', 'FAIL', 'NULL', '0x1', '!!!', '{ }', '=>', '(/)'];

    // Initial chaotic burst
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    for (let i = 0; i < 150; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 20;
      particles.current.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: FAILURE_COLORS[Math.floor(Math.random() * FAILURE_COLORS.length)],
        char: FAILURE_CHARS[Math.floor(Math.random() * FAILURE_CHARS.length)],
        alpha: 1,
        size: 15 + Math.random() * 25,
        life: 1
      });
    }

    const animate = () => {
      // Darker trail for failure
      ctx.fillStyle = 'rgba(10, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.current.forEach((p, index) => {
        // Add some jitter
        p.x += p.vx + (Math.random() - 0.5) * 5;
        p.y += p.vy + (Math.random() - 0.5) * 5;
        p.alpha -= 0.01;
        p.size *= 0.98;
        
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px monospace`;
        
        // Glitch effect: occasionally draw offset or different char
        const drawX = p.x + (Math.random() > 0.95 ? (Math.random() - 0.5) * 40 : 0);
        const char = Math.random() > 0.98 ? 'ERROR' : p.char;
        ctx.fillText(char, drawX, p.y);
        
        // Jagged motion trail
        ctx.beginPath();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size / 6;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.stroke();
        ctx.restore();

        if (p.alpha <= 0) {
          particles.current.splice(index, 1);
        }
      });

      // Continuous chaotic spawning
      if (Math.random() > 0.6) {
        for (let i = 0; i < 3; i++) {
           const x = Math.random() * canvas.width;
           const y = Math.random() * canvas.height;
           const angle = Math.random() * Math.PI * 2;
           const speed = 2 + Math.random() * 8;
           particles.current.push({
             x, y,
             vx: Math.cos(angle) * speed,
             vy: Math.sin(angle) * speed,
             color: FAILURE_COLORS[Math.floor(Math.random() * FAILURE_COLORS.length)],
             char: FAILURE_CHARS[Math.floor(Math.random() * FAILURE_CHARS.length)],
             alpha: 0.9,
             size: 10 + Math.random() * 15,
             life: 1
           });
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none opacity-40" />;
};

const MiniStat = ({ label, value, color, delay }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white/5 border-l-2 p-3 md:p-6 flex flex-col gap-1 rounded-r-lg"
    style={{ borderColor: color }}
  >
    <div className="text-[8px] md:text-xs text-white/40 uppercase tracking-widest">{label}</div>
    <div className="text-xl md:text-4xl font-black text-white">{value}</div>
  </motion.div>
);

const GlitchText = ({ text, className }: { text: string, className?: string }) => {
  return (
    <div className={`relative ${className}`}>
      <motion.div
        animate={{ 
          x: [-2, 2, -1, 1, 0],
          filter: [
            'drop-shadow(2px 0 red) drop-shadow(-2px 0 blue)',
            'drop-shadow(-2px 0 red) drop-shadow(2px 0 blue)',
            'drop-shadow(0 0 0 transparent)'
          ]
        }}
        transition={{ duration: 0.1, repeat: Infinity, repeatType: "mirror" }}
        className="relative z-10"
      >
        {text}
      </motion.div>
      <motion.div
        animate={{ opacity: [0, 0.5, 0], x: [0, 5, -5, 0] }}
        transition={{ duration: 0.05, repeat: Infinity }}
        className="absolute inset-0 text-red-500 z-0 translate-x-1 opacity-50 select-none pointer-events-none"
      >
        {text}
      </motion.div>
    </div>
  );
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(0);
  const [gameState, setGameState] = useState<'landing' | 'tutorial' | 'startup' | 'idle' | 'drawing' | 'exploding' | 'gameOver' | 'success' | 'timeout'>('landing');
  const gameStateRef = useRef(gameState);

  const updateGameState = useCallback((newState: typeof gameState) => {
    gameStateRef.current = newState;
    setGameState(newState);
  }, []);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('syntax-swarm-hs')) || 0);
  const [collectedCount, setCollectedCount] = useState(0);
  const [totalSpawned, setTotalSpawned] = useState(0);
  const [totalPurged, setTotalPurged] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [shake, setShake] = useState(0);

  const [penalties, setPenalties] = useState(0);
  const [gameTime, setGameTime] = useState(0);
  const [protocolStartTime, setProtocolStartTime] = useState(0);
  const [isCompromised, setIsCompromised] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const prevVolume = useRef(50);
  const [bugCount, setBugCount] = useState(1);

  // Sync volume with sound engine
  useEffect(() => {
    sounds.setVolume(volume / 100);
    if (volume > 0 && isMuted) setIsMuted(false);
    if (volume === 0 && !isMuted) setIsMuted(true);
  }, [volume, isMuted]);

  const toggleMute = () => {
    if (isMuted) {
      setVolume(prevVolume.current || 30);
    } else {
      prevVolume.current = volume;
      setVolume(0);
    }
    setIsMuted(!isMuted);
  };

  // Landing screen bug spawning
  useEffect(() => {
    if (gameState === 'landing') {
      const interval = setInterval(() => {
        setBugCount(prev => (prev < 8 ? prev + 1 : prev));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [gameState]);

  const [difficulty, setDifficulty] = useState('normal');
  const difficultyRef = useRef(difficulty);
  const [numberStyle, setNumberStyle] = useState('industrial');
  const numberStyleRef = useRef(numberStyle);
  const [errativeness, setErrativeness] = useState(50);
  const errativenessRef = useRef(50);

  useEffect(() => {
    errativenessRef.current = errativeness;
  }, [errativeness]);

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    numberStyleRef.current = numberStyle;
  }, [numberStyle]);

  const [isInitializing, setIsInitializing] = useState(false);
  const [showCrash, setShowCrash] = useState(false);

  // Music & Gameplay lifecycle
  useEffect(() => {
    if (gameState === 'landing') {
      sounds.startTitleMusic();
    } else if (gameState === 'startup') {
      // Transition from title/gameover to beginning of gameplay
      sounds.startGameMusic();
    }
    // Removed 'idle' trigger which caused restart on penalty
  }, [gameState]);
  
  // Start title music immediately if we land on title
  useEffect(() => {
    const startMusic = () => {
      if (gameState === 'landing') {
        sounds.startTitleMusic();
      }
    };

    startMusic();
    
    // Fallback for browser autoplay restrictions
    window.addEventListener('click', startMusic, { once: true });
    window.addEventListener('touchstart', startMusic, { once: true });
    
    return () => {
      window.removeEventListener('click', startMusic);
      window.removeEventListener('touchstart', startMusic);
    };
  }, []);

  // Timer-based tremor during last 15s
  useEffect(() => {
      const isPlaying = gameState === 'idle' || gameState === 'drawing';
      if (isPlaying && gameTime > DIFFICULTIES[difficulty].timeLimit - 15000) {
        const interval = setInterval(() => {
          setShake(s => s < 1 ? 2 : s); 
        }, 400);
        return () => clearInterval(interval);
      }
  }, [gameState, gameTime, difficulty]);
  
  const particles = useRef<Particle[]>([]);
  const snacks = useRef<CodeSnippet[]>([]);
  const sparks = useRef<Spark[]>([]);
  const laserPath = useRef<{ x: number, y: number }[]>([]);
  const mousePos = useRef<{ x: number, y: number } | null>(null);
  const sparkPos = useRef<{ x: number, y: number } | null>(null);
  const collectedIndices = useRef<Set<number>>(new Set());
  const errorFrameCount = useRef(0);
  const bounds = useRef({ top: 0, bottom: 0, left: 0, right: 0 });
  const shiftMode = useRef(false);
  const tutorialProgress = useRef(0);
  const successMessageTimer = useRef(0);
  const startupTimer = useRef(0);
  const gameTimeRef = useRef(0);
  const timerActive = useRef(false);
  const lastTick = useRef(0);

  // Timer formatting: MM:SS:CC
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const c = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${c.toString().padStart(2, '0')}`;
  };

  // Use refs to avoid closure staleness in listeners
  const levelRef = useRef(level);
  const scoreRef = useRef(score);
  const penaltiesRef = useRef(penalties);

  // High-priority sound triggers for state transistions
  useEffect(() => {
    if (gameState === 'timeout') {
      sounds.stopMusic();
      sounds.startFailureMusic();
    } else if (gameState === 'gameOver') {
      sounds.stopMusic();
      sounds.startSuccessMusic();
    }
  }, [gameState]);

  const triggerShake = (intensity = 10) => {
    setShake(intensity);
  };

  useEffect(() => {
    if (shake > 0) {
      const timer = setTimeout(() => setShake(s => Math.max(0, s - 2)), 30);
      return () => clearTimeout(timer);
    }
  }, [shake]);

  useEffect(() => {
    if (canvasRef.current && snacks.current.length === 0) {
      const { width, height } = canvasRef.current;
      snacks.current = Array.from({ length: 80 }, () => new CodeSnippet(width, height)); // Denser
    }
  }, []);

  const generateTargets = (num: number, forceTutorial?: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const octx = offscreen.getContext('2d', { willReadFrequently: true })!;
    octx.fillStyle = 'black';
    octx.fillRect(0, 0, offscreen.width, offscreen.height);
    octx.fillStyle = 'white';
    
    // Number is slightly smaller to give brackets room and pushed down
    const isTutorial = forceTutorial !== undefined ? forceTutorial : gameStateRef.current === 'tutorial';
    const displayNum = isTutorial ? '0' : num.toString();
    const fontSize = Math.min(canvas.height * 0.95, 800);
    const styleData = NUMBER_STYLES.find(s => s.id === numberStyleRef.current) || NUMBER_STYLES[0];
    octx.font = styleData.canvasFont.replace('INTER_SIZE', `${fontSize}px`);
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    
    // Ghost style enhancement: Thick lines for better swarm density
    if (styleData.ghost) {
      octx.lineWidth = 20;
      octx.strokeStyle = 'white';
      octx.strokeText(displayNum, canvas.width / 2, canvas.height * 0.55);
    }
    
    octx.fillText(displayNum, canvas.width / 2, canvas.height * 0.55);

    const imageData = octx.getImageData(0, 0, canvas.width, canvas.height);
    const newTargets: { x: number, y: number }[] = [];
    
    const step = 8;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const i = (y * canvas.width + x) * 4;
        if (imageData.data[i] > 128) {
          newTargets.push({ x, y });
        }
      }
    }

    if (newTargets.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        newTargets.forEach(t => {
            minX = Math.min(minX, t.x);
            maxX = Math.max(maxX, t.x);
            minY = Math.min(minY, t.y);
            maxY = Math.max(maxY, t.y);
        });
        bounds.current = { left: minX, right: maxX, top: minY, bottom: maxY };
    }

    const currentP = particles.current;
    if (currentP.length === 0) {
      const diff = DIFFICULTIES[difficulty];
      particles.current = newTargets.map(t => {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const p = new Particle(Math.random() * canvas.width, Math.random() * canvas.height, t.x, t.y, char, color, 8 + Math.random() * 10);
        const ang = Math.random() * Math.PI * 2;
        const spd = (Math.random() * 4) * diff.speedMult;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        return p;
      });
    } else {
      const shuffled = [...newTargets].sort(() => Math.random() - 0.5);
      particles.current = currentP.map((p, i) => {
        const t = shuffled[i % shuffled.length];
        if (t) {
          p.baseTx = t.x;
          p.baseTy = t.y;
          p.tx = t.x;
          p.ty = t.y;
        }
        p.isCollectible = false;
        p.collected = false;
        return p;
      });
    }
    
    // Ensure specific count of collectibles (bugs) always generated
    if (particles.current.length > 0) {
      if (!isTutorial) {
        setTotalSpawned(prev => prev + 8);
      }

      for (let i = 0; i < 8; i++) {
        const p = particles.current[Math.floor(Math.random() * particles.current.length)];
        if (p) {
          p.isCollectible = true;
          p.char = COLLECTIBLES[i % COLLECTIBLES.length];
          p.size = 20;
          p.collected = false;
        }
      }
    }

    collectedIndices.current.clear();
    setCollectedCount(0);
    laserPath.current = [];
  };

  const startDebugging = useCallback(() => {
    // If we're already in startup, don't restart
    if (gameStateRef.current === 'startup') return;
    
    sounds.playStartup();
    updateGameState('startup');
    setIsCompromised(false);
    startupTimer.current = 100; 
    setTotalSpawned(0);
    setTotalPurged(0);
    setStartTime(Date.now());
    
    // Explicitly set to 10 for the start of the game
    levelRef.current = 10;
    setLevel(10);
    generateTargets(10, false);
    
    setScore(0);
    scoreRef.current = 0;
    setPenalties(0);
    penaltiesRef.current = 0;
    gameTimeRef.current = 0;
    setGameTime(0);
    timerActive.current = false;
    setCollectedCount(0);
    laserPath.current = [];
    sparkPos.current = null;
    collectedIndices.current.clear();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      laserPath.current = [];
      sparkPos.current = null;
      // Use ref to get current level without depending on state closure
      generateTargets(levelRef.current, gameStateRef.current === 'tutorial');
    };

    window.addEventListener('resize', resize);
    resize();
    
    // Trigger first target generation
    generateTargets(0, true);

    let raf: number;
    const loop = () => {
      const now = performance.now();
      const currentDiff = DIFFICULTIES[difficultyRef.current];

      if (timerActive.current) {
        const delta = now - lastTick.current;
        gameTimeRef.current += delta;
        setGameTime(gameTimeRef.current);
        
        const limit = currentDiff.timeLimit;
        const threshold = limit - 15000;
        
        if (gameTimeRef.current > threshold) {
          // Last 15 seconds: Increase pitch and tempo
          const progress = (gameTimeRef.current - threshold) / 15000;
          const pitchFactor = 1.0 + progress * 0.4; // 1.0 to 1.4
          sounds.setMusicPitch(pitchFactor);
          // Increase tempo as well
          const tempoFactor = 1.0 + progress * 0.5; // 1.0 to 1.5
          sounds.setMusicTempo(tempoFactor);
        } else {
          sounds.setMusicPitch(1.0);
          sounds.setMusicTempo(1.0);
        }

        // Timeout check
        if (gameTimeRef.current >= limit) {
          timerActive.current = false;
          sounds.stopMusic();
          sounds.startFailureMusic();
          updateGameState('timeout');
          setIsCompromised(true);
        }
      }
      lastTick.current = now;

      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        setShake(s => Math.max(0, s * 0.9));
      }

      ctx.fillStyle = 'rgba(12, 12, 12, 0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Background Ambient Code
      snacks.current.forEach(s => {
        s.update(canvas.height);
        s.draw(ctx);
      });

      const mode = (gameStateRef.current === 'exploding') ? 'exploding' : 'normal';
      
      const mouse = mousePos.current;
      particles.current.forEach(p => {
        p.update(mode, mouse, currentDiff, errativenessRef.current);
        p.draw(ctx);
      });

      sparks.current = sparks.current.filter(s => s.life > 0);
      sparks.current.forEach(s => {
        s.update();
        s.draw(ctx);
      });

      if (gameStateRef.current === 'startup') {
        startupTimer.current--;
        ctx.save();
        const flicker = Math.random() > 0.1 ? 1 : 0.3;
        ctx.globalAlpha = flicker;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 90px monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#4285F4';
        ctx.fillText('BOOT', canvas.width / 2, canvas.height * 0.45);
        
        ctx.save();
        const styleData = NUMBER_STYLES.find(s => s.id === numberStyleRef.current) || NUMBER_STYLES[0];
        ctx.font = styleData.canvasFont.replace('INTER_SIZE', '400px');
        ctx.globalAlpha = 0.05;
        if (styleData.ghost) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 4;
          ctx.strokeText(levelRef.current.toString(), canvas.width / 2, canvas.height / 2);
        }
        ctx.fillText(levelRef.current.toString(), canvas.width / 2, canvas.height / 2);
        ctx.restore();
        
        const progress = (100 - startupTimer.current) / 100;
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = '#4285F4';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height * 0.45 + 100, 30, 0, Math.PI * 2 * progress);
        ctx.stroke();
        ctx.restore();

        if (startupTimer.current <= 0) {
          updateGameState('idle');
          setPenalties(0);
          setCollectedCount(0);
          // Start timer on level 10 after initial startup animation
          if (levelRef.current === 10 && !timerActive.current) {
            timerActive.current = true;
            lastTick.current = performance.now();
            setProtocolStartTime(performance.now());
            sounds.playStep();
          }
        }
      } else if (gameStateRef.current === 'tutorial') {
        const bx = (bounds.current.left + bounds.current.right) / 2;
        const bracketMargin = 70; // Increased spacing for visibility
        const bTop = Math.max(15, bounds.current.top - bracketMargin);
        const bBottom = Math.min(canvas.height - 15, bounds.current.bottom + bracketMargin);
        
        tutorialProgress.current += 0.005;
        if (tutorialProgress.current > 1.2) tutorialProgress.current = 0;

        const p = Math.min(1, tutorialProgress.current);
        const curY = bTop + (bBottom - bTop) * p;
        const curX = bx + Math.sin(p * 10) * 40;

        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#4285F4';
        ctx.fillStyle = '#4285F4';
        ctx.font = 'bold 22px monospace'; 
        ctx.textAlign = 'center';
        ctx.fillText('{', bx, bTop);
        
        ctx.shadowColor = '#EA4335';
        ctx.fillStyle = '#EA4335';
        ctx.fillText('}', bx, bBottom);
        ctx.restore();

        // Target Instructions inside the 'O'
        ctx.save();
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '4px';
        ctx.fillText('OPEN SCOPE {', canvas.width/2, canvas.height * 0.55 - 15);
        ctx.fillText('PURGE BUGS', canvas.width/2, canvas.height * 0.55);
        ctx.fillText('CLOSE SCOPE }', canvas.width/2, canvas.height * 0.55 + 15);
        ctx.restore();

        // Ghost laser path
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.setLineDash([10, 10]);
        ctx.lineWidth = 2;
        ctx.moveTo(bx, bTop);
        for(let i=0; i<=p; i+=0.01) {
            ctx.lineTo(bx + Math.sin(i * 10) * 40, bTop + (bBottom - bTop) * i);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#4285F4';
        ctx.arc(curX, curY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (gameStateRef.current !== 'exploding' && gameStateRef.current !== 'success' && gameStateRef.current !== 'gameOver') {
        const bx = (bounds.current.left + bounds.current.right) / 2;
        const bracketMargin = 70; // Increased spacing for visibility
        const bTop = Math.max(15, bounds.current.top - bracketMargin);
        const bBottom = Math.min(canvas.height - 15, bounds.current.bottom + bracketMargin);

        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#4285F4';
        ctx.fillStyle = '#4285F4';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('{', bx, bTop);
        
        ctx.shadowColor = '#EA4335';
        ctx.fillStyle = '#EA4335';
        ctx.fillText('}', bx, bBottom);
        ctx.restore();

        if (laserPath.current.length > 0) {
          ctx.save();
          
          const isError = errorFrameCount.current > 0;
          
          // Inner core
          ctx.beginPath();
          ctx.strokeStyle = isError ? '#EA4335' : '#fff';
          ctx.lineWidth = isError ? 10 + Math.random() * 10 : 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          ctx.moveTo(laserPath.current[0].x, laserPath.current[0].y);
          laserPath.current.forEach(p => {
            const jitter = isError ? (Math.random() - 0.5) * 25 : 0;
            ctx.lineTo(p.x + jitter, p.y + jitter);
          });
          ctx.stroke();

          // Outer Glow
          ctx.beginPath();
          ctx.strokeStyle = isError ? `rgba(234, 67, 53, ${Math.random() * 0.8})` : `rgba(66, 133, 244, ${gameStateRef.current === 'drawing' ? 0.9 : 0.4})`;
          ctx.lineWidth = isError ? 30 : 18;
          ctx.shadowBlur = isError ? 50 : 30;
          ctx.shadowColor = isError ? '#EA4335' : '#4285F4';
          
          ctx.moveTo(laserPath.current[0].x, laserPath.current[0].y);
          laserPath.current.forEach(p => {
            const jitter = isError ? (Math.random() - 0.5) * 40 : 0;
            ctx.lineTo(p.x + jitter, p.y + jitter);
          });
          ctx.stroke();
          
          if (isError) errorFrameCount.current--; // Decay error frame count
          ctx.restore();
        }

        if (sparkPos.current) {
          for(let i=0; i<3; i++) sparks.current.push(new Spark(sparkPos.current.x, sparkPos.current.y, '#FBBC05'));
          sparkPos.current = null; // Consume spark
        }

        // Automatic laser retraction if not success
        if (gameStateRef.current === 'idle' && laserPath.current.length > 0) {
          laserPath.current.pop();
          if (laserPath.current.length === 0) sparkPos.current = null;
        }
      }

      if (gameStateRef.current === 'success') {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 80px monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#fff';
        ctx.fillText('< BRACKETS CLOSED />', canvas.width / 2, canvas.height / 2);
        ctx.font = '20px monospace';
        ctx.fillStyle = '#34A853';
        ctx.fillText(`+${(2000 * levelRef.current).toLocaleString()} SYSTEM STABILITY BONUS`, canvas.width / 2, canvas.height / 2 + 60);
        ctx.restore();
      }

      ctx.restore(); // Undo shake translate
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (gameStateRef.current === 'exploding' || gameStateRef.current === 'success' || gameStateRef.current === 'gameOver' || gameStateRef.current === 'startup') return;
    const bx = (bounds.current.left + bounds.current.right) / 2;
    const bracketMargin = 70;
    const bTop = Math.max(15, bounds.current.top - bracketMargin);
    const distT = Math.sqrt(Math.pow(e.clientX - bx, 2) + Math.pow(e.clientY - bTop, 2));
    
    if (distT < 100) {
      updateGameState('drawing');
      shiftMode.current = false;
      sparkPos.current = null;
      laserPath.current = [{ x: bx, y: bTop }, { x: e.clientX, y: e.clientY }];
    } else {
      shiftMode.current = true;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (gameStateRef.current === 'gameOver') return;
    
    const x = e.clientX;
    const y = e.clientY;
    mousePos.current = { x, y };

    if (gameStateRef.current === 'success') return;

    if (shiftMode.current) {
      particles.current.forEach(p => {
        const dx = x - p.x;
        const dy = y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          p.ox += dx * 0.2;
          p.oy += dy * 0.2;
        }
      });
      return;
    }

    if (gameStateRef.current !== 'drawing') return;

    let nearSwarm = false;
    particles.current.forEach((p, idx) => {
      const d = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(y - p.y, 2));
      if (d < 28) nearSwarm = true; // Tightened detection
      if (p.isCollectible && d < 35 && !p.collected) {
        p.collected = true;
        setTotalPurged(prev => prev + 1);
        sounds.playPing(collectedIndices.current.size);
        collectedIndices.current.add(idx);
        setCollectedCount(collectedIndices.current.size);
        const basePoints = 250; // Balanced down
        const multBonus = collectedIndices.current.size * 0.4;
        const totalPoints = Math.floor(basePoints * (1 + multBonus));
        setScore(s => s + totalPoints);
        setMultiplier(1 + multBonus);
      }
    });
    
    if (!nearSwarm) {
      updateGameState('idle');
      sounds.playError();
      sparkPos.current = { x, y };
      errorFrameCount.current = 15; // Trigger laser fault effect
      setPenalties(prev => prev + 1);
      setScore(s => Math.max(0, s - 500)); // Harsher penalty
      setMultiplier(1);
      return;
    }

    laserPath.current.push({ x, y });

    const bx = (bounds.current.left + bounds.current.right) / 2;
    const bracketMargin = 70;
    const bBottom = Math.min(window.innerHeight - 15, bounds.current.bottom + bracketMargin);
    const distB = Math.sqrt(Math.pow(x - bx, 2) + Math.pow(y - bBottom, 2));
    if (distB < 80 && collectedIndices.current.size >= 5) {
      triggerSuccess();
    }
  };

  const updateLaser = () => {
    if (gameStateRef.current === 'drawing' && laserPath.current.length > 0) {
        // Optional: extra laser logic
    }
  };

  const handleMouseUp = () => {
    if (gameStateRef.current === 'drawing') updateGameState('idle');
    shiftMode.current = false;
    // Don't reset laser path here, let it retract in loop
  };

  const triggerSuccess = () => {
    if (gameStateRef.current === 'success' || gameStateRef.current === 'exploding' || gameStateRef.current === 'startup' || gameStateRef.current === 'gameOver') return;

    if (levelRef.current <= 1) {
      // Final iteration completed - stop timer
      timerActive.current = false;
    }

    // IMMEDIATE sync state update to prevent double-firing from fast mouse moves
    updateGameState('success');
    sounds.playSuccess();
    
    // Score calculation (None for tutorial level 0)
    if (levelRef.current > 0) {
      const perfectBonus = penaltiesRef.current === 0 ? 5000 : 0; 
      const bugBonus = collectedIndices.current.size === 8 ? 2500 : 0; 
      
      if (collectedIndices.current.size >= 8) {
        sounds.playAllPurged();
      }
      
      const stabilityBonus = 1000 * levelRef.current;
      const totalBonus = stabilityBonus + perfectBonus + bugBonus;
      scoreRef.current += totalBonus;
      setScore(s => s + totalBonus);
    }

    // Sequence: Success Message -> Explosion -> Transition
    setTimeout(() => {
      setShake(80); 
      sounds.playExplosion();
      updateGameState('exploding');
      particles.current.forEach(p => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 120; // More violent explosion
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
      });

      setTimeout(() => {
        if (levelRef.current === 0) {
          // Tutorial (level 0) succeeded -> transition to Debugging Starts
          startDebugging();
        } else if (levelRef.current <= 1) {
          // Final iteration completed
          setFinalTime(Date.now() - startTime);
          sounds.stopMusic();
          sounds.playWin();
          sounds.startSuccessMusic();
          updateGameState('gameOver');
          if (scoreRef.current > highScore) {
            setHighScore(scoreRef.current);
            localStorage.setItem('syntax-swarm-hs', scoreRef.current.toString());
          }
        } else {
          // Regular countdown iteration
          const nextLevel = levelRef.current - 1;
          levelRef.current = nextLevel;
          setLevel(nextLevel);
          generateTargets(nextLevel, false);
          sounds.playStep();
          updateGameState('idle');
          sounds.updateSwarm(nextLevel);
          setCollectedCount(0);
          collectedIndices.current.clear();
          laserPath.current = [];
        }
      }, 1500); // Wait for explosion particles to clear a bit
    }, 2000); // Show "Brackets Closed" for 2 seconds
  };

  const startGame = () => {
    if (isInitializing) return;
    setIsInitializing(true);
    sounds.playClick();
    
    // Sequence timing
    setTimeout(() => {
      setShowCrash(true);
      sounds.stopMusic();
      sounds.playPanic();
      setShake(25);
      
      setTimeout(() => {
        setIsInitializing(false);
        setShowCrash(false);
        setShake(0);
        setTotalSpawned(0);
        setTotalPurged(0);
        setStartTime(Date.now());
        updateGameState('tutorial');
        generateTargets(0, true);
        sounds.startGameMusic();
      }, 700);
    }, 1800);
  };

  const resetGame = () => {
    sounds.playClick();
    sounds.setMusicPitch(1.0); // Ensure pitch is reset
    setIsCompromised(false);
    updateGameState('tutorial');
    setTotalSpawned(0);
    setTotalPurged(0);
    setStartTime(Date.now());
    levelRef.current = 0;
    setLevel(0);
    setScore(0);
    scoreRef.current = 0;
    setPenalties(0);
    penaltiesRef.current = 0;
    generateTargets(0, true);
    setCollectedCount(0);
    collectedIndices.current.clear();
    laserPath.current = [];
    timerActive.current = false;
    gameTimeRef.current = 0;
    setGameTime(0);
    sounds.startGameMusic();
  };

  const goToTitle = () => {
    sounds.playClick();
    sounds.setMusicPitch(1.0); // Reset pitch
    setIsCompromised(false);
    updateGameState('landing');
    levelRef.current = 0;
    setLevel(0);
    setScore(0);
    scoreRef.current = 0;
    setPenalties(0);
    penaltiesRef.current = 0;
    setCollectedCount(0);
    collectedIndices.current.clear();
    laserPath.current = [];
    timerActive.current = false;
    gameTimeRef.current = 0;
    setGameTime(0);
  };

  return (
    <div 
      className="w-full h-screen bg-[#0c0c0c] overflow-hidden cursor-crosshair touch-none select-none relative font-mono text-white"
      style={{
        transform: shake > 0 ? `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)` : 'none'
      }}
    >
      {/* Crash Overlay */}
      {showCrash && (
        <div className="absolute inset-0 z-[100] bg-black overflow-hidden pointer-events-none flex items-center justify-center">
          {[...Array(30)].map((_, i) => (
             <div 
               key={i} 
               className="absolute bg-[#EA4335] h-[2px] w-full opacity-40 shadow-[0_0_10px_#EA4335]"
               style={{ top: `${Math.random() * 100}%`, left: `${(Math.random() - 0.5) * 50}%` }}
             />
          ))}
          <div className="absolute inset-0 bg-[#EA4335]/10 animate-pulse" />
          <motion.div 
            animate={{ scale: [1, 1.1, 0.9, 1.2, 1], opacity: [1, 0.8, 1] }}
            transition={{ duration: 0.1, repeat: Infinity }}
            className="text-[#EA4335] font-black text-6xl tracking-[0.5em] italic drop-shadow-[0_0_30px_#EA4335]"
          >
            KERNEL_PANIC
          </motion.div>
        </div>
      )}

      {/* Red Warning Vignette & Scanning Lines */}
      {(gameState === 'idle' || gameState === 'drawing') && gameTime > DIFFICULTIES[difficulty].timeLimit - 15000 && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          <motion.div 
              animate={{ 
                opacity: [0.2, 0.6, 0.2],
                backgroundColor: ['rgba(0,0,0,0)', 'rgba(234,67,53,0.2)', 'rgba(0,0,0,0)']
              }}
              transition={{ 
                duration: Math.max(0.2, 0.8 * (1 - (gameTime - (DIFFICULTIES[difficulty].timeLimit - 15000)) / 15000)), 
                repeat: Infinity 
              }}
              className="absolute inset-0 shadow-[inset_0_0_250px_rgba(234,67,53,0.8)]"
          />
          {/* Intense core flash */}
          <motion.div 
              animate={{ 
                opacity: [0, 0.3, 0]
              }}
              transition={{ 
                duration: 0.1, 
                repeat: Infinity,
                repeatType: 'reverse'
              }}
              className="absolute inset-0 bg-red-600/10 mix-blend-overlay"
          />
          <motion.div 
            className="absolute top-0 left-0 right-0 h-[4px] bg-red-600 shadow-[0_0_30px_#EA4335]"
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 1.0, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600 font-black text-9xl opacity-5 select-none pointer-events-none">
            DANGER
          </div>
          <div className="absolute top-5 right-5 text-[#EA4335] font-black text-xs tracking-[0.5em] animate-pulse bg-black/40 px-4 py-2 border border-red-600">
            [ CRITICAL: {Math.ceil((DIFFICULTIES[difficulty].timeLimit - gameTime) / 1000)}s REMAINING ]
          </div>
        </div>
      )}

      {/* Success/Exploding Feedbacks */}
      <AnimatePresence>
        {(gameState === 'success' || gameState === 'exploding') && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[150] flex items-center justify-center pointer-events-none overflow-hidden"
          >
            {/* Flash Effect Only */}
            <motion.div 
               initial={{ scale: 0, opacity: 0 }}
               animate={{ scale: [1, 2.5], opacity: [1, 0] }}
               transition={{ duration: 1.2, ease: "easeOut" }}
               className="absolute w-[600px] h-[600px] border-[30px] border-white/30 rounded-full"
            />
            {gameState === 'exploding' && (
              <motion.div
                initial={{ scale: 1 }}
                animate={{ scale: 1.5, opacity: 0 }}
                className="text-white font-black text-6xl tracking-tighter"
              >
                DECOMPILING...
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {gameState === 'tutorial' && (
        <div className="absolute top-10 right-10 z-20 flex flex-col items-end animate-in fade-in slide-in-from-right duration-700">
            <div className="flex gap-4">
                <button 
                    onClick={startDebugging}
                    className="group relative px-8 py-3 bg-white text-black font-bold uppercase tracking-widest text-[11px] border border-white transition-all cursor-pointer overflow-hidden hover:bg-[#4285F4] hover:text-white"
                >
                    <span className="relative z-10">TERMINATE PROTOCOL</span>
                    <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </button>
            </div>
            <div className="mt-8 text-right max-w-sm">
                <p className="text-white font-black text-2xl mb-2 tracking-tighter italic">NEURAL SYNTAX GUIDE</p>
                <p className="text-gray-500 text-[10px] leading-relaxed tracking-widest uppercase">
                  1. Drag from <span className="text-[#4285F4] font-bold">{"{"}</span> to establish link.<br/>
                  2. Route through <span className="text-white font-bold">SWARM</span> to maintain signal.<br/>
                  3. Purge <span className="text-[#EA4335] font-bold">MIN 5 BUGS</span> (RED) to unlock termination.<br/>
                  4. Connect to <span className="text-[#EA4335] font-bold">{"}"}</span> for system flush.
                </p>
            </div>
        </div>
      )}

      <div className="absolute top-10 left-10 pointer-events-none z-10 transition-opacity duration-500">
        <div className="flex items-baseline gap-4 mb-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-[0.4em] font-bold">{gameState === 'tutorial' ? 'Training Simulation' : 'Active Debug'}</div>
            <div className="text-[10px] text-[#4285F4] font-black animate-pulse">KERNEL_0x{level.toString(16).toUpperCase()}</div>
        </div>
        
        {gameState !== 'startup' && (
          <div className={`${NUMBER_STYLES.find(s => s.id === numberStyle)?.class || 'font-sans font-black'} text-8xl transition-all duration-500 drop-shadow-[0_0_30px_rgba(66,133,244,0.3)] mb-4 flex items-baseline gap-4 ${gameState === 'timeout' ? 'text-red-600' : 'text-white'} ${shake > 10 ? 'animate-pulse scale-110' : ''}`}>
            {level}
            <span className={`text-xs font-normal tracking-[1em] uppercase transition-colors ${gameState === 'timeout' ? 'text-red-800' : 'text-gray-700'}`}>
              {gameState === 'timeout' ? 'SECTOR BREACHED' : (level === 0 ? 'IDLE' : 'STEP')}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 border-l border-white/10 pl-6">
            <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-sm rotate-45 ${collectedCount >= 5 ? 'bg-[#34A853] shadow-[0_0_20px_#34A853]' : 'bg-[#EA4335] shadow-[0_0_15px_#EA4335]'} transition-all duration-500`} />
                <div className="flex flex-col">
                    <div className="text-[11px] text-gray-400 tracking-[0.2em] font-bold uppercase">Bugs Purged: {collectedCount} / 8</div>
                    <div className="text-[8px] text-gray-600 tracking-widest uppercase">{collectedCount >= 5 ? 'TERMINATION UNLOCKED' : 'INSUFFICIENT BUFFER'}</div>
                </div>
            </div>

            {penalties > 0 && (
              <div className="text-[9px] text-[#EA4335] font-black tracking-widest animate-pulse">
                INTEGRITY BREACH: -{penalties * 250} (VOID PERFECT BONUS)
              </div>
            )}
            
            <div className="flex flex-col gap-1">
                <div className="text-[11px] text-gray-500 tracking-tighter uppercase font-bold flex flex-col gap-1">
                    <div className="flex gap-4">
                        Score: <span className="text-white"><Counter value={score} duration={0.3} /></span>
                        {multiplier > 1 && (
                            <span 
                                className="font-black animate-bounce transition-all duration-300"
                                style={{ 
                                    color: multiplier > 2.0 ? '#EA4335' : '#FBBC05',
                                    textShadow: multiplier > 2.0 ? '0 0 30px rgba(234, 67, 53, 0.8)' : '0 0 15px rgba(251, 188, 5, 0.4)',
                                    transform: `scale(${1 + (multiplier - 1) * 0.15})`,
                                    filter: `brightness(${1 + (multiplier - 1) * 0.2})`
                                }}
                            >
                                x{multiplier.toFixed(1)}
                            </span>
                        )}
                    </div>
                    <div className={`text-xs tracking-[0.2em] font-black transition-colors ${gameTime > DIFFICULTIES[difficulty].timeLimit - 15000 ? 'text-red-500 animate-pulse' : 'text-[#4285F4]'}`}>
                        ET: {formatTime(gameTime)} / {formatTime(DIFFICULTIES[difficulty].timeLimit)}
                    </div>
                </div>
                <div className="w-48 h-1 bg-white/5 relative overflow-hidden mb-1">
                    <motion.div 
                        className={`absolute inset-y-0 left-0 transition-colors duration-300 ${gameTime > DIFFICULTIES[difficulty].timeLimit - 15000 ? 'bg-red-500' : 'bg-[#4285F4]'}`} 
                        style={{ width: `${Math.min(100, (gameTime / DIFFICULTIES[difficulty].timeLimit) * 100)}%` }} 
                    />
                </div>
                <div className="w-48 h-0.5 bg-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[#34A853]/40 transition-all duration-1000" style={{ width: `${(collectedCount / 8) * 100}%` }} />
                </div>
            </div>
        </div>
      </div>

      {/* Settings Menu */}
      <div className="absolute bottom-6 left-6 z-40 flex flex-col items-start gap-4">
        {showSettings && (
            <div className="bg-[#0f0f0f]/95 border border-white/5 backdrop-blur-xl p-6 rounded-sm w-72 mb-2 animate-in slide-in-from-bottom-5 duration-300">
                <div className="flex items-center gap-2 mb-6 text-gray-500 uppercase text-[10px] font-bold tracking-[0.3em]">
                    <Settings className="w-3 h-3" /> System Configuration
                </div>

                {/* Sound Volume */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-[10px] text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Volume2 className="w-3 h-3" /> Volume
                        </label>
                        <span className="text-[10px] font-mono text-[#4285F4]">{volume}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="100" value={volume}
                        onChange={(e) => setVolume(parseInt(e.target.value))}
                        className="w-full h-1 bg-white/5 appearance-none rounded-full accent-[#4285F4] cursor-pointer"
                    />
                </div>

                {/* Difficulty */}
                <div className="mb-6">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest block mb-3 flex items-center gap-2">
                        <Cpu className="w-3 h-3" /> Difficulty
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                        {Object.entries(DIFFICULTIES).map(([id, d]) => (
                            <button
                                key={id}
                                onClick={() => {
                                    setDifficulty(id);
                                    sounds.playClick();
                                }}
                                className={`text-[9px] py-2 px-1 border uppercase tracking-tighter transition-all ${
                                    difficulty === id ? 'bg-[#4285F4] border-[#4285F4] text-white' : 'bg-transparent border-white/5 text-gray-600 hover:border-white/20'
                                }`}
                            >
                                {d.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Errativeness Slider */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-[10px] text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Bug className="w-3 h-3" /> Errativeness
                        </label>
                        <span className="text-[10px] font-mono text-[#4285F4]">{errativeness}%</span>
                    </div>
                    <div className="relative pt-1 px-1">
                        <input 
                            type="range" min="1" max="100" value={errativeness} 
                            onChange={(e) => setErrativeness(parseInt(e.target.value))}
                            className="w-full h-1 bg-white/5 appearance-none rounded-full accent-[#4285F4] cursor-pointer"
                        />
                        <div className="flex justify-between mt-2 text-[6px] text-gray-700 uppercase font-black tracking-tighter">
                            <span>Predictable</span>
                            <span>Normal</span>
                            <span>Chaotic</span>
                        </div>
                    </div>
                </div>

                {/* Style */}
                <div className="mb-2">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest block mb-3 flex items-center gap-2">
                        <Type className="w-3 h-3" /> Number Style
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                        {NUMBER_STYLES.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => {
                                    setNumberStyle(s.id);
                                    // Trigger immediate regeneration of targets with new style
                                    numberStyleRef.current = s.id;
                                    generateTargets(levelRef.current);
                                    sounds.playClick();
                                }}
                                className={`text-[9px] py-2 px-2 border uppercase tracking-tighter flex items-center justify-between transition-all ${
                                    numberStyle === s.id ? 'bg-[#34A853] border-[#34A853] text-white' : 'bg-transparent border-white/5 text-gray-600 hover:border-white/20'
                                }`}
                            >
                                {s.name}
                                {numberStyle === s.id && <Check className="w-2 h-2" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}
        
        <button 
            onClick={() => {
                setShowSettings(!showSettings);
                sounds.playClick();
            }}
            className={`p-3 rounded-full border transition-all duration-300 ${
                showSettings ? 'bg-white border-white text-black scale-90' : 'bg-transparent border-white/10 text-white hover:border-white/40 hover:bg-white/5'
            }`}
        >
            <Settings className={`w-5 h-5 ${showSettings ? 'animate-spin-slow' : ''}`} />
        </button>
      </div>

      {/* Return to Title - Global (Hidden during end states for focus) */}
      {gameState !== 'landing' && gameState !== 'timeout' && gameState !== 'gameOver' && (
        <div className="absolute bottom-10 right-10 z-[80] animate-in fade-in slide-in-from-bottom-5 duration-500">
            <button 
                onClick={goToTitle}
                className="group relative px-6 py-3 bg-transparent text-gray-500 font-bold uppercase tracking-widest text-[9px] border border-white/10 transition-all cursor-pointer overflow-hidden hover:border-white/40 hover:text-white"
            >
                <span className="relative z-10">RETURN_TO_TITLE</span>
                <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </button>
        </div>
      )}

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 pointer-events-none z-10 w-full px-10">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full opacity-20" />
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="w-full h-full block"
      />

      {gameState === 'landing' && (
        <div className="absolute inset-0 bg-[#060606] z-[400] flex flex-col items-center justify-between p-6 md:p-10 overflow-hidden">
            {/* Background Data Nodes */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              {[...Array(15)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-[#4285F4] rounded-full"
                  style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                  animate={{ 
                    y: [0, -100, 0],
                    opacity: [0.1, 0.6, 0.1],
                    scale: [1, 2, 1]
                  }}
                  transition={{ 
                    duration: 4 + Math.random() * 6, 
                    repeat: Infinity,
                    delay: Math.random() * 5
                  }}
                />
              ))}
            </div>
            {/* Background Grid Accent */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            
            <div className="relative mb-16 animate-in fade-in slide-in-from-bottom-10 duration-1000 flex flex-col items-center">
                <div className="absolute -inset-20 bg-[#4285F4]/5 blur-[120px] rounded-full animate-pulse" />
                
                <div className="flex items-center gap-6 mb-6 relative">
                    {/* The Scouting Bugs */}
                    {[...Array(bugCount)].map((_, i) => (
                      <ScoutingBug key={i} id={i} />
                    ))}

                    <div className="relative group">
                        <div className="absolute -inset-10 bg-[#4285F4]/10 blur-3xl rounded-full group-hover:bg-[#4285F4]/30 transition-colors duration-1000" />
                        <motion.div
                          animate={isInitializing ? {
                            x: [0, 0, 0],
                            y: [0, 20, 400],
                            rotate: [0, 180, 180],
                            scale: [1, 1.5, 0.5],
                            opacity: [1, 1, 0]
                          } : {}}
                          transition={{ duration: 1.8, times: [0, 0.2, 1], ease: "anticipate" }}
                        >
                          <Bug className={`w-16 h-16 text-[#4285F4] relative z-10 ${isInitializing ? '' : 'animate-bounce'}`} style={{ animationDuration: '3s' }} />
                        </motion.div>
                    </div>
                    <h1 className="text-5xl sm:text-7xl md:text-[8vw] font-black text-white tracking-tighter leading-none select-none drop-shadow-[0_0_50px_rgba(66,133,244,0.4)] flex items-baseline gap-2 group text-center flex-wrap justify-center">
                        <span className="relative">
                            SYNTAX
                            <motion.div 
                                className="absolute -right-2 top-0 bottom-0 w-px bg-[#4285F4] shadow-[0_0_10px_#4285F4]"
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                            />
                        </span>
                        <span className="text-[#4285F4] relative">
                            SWARM
                            <motion.div 
                                className="absolute inset-0 bg-white/10 h-1/2 -skew-y-3"
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            />
                        </span>
                    </h1>
                </div>

                <div className="flex items-center gap-6 text-[#4285F4] font-mono text-[9px] tracking-[0.8em] uppercase opacity-60">
                    <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#4285F4]/30" />
                    Cleanse the compiler. Secure the kernel.
                    <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#4285F4]/30" />
                </div>
            </div>

                <div className="flex flex-col items-center gap-2 mb-8 md:mb-12">
                    <span className="text-[10px] md:text-xs text-gray-600 uppercase tracking-[0.3em] font-bold">Architecture by</span>
                    <span className="text-sm md:text-base text-gray-300 font-medium tracking-[0.1em]">Tanay Pandey</span>
                </div>

                <div className="w-full max-w-sm flex flex-col gap-6">
                    <button 
                        onClick={startGame}
                        disabled={isInitializing}
                        className={`group relative w-full py-6 md:py-8 bg-white hover:bg-[#4285F4] text-black hover:text-white transition-all duration-500 font-bold text-lg md:text-xl tracking-[0.4em] uppercase overflow-hidden ${isInitializing ? 'opacity-50 cursor-wait bg-[#EA4335]' : ''}`}
                    >
                        <div className="relative z-10">{isInitializing ? 'INITIALIZING...' : 'INITIALIZE_CORE'}</div>
                        {!isInitializing && <div className="absolute inset-x-0 bottom-0 h-1 bg-[#4285F4] group-hover:bg-white transition-colors" />}
                        <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>

                    {/* DEBUG BUTTONS - TO BE REMOVED */}
                </div>

            <div className="flex justify-center w-full">
              <button 
                onClick={toggleMute}
                className="group flex items-center justify-center gap-3 px-6 py-3 text-gray-600 hover:text-white transition-all duration-300 uppercase tracking-widest text-[9px] font-bold"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {isMuted ? 'UNMUTE_SYSTEM' : 'MUTE_SYSTEM'}
              </button>
            </div>

            {/* Status Ticker */}
            <div className="absolute bottom-6 left-10 right-10 flex justify-between items-center opacity-20 font-mono text-[8px] tracking-[0.5em] uppercase pointer-events-none">
                <div className="flex items-center gap-4">
                    <div className="w-1 h-1 bg-[#34A853] rounded-full animate-pulse" />
                    System Status: Operational
                </div>
                <div>Root@Kernel: ~ $ Swarm_Detected</div>
            </div>

        </div>
      )}
        {/* System Failure / Danger Screen */}
      {gameState === 'timeout' && (
        <div className="absolute inset-0 bg-[#060000] z-[500] flex flex-col items-center justify-center p-4 md:p-10 overflow-hidden">
            <FailureEffect />
            
            {/* Background Glitch Overlays */}
            <motion.div 
               animate={{ opacity: [0, 0.4, 0, 0.2, 0] }}
               transition={{ duration: 0.1, repeat: Infinity }}
               className="absolute inset-0 bg-red-900/10 pointer-events-none"
            />

            {/* Perimeter Warning Lines */}
            <div className="absolute inset-2 border-2 border-red-900/30 pointer-events-none overflow-hidden">
               <motion.div 
                 animate={{ scale: [1, 1.02, 1] }}
                 transition={{ duration: 0.5, repeat: Infinity }}
                 className="absolute inset-0 border-[20px] border-red-600/5"
               />
               
               {/* Floating Error Labels */}
               {[...Array(8)].map((_, i) => (
                 <motion.div
                   key={i}
                   initial={{ 
                     x: Math.random() * window.innerWidth, 
                     y: Math.random() * window.innerHeight,
                     opacity: 0
                   }}
                   animate={{ 
                     opacity: [0, 1, 0],
                     y: [null, '-=50']
                   }}
                   transition={{ 
                     duration: 1 + Math.random(), 
                     repeat: Infinity,
                     repeatDelay: Math.random() * 2
                   }}
                   className="absolute font-mono text-[8px] md:text-[10px] text-red-500 flex items-center gap-2 whitespace-nowrap bg-black/40 px-2 py-1 border border-red-600/30"
                 >
                   <AlertTriangle className="w-2 h-2" />
                   {['CRITICAL_FAULT', 'TIMEOUT', 'EXCEPTION', 'MEMORY_LEAK', 'KERNEL_PANIC', 'ID_CORRUPTED'][Math.floor(Math.random() * 6)]}
                 </motion.div>
               ))}
            </div>

            <motion.div 
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative z-10 flex flex-col items-center justify-center h-full w-full max-w-5xl text-center py-4 gap-2 md:gap-6 overflow-hidden"
            >
                <div className="flex flex-col items-center gap-1 md:gap-2 w-full">
                    <motion.h2 
                      animate={{ opacity: [0.8, 1, 0.8], scale: [1, 1.01, 1] }}
                      transition={{ duration: 0.1, repeat: Infinity }}
                      className="text-red-600 font-mono text-lg md:text-3xl font-black italic tracking-[0.2em] drop-shadow-[0_0_20px_rgba(153,0,0,0.8)]"
                    >
                      &lt;SYSTEM DANGER /&gt;
                    </motion.h2>

                    <div className="relative mb-2">
                        {/* Fractured Icon */}
                        <motion.div
                          animate={{ 
                            x: [0, -3, 3, 0],
                            y: [0, 1, -1, 0],
                            filter: ['hue-rotate(0deg)', 'hue-rotate(15deg)', 'hue-rotate(-15deg)', 'hue-rotate(0deg)']
                          }}
                          transition={{ duration: 0.08, repeat: Infinity }}
                          className="relative"
                        >
                          <div className="absolute inset-0 bg-red-600/20 blur-3xl rounded-full scale-110" />
                          <div className="relative flex items-center">
                             <XCircle className="w-16 h-16 md:w-32 md:h-32 text-red-700 drop-shadow-[0_0_30px_#990000]" strokeWidth={1} />
                             <div className="absolute inset-0 flex items-center justify-center">
                               <GlitchText text="X" className="text-red-500 text-4xl md:text-6xl font-black" />
                             </div>
                             {/* Cracks/Lines */}
                             <motion.div 
                                animate={{ opacity: [0, 0.8, 0] }}
                                transition={{ duration: 0.04, repeat: Infinity }}
                                className="absolute inset-0 border-t-2 border-red-400/40 rotate-[35deg] translate-y-8 scale-150" 
                             />
                             <motion.div 
                                animate={{ opacity: [0, 0.8, 0], delay: 0.02 }}
                                transition={{ duration: 0.06, repeat: Infinity }}
                                className="absolute inset-0 border-t-2 border-red-500/40 -rotate-[45deg] -translate-y-4 scale-150" 
                             />
                          </div>
                        </motion.div>
                    </div>

                    <div className="relative">
                      <motion.h1 
                        animate={{ x: [0, -1, 1, 0] }}
                        transition={{ duration: 0.1, repeat: Infinity }}
                        className="text-red-600 text-3xl md:text-7xl font-black tracking-[0.2em] uppercase drop-shadow-[0_0_20px_rgba(255,0,0,0.3)] relative"
                      >
                        <span className="relative">
                          GAME OVER
                          {/* More aggressive "Cracked" effect line */}
                          <div className="absolute inset-x-0 top-[40%] h-0.5 bg-[#060000] rotate-3 -translate-y-1/2 scale-x-125" />
                          <div className="absolute inset-x-0 top-[60%] h-px bg-[#060000] -rotate-2 -translate-y-1/2 scale-x-110" />
                          <div className="absolute inset-x-0 top-[30%] h-px bg-red-900/40 rotate-[10deg] -translate-y-1/2" />
                        </span>
                      </motion.h1>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full max-w-2xl mt-4">
                        <div className="flex flex-col items-center justify-center p-3 md:p-6 bg-red-950/40 border border-red-600/40 rounded-sm relative overflow-hidden backdrop-blur-md">
                           <div className="absolute inset-0 pointer-events-none border-x-2 border-red-600/20" />
                           <span className="text-red-500/80 font-mono text-[8px] md:text-sm uppercase tracking-[0.2em] font-bold mb-1">FAILED AT STEP:</span>
                           <span className="text-red-600 font-mono text-2xl md:text-5xl font-black italic">
                             {11 - level} <span className="text-red-900 mx-1 md:mx-2">/</span> 10
                           </span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-3 md:p-6 bg-red-950/40 border border-red-600/40 rounded-sm relative overflow-hidden backdrop-blur-md">
                           <div className="absolute inset-0 pointer-events-none border-x-2 border-red-600/20" />
                           <span className="text-red-500/80 font-mono text-[8px] md:text-sm uppercase tracking-[0.2em] font-bold mb-1">FINAL SCORE:</span>
                           <span className="text-red-600 font-mono text-2xl md:text-5xl font-black italic">
                             <Counter value={score} />
                           </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full mt-4 max-w-2xl">
                    <button 
                        onClick={resetGame}
                        className="flex-1 group relative px-6 py-2 md:py-4 bg-[#ef4444] text-white font-black uppercase tracking-[0.1em] hover:bg-white hover:text-[#ef4444] transition-all duration-300 shadow-2xl active:scale-95 text-[10px] md:text-base border-2 border-[#ef4444]"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 md:w-5 md:h-5 group-hover:rotate-180 transition-transform duration-500" />
                            REINITIALIZE
                        </span>
                    </button>
                    <button 
                        onClick={goToTitle}
                        className="flex-1 group relative px-6 py-2 md:py-4 border-2 border-red-600 text-red-500 font-black uppercase tracking-[0.1em] hover:bg-red-600 hover:text-white transition-all duration-300 shadow-xl active:scale-95 text-[10px] md:text-base"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            <Home className="w-4 h-4 md:w-5 md:h-5" />
                            ROOT_EXIT
                        </span>
                    </button>
                </div>
            </motion.div>
        </div>
      )}

       {/* Success / Game Over Screen */}
      {gameState === 'gameOver' && (
        <div className="absolute inset-0 bg-[#060606] flex items-center justify-center flex-col z-[500] transition-all duration-1000 overflow-hidden p-4 md:p-10">
            <SuccessEffect />

            {/* Floating 'ERR' Bugs disintegrating */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    x: i % 2 === 0 ? -100 : window.innerWidth + 100, 
                    y: Math.random() * window.innerHeight,
                    opacity: 1,
                    scale: 1 
                  }}
                  animate={{ 
                    x: i % 2 === 0 ? window.innerWidth / 4 : window.innerWidth * 0.75,
                    opacity: [1, 0.5, 0],
                    scale: [1, 1.2, 0],
                    rotate: [0, 45, 90]
                  }}
                  transition={{ 
                    duration: 2 + Math.random() * 2, 
                    delay: Math.random() * 1.5,
                    repeat: Infinity,
                    repeatDelay: 5
                  }}
                  className="absolute flex flex-col items-center gap-1"
                >
                  <Bug className="text-red-600 w-8 h-8 md:w-12 md:h-12 drop-shadow-[0_0_15px_rgba(234,67,53,0.5)]" />
                  <span className="text-red-500 font-mono text-[10px] font-bold">ERR</span>
                </motion.div>
              ))}
            </div>

            <motion.div 
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               className="relative z-10 flex flex-col items-center justify-center h-full w-full max-w-6xl px-4 md:px-10 text-center py-2 gap-4 md:gap-6 overflow-y-auto"
            >
                <div className="flex flex-col items-center w-full gap-2 md:gap-4">
                    {/* Icon and Title Group */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-2">
                        <motion.h1 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-green-500 text-3xl sm:text-5xl md:text-6xl font-mono font-black tracking-tighter uppercase drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                        >
                            &lt;Compilation Successfull /&gt;
                        </motion.h1>
                    </div>

                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="flex flex-col gap-1 mb-2"
                    >
                        <div className="text-[#34A853] font-mono text-lg md:text-2xl font-bold tracking-[0.3em] uppercase drop-shadow-[0_0_10px_#34A853]">
                            BUGS PURGED: {totalSpawned > 0 ? Math.round((totalPurged/totalSpawned)*100) : 100}%
                        </div>
                        <div className="text-[#34A853] font-mono text-[8px] md:text-xs tracking-[0.6em] uppercase opacity-80">
                            SYSTEM CLEAN
                        </div>
                    </motion.div>

                    <motion.div 
                        className="text-white text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter leading-none drop-shadow-[0_0_30px_rgba(66,133,244,0.3)] mb-2"
                    >
                        <Counter value={score} duration={2} />
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 w-full max-w-xl">
                        <div className="flex flex-col items-center p-3 md:p-4 border border-white/10 bg-white/5 backdrop-blur-md rounded-lg">
                            <span className="text-gray-400 font-mono text-[8px] md:text-xs uppercase tracking-widest mb-1">Execution Time</span>
                            <span className="text-white font-mono text-lg md:text-2xl font-bold">{(finalTime / 1000).toFixed(2)}s</span>
                        </div>
                        <div className="flex flex-col items-center p-3 md:p-4 border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-md rounded-lg">
                            <span className="text-yellow-500/60 font-mono text-[8px] md:text-xs uppercase tracking-widest mb-1">Peak Core Score</span>
                            <span className="text-yellow-500 font-mono text-lg md:text-2xl font-bold">{highScore.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full mt-2 max-w-3xl">
                    <button 
                        onClick={resetGame}
                        className="flex-1 group relative px-6 py-3 md:py-6 bg-[#34A853] text-white font-black uppercase tracking-[0.1em] md:tracking-[0.3em] hover:bg-white hover:text-[#34A853] transition-all duration-300 shadow-2xl active:scale-95 text-[10px] md:text-lg border-2 md:border-4 border-[#34A853]"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            <RefreshCw className="w-4 h-4 md:w-5 md:h-5 group-hover:rotate-180 transition-transform duration-500" />
                            REINITIALIZE
                        </span>
                    </button>
                    <button 
                        onClick={goToTitle}
                        className="flex-1 group relative px-6 py-3 md:py-6 border-2 md:border-4 border-white text-white font-black uppercase tracking-[0.1em] md:tracking-[0.3em] hover:bg-white hover:text-black transition-all duration-300 shadow-xl active:scale-95 text-[10px] md:text-lg"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            <Home className="w-4 h-4 md:w-5 md:h-5" />
                            ROOT_EXIT
                        </span>
                    </button>
                </div>
            </motion.div>
        </div>
      )}
    </div>
  );
}
