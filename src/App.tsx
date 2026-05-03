import { motion, AnimatePresence } from 'motion/react';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { sounds } from './services/soundService';
import { Settings, Check, Volume2, Cpu, Type, Bug } from 'lucide-react';

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

    return pts;
  }, [id]);

  const pathIndex = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const current = waypoints[pathIndex.current];
      pathIndex.current = (pathIndex.current + 1) % waypoints.length;
      const next = waypoints[pathIndex.current];
      
      const dx = next.x - current.x;
      const dy = next.y - current.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

      setCoords({ x: next.x, y: next.y, rotate: angle });
    }, 2500 + (id * 500)); // Distinct timing per bug

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
        duration: 3, 
        ease: "easeInOut"
      }}
    >
      <motion.div
        animate={{ 
          scale: [1, 1.05, 1],
          opacity: [1, 0.8, 1],
        }}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        <Bug className="w-8 h-8 text-[#4285F4] drop-shadow-[0_0_15px_#4285F4]" />
        
        {/* Minimal trail */}
        <motion.div 
          className="absolute top-1/2 left-1/2 w-4 h-[1px] bg-[#4285F4]/10 -translate-x-1/2"
          animate={{ scaleX: [0, 1.5, 0], opacity: [0, 0.4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(0);
  const [gameState, setGameState] = useState<'landing' | 'tutorial' | 'startup' | 'idle' | 'drawing' | 'exploding' | 'gameOver' | 'success' | 'timeout'>('landing');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('syntax-swarm-hs')) || 0);
  const [collectedCount, setCollectedCount] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [shake, setShake] = useState(0);

  const [penalties, setPenalties] = useState(0);
  const [gameTime, setGameTime] = useState(0);
  const [isCompromised, setIsCompromised] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(30);
  const [bugCount, setBugCount] = useState(1);

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
  const [numberStyle, setNumberStyle] = useState('industrial');
  const [errativeness, setErrativeness] = useState(50);
  const errativenessRef = useRef(50);

  useEffect(() => {
    errativenessRef.current = errativeness;
  }, [errativeness]);

  const [isInitializing, setIsInitializing] = useState(false);
  const [showCrash, setShowCrash] = useState(false);

  // Music & Gameplay lifecycle
  useEffect(() => {
    if (gameState === 'landing') {
      sounds.startTitleMusic();
    } else if (gameState === 'gameOver' || gameState === 'timeout') {
      sounds.stopMusic();
    }
  }, [gameState]);
  
  // Start title music immediately if we land on title
  useEffect(() => {
    if (gameState === 'landing') {
      sounds.startTitleMusic();
    }
  }, []);

  // Timer-based tremor during last 15s
  useEffect(() => {
    if (gameState === 'idle' && gameTime > DIFFICULTIES[difficulty].timeLimit - 15000) {
      const interval = setInterval(() => {
        setShake(s => s < 1 ? 2 : s); 
      }, 400);
      return () => clearInterval(interval);
    }
  }, [gameState, gameTime, difficulty]);
  
  const numberStyleRef = useRef(numberStyle);
  
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
  const gameStateRef = useRef(gameState);
  const levelRef = useRef(level);
  const scoreRef = useRef(score);
  const penaltiesRef = useRef(penalties);

  useEffect(() => {
    gameStateRef.current = gameState;
    levelRef.current = level;
    scoreRef.current = score;
    penaltiesRef.current = penalties;
    numberStyleRef.current = numberStyle;
  }, [gameState, level, score, penalties, numberStyle]);

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
    gameStateRef.current = 'startup';
    setGameState('startup');
    setIsCompromised(false);
    startupTimer.current = 100; 
    
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
      const currentDiff = DIFFICULTIES[difficulty];

      if (timerActive.current) {
        const delta = now - lastTick.current;
        gameTimeRef.current += delta;
        setGameTime(gameTimeRef.current);
        
        const limit = currentDiff.timeLimit;
        const threshold = limit - 15000;
        
        if (gameTimeRef.current > threshold) {
          // Last 15 seconds: Increase pitch 
          const progress = (gameTimeRef.current - threshold) / 15000;
          const pitchFactor = 1.0 + progress * 0.4; // 1.0 to 1.4
          sounds.setMusicPitch(pitchFactor);
        } else {
          sounds.setMusicPitch(1.0);
        }

        // Timeout check
        if (gameTimeRef.current >= limit) {
          timerActive.current = false;
          sounds.stopMusic();
          sounds.playTimeout();
          gameStateRef.current = 'timeout';
          setGameState('timeout');
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
          setGameState('idle');
          setPenalties(0);
          setCollectedCount(0);
          // Start timer and swarm on level 10 after initial startup animation
          if (levelRef.current === 10 && !timerActive.current) {
            timerActive.current = true;
            lastTick.current = performance.now();
            sounds.startSwarm();
            sounds.playStep();
          }
          if (timerActive.current) {
            sounds.updateSwarm(levelRef.current);
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
      setGameState('drawing');
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
      setGameState('idle');
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
    if (gameStateRef.current === 'drawing') setGameState('idle');
    shiftMode.current = false;
    // Don't reset laser path here, let it retract in loop
  };

  const triggerSuccess = () => {
    if (gameStateRef.current === 'success' || gameStateRef.current === 'exploding' || gameStateRef.current === 'startup' || gameStateRef.current === 'gameOver') return;

    if (levelRef.current <= 1) {
      // Final iteration completed - stop timer and swarm
      timerActive.current = false;
      sounds.stopSwarm();
    }

    // IMMEDIATE sync state update to prevent double-firing from fast mouse moves
    gameStateRef.current = 'success';
    setGameState('success');
    sounds.playSuccess();
    
    // Score calculation (None for tutorial level 0)
    if (levelRef.current > 0) {
      const perfectBonus = penaltiesRef.current === 0 ? 5000 : 0; 
      const bugBonus = collectedIndices.current.size === 8 ? 2500 : 0; 
      const stabilityBonus = 1000 * levelRef.current;
      setScore(s => s + stabilityBonus + perfectBonus + bugBonus);
    }

    // Sequence: Success Message -> Explosion -> Transition
    setTimeout(() => {
      setShake(80); 
      sounds.playExplosion();
      gameStateRef.current = 'exploding';
      setGameState('exploding');
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
          sounds.stopMusic();
          sounds.playWin();
          gameStateRef.current = 'gameOver';
          setGameState('gameOver');
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
          gameStateRef.current = 'idle';
          setGameState('idle');
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
      sounds.playError();
      setShake(25);
      
      setTimeout(() => {
        setIsInitializing(false);
        setShowCrash(false);
        setShake(0);
        gameStateRef.current = 'tutorial';
        setGameState('tutorial');
        generateTargets(0, true);
        sounds.startGameMusic();
      }, 700);
    }, 1800);
  };

  const resetGame = () => {
    sounds.playClick();
    sounds.stopSwarm();
    setIsCompromised(false);
    gameStateRef.current = 'tutorial';
    setGameState('tutorial');
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
  };

  const goToTitle = () => {
    sounds.playClick();
    sounds.stopSwarm();
    setIsCompromised(false);
    setGameState('landing');
    gameStateRef.current = 'landing';
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
      {gameState === 'idle' && gameTime > DIFFICULTIES[difficulty].timeLimit - 15000 && (
        <div className="absolute inset-0 pointer-events-none z-50">
          <motion.div 
              animate={{ 
                opacity: [0.1, 0.4, 0.1],
                backgroundColor: ['rgba(0,0,0,0)', 'rgba(234,67,53,0.1)', 'rgba(0,0,0,0)']
              }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="absolute inset-0 shadow-[inset_0_0_200px_rgba(234,67,53,0.6)]"
          />
          <motion.div 
            className="absolute top-0 left-0 right-0 h-[2px] bg-[#EA4335]/30 shadow-[0_0_15px_#EA4335]"
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute top-5 right-5 text-[#EA4335] font-black text-[10px] tracking-[0.5em] animate-pulse">
            [ ALERT: KERNEL_OVERFLOW_IMMINENT ]
          </div>
        </div>
      )}

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
                        Score: <span className="text-white">{score.toLocaleString()}</span>
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
                <div className="w-48 h-0.5 bg-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[#4285F4] transition-all duration-1000" style={{ width: `${(collectedCount / 8) * 100}%` }} />
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

      {/* Return to Title - Global */}
      {gameState !== 'landing' && (
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
        <div className="absolute inset-0 bg-[#060606] z-[60] flex flex-col items-center justify-center p-10 overflow-hidden">
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
                    <h1 className="text-[8vw] font-black text-white tracking-tighter leading-none select-none drop-shadow-[0_0_50px_rgba(66,133,244,0.4)] flex items-baseline gap-2 group">
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

            <div className="flex flex-col items-center gap-12 animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-300">
                <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] text-gray-600 uppercase tracking-[0.3em] font-bold">Architecture by</span>
                    <span className="text-sm text-gray-300 font-medium tracking-[0.1em]">Tanay Pandey</span>
                </div>

                <div className="flex flex-col items-center gap-6">
                    <button 
                        onClick={startGame}
                        disabled={isInitializing}
                        className={`group relative px-20 py-6 bg-white hover:bg-[#4285F4] text-black hover:text-white transition-all duration-500 font-bold text-base tracking-[0.4em] uppercase overflow-hidden ${isInitializing ? 'opacity-50 cursor-wait bg-[#EA4335]' : ''}`}
                    >
                        <div className="relative z-10">{isInitializing ? 'OVERLOADING...' : 'INITIALIZE_CORE'}</div>
                        {!isInitializing && <div className="absolute inset-x-0 bottom-0 h-1 bg-[#4285F4] group-hover:bg-white transition-colors" />}
                    </button>

                    <button 
                      onClick={() => setShowSettings(true)}
                      className="group flex items-center justify-center gap-3 px-6 py-3 text-gray-600 hover:text-white transition-all duration-300 uppercase tracking-widest text-[9px] font-bold"
                    >
                      <Settings className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-500" />
                      Configure Environment
                    </button>
                </div>
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

      {gameState === 'timeout' && (
        <div className="absolute inset-0 bg-[#060606] z-[70] flex flex-col items-center justify-center p-10 overflow-hidden">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.05, 0.15, 0.05] }}
                transition={{ duration: 0.1, repeat: Infinity }}
                className="absolute inset-0 bg-red-900/20 pointer-events-none" 
            />
            
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center relative z-10"
            >
                <div className="text-[#EA4335] text-sm font-bold tracking-[0.5em] mb-8 animate-pulse flex items-center justify-center gap-4">
                    <motion.div 
                        animate={{ 
                            opacity: [1, 0, 1],
                            rotate: [0, 90, 0]
                        }} 
                        transition={{ duration: 0.1, repeat: Infinity }}
                    >
                        <Bug className="w-5 h-5 text-red-500" />
                    </motion.div>
                    CRITICAL_KERNEL_OVERRUN
                    <motion.div 
                        animate={{ 
                            opacity: [1, 0, 1],
                            rotate: [0, -90, 0]
                        }} 
                        transition={{ duration: 0.1, repeat: Infinity, delay: 0.05 }}
                    >
                        <Bug className="w-5 h-5 text-red-500" />
                    </motion.div>
                </div>
                
                <h1 className="text-8xl font-black text-white mb-6 tracking-tighter select-none">
                    SYSTEM <span className="text-[#EA4335] animate-pulse">COMPROMISED</span>
                </h1>
                
                <div className="relative max-w-2xl mx-auto mb-16 h-40 overflow-hidden bg-red-900/10 border border-red-500/20 p-4 font-mono text-[10px] text-red-500 text-left">
                    <motion.div
                        animate={{ y: [0, -200] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    >
                        {[...Array(40)].map((_, i) => (
                            <div key={i} className="flex gap-4 opacity-40">
                                <span> {Math.random().toString(16).slice(2, 10).toUpperCase()} </span>
                                <span> ERR_CODE_{Math.floor(Math.random()*9999)} </span>
                                <span> MEMORY_LEAK_DETECTION </span>
                            </div>
                        ))}
                    </motion.div>
                    <div className="absolute inset-0 bg-gradient-to-b from-[#060606] via-transparent to-[#060606]" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <span className="text-xl font-black bg-black/80 px-4 py-2 border border-red-500 shadow-[0_0_20px_#EA4335]">HALT AT STEP {level}</span>
                    </div>
                </div>
                
                <div className="flex gap-4 justify-center">
                    <button 
                        onClick={resetGame}
                        className="group relative px-12 py-5 bg-[#EA4335] hover:bg-white text-white hover:text-black transition-all duration-300 font-black text-xs tracking-[0.3em] uppercase overflow-hidden shadow-[0_0_30px_rgba(234,67,53,0.3)]"
                    >
                        <div className="relative z-10">RE-INITIALIZE_LINK</div>
                        <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    </button>
                </div>
            </motion.div>

            {/* Glitch Overlay Elements */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute bg-red-600/30 h-px"
                        style={{ 
                            top: `${Math.random() * 100}%`, 
                            left: 0, 
                            right: 0 
                        }}
                        animate={{ 
                            scaleX: [0, 1, 0],
                            opacity: [0, 1, 0],
                            x: [-10, 10, -10]
                        }}
                        transition={{ 
                            duration: 0.2 + Math.random() * 0.3, 
                            repeat: Infinity,
                            delay: Math.random() * 2
                        }}
                    />
                ))}
            </div>
        </div>
      )}

      {gameState === 'gameOver' && (
        <div className="absolute inset-0 bg-[#0c0c0c]/98 flex items-center justify-center flex-col z-30 backdrop-blur-2xl animate-in fade-in duration-1000 overflow-hidden py-10">
            {/* Background Binary Stream */}
            <div className="absolute inset-0 pointer-events-none opacity-5 font-mono text-[10px] grid grid-cols-12 gap-2 p-4 select-none overflow-hidden">
               {[...Array(24)].map((_, col) => (
                  <motion.div 
                    key={col} 
                    className="flex flex-col gap-1 text-[#4285F4]"
                    animate={{ y: [0, -500] }}
                    transition={{ duration: 5 + Math.random() * 5, repeat: Infinity, ease: "linear" }}
                  >
                    {[...Array(100)].map((_, i) => (
                      <span key={i}>{Math.round(Math.random())}</span>
                    ))}
                  </motion.div>
               ))}
            </div>

            {/* Success Background Particles */}
            <div className="absolute inset-0 pointer-events-none opacity-30">
                {[...Array(40)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute bg-[#4285F4] w-1 h-1 rounded-full shadow-[0_0_10px_#4285F4]"
                        style={{ 
                            left: `${Math.random() * 100}%`, 
                            top: `${Math.random() * 100}%` 
                        }}
                        animate={{ 
                            scale: [0, 2, 0],
                            opacity: [0, 0.8, 0],
                            y: [0, -200],
                            x: [0, (Math.random() - 0.5) * 50]
                        }}
                        transition={{ 
                            duration: 2 + Math.random() * 3, 
                            repeat: Infinity,
                            delay: Math.random() * 2
                        }}
                    />
                ))}
            </div>

            {/* Radar Scan Overlay */}
            <motion.div 
              className="absolute inset-0 pointer-events-none z-10 opacity-20"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0deg, #4285F4 20deg, transparent 40deg)',
                maskImage: 'radial-gradient(circle, black, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(circle, black, transparent 70%)'
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            />

            {/* Scanning Line */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-b from-transparent via-[#4285F4]/5 to-transparent h-40 w-full pointer-events-none z-20"
              animate={{ top: ['-20%', '120%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />

            <div className="relative z-20 flex flex-col items-center w-full max-w-5xl px-10 scale-90 md:scale-100">
                <div className="relative mb-12 sm:mb-16">
                    <motion.h1 
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.05 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="text-[10rem] md:text-[14rem] font-black text-white tracking-tighter leading-none select-none absolute -top-12 md:-top-16 left-1/2 -translate-x-1/2 whitespace-nowrap"
                    >
                      SUCCESS
                    </motion.h1>
                    <motion.h1 
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3, duration: 0.8, type: "spring" }}
                      className="text-6xl md:text-9xl font-black text-white tracking-tighter drop-shadow-[0_0_60px_rgba(66,133,244,0.6)] relative z-10 text-center"
                    >
                        KERNEL <span className="text-[#4285F4] animate-pulse">COMPILED</span>
                    </motion.h1>
                </div>
                
                <motion.div 
                   initial={{ scaleX: 0 }}
                   animate={{ scaleX: 1 }}
                   transition={{ delay: 1, duration: 1 }}
                   className="text-[#34A853] tracking-[0.8em] sm:tracking-[1.5em] mb-12 sm:mb-20 uppercase text-[9px] sm:text-[11px] font-bold flex items-center gap-4 border-y border-[#34A853]/20 py-4 px-10 sm:px-20 bg-[#34A853]/5"
                >
                    <span className="w-2 h-2 bg-[#34A853] rounded-full animate-ping" />
                    Stability integrity verified across all sectors
                </motion.div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-12 mb-16 sm:mb-24 w-full">
                    <motion.div 
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 1.3 }}
                      className="text-center group border-l-2 border-white/10 pl-6 sm:pl-10 hover:border-[#4285F4] transition-all duration-500 bg-white/[0.03] p-4 sm:p-6 rounded-r-xl"
                    >
                        <div className="text-gray-600 text-[10px] uppercase tracking-[0.3em] mb-2 sm:mb-4 group-hover:text-[#4285F4] transition-colors font-mono">Calculated Stability</div>
                        <div className="text-5xl md:text-7xl text-white font-black tracking-tighter">{score.toLocaleString()}</div>
                    </motion.div>
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 1.5 }}
                      className="text-center group border-l-2 border-white/10 pl-6 sm:pl-10 hover:border-[#34A853] transition-all duration-500 bg-white/[0.03] p-4 sm:p-6 rounded-r-xl"
                    >
                        <div className="text-gray-600 text-[10px] uppercase tracking-[0.3em] mb-2 sm:mb-4 group-hover:text-[#34A853] transition-colors font-mono">Execution Time</div>
                        <div className="text-5xl md:text-7xl text-white font-black tracking-tighter">{formatTime(gameTime)}</div>
                    </motion.div>
                    <motion.div 
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 1.7 }}
                      className="text-center group border-l-2 border-white/10 pl-6 sm:pl-10 hover:border-[#FBBC05] transition-all duration-500 bg-white/[0.03] p-4 sm:p-6 rounded-r-xl"
                    >
                        <div className="text-gray-600 text-[10px] uppercase tracking-[0.3em] mb-2 sm:mb-4 group-hover:text-[#FBBC05] transition-colors font-mono">Historical Build</div>
                        <div className="text-5xl md:text-7xl text-[#FBBC05] font-black tracking-tighter">{highScore.toLocaleString()}</div>
                    </motion.div>
                </div>

                <motion.button 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 2, duration: 0.5 }}
                    onClick={resetGame}
                    className="group relative px-16 sm:px-24 py-8 sm:py-10 bg-white text-black font-black uppercase tracking-[0.4em] hover:bg-[#4285F4] hover:text-white transition-all duration-700 cursor-pointer overflow-hidden shadow-[0_20px_80px_rgba(66,133,244,0.3)] hover:scale-105 active:scale-95"
                >
                    <span className="relative z-10 text-lg sm:text-2xl">RE-INITIALIZE KERNEL</span>
                    <div className="absolute inset-0 bg-[#4285F4] translate-y-full group-hover:translate-y-0 transition-transform duration-500 cubic-bezier(0.19, 1, 0.22, 1)" />
                </motion.button>
            </div>
        </div>
      )}
    </div>
  );
}
