import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Swords, Laugh, Brain, Sparkles, RefreshCcw, Zap, Trophy, PenLine, LayoutGrid } from 'lucide-react';
import Anthropic from '@anthropic-ai/sdk';

type GameState = 'input' | 'reveal' | 'loading' | 'result';
type Mode = 'Realistic' | 'Funny' | 'Strategic';
type BattleWinner = 'player1' | 'player2' | 'tie';
type AppVersion = 'raw' | 'curated';

interface BattleResult {
  winner: BattleWinner;
  winning_concept: string;
  battle_title: string;
  explanation: string;
  reasons: string[];
}

interface Round extends BattleResult {
  player1: string;
  player2: string;
  modifier?: string;
  timestamp: number;
}

const CLAUDE_MODEL = 'claude-haiku-4-5';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
  dangerouslyAllowBrowser: true,
});

const LOADING_STATUSES = [
  'Consulting the AI Gods...',
  'Calculating attack vectors...',
  'Weighing strategic options...',
  'Simulating chaos...',
  'Consulting the logic cores...',
  'Resolving paradoxes...',
];

const CATEGORIES: Record<string, string[]> = {
  'Animals': [
    'Lion', 'Grizzly Bear', 'Great White Shark', 'Gorilla', 'T-Rex',
    'Saltwater Crocodile', 'Elephant', 'Cape Buffalo', 'Polar Bear',
    'Komodo Dragon', 'Honey Badger', 'Hippo', 'Wolverine', 'Bull Moose', 'Anaconda',
  ],
  'Natural Disasters': [
    'EF5 Tornado', 'Mega-Tsunami', 'Magnitude 9 Earthquake', 'Supervolcano',
    'Category 5 Hurricane', 'Solar Flare', 'Wildfire', 'Avalanche', 'Flash Flood', 'Blizzard',
  ],
  'Superheroes': [
    'Superman', 'Thor', 'Hulk', 'Spider-Man', 'Batman', 'Wonder Woman',
    'Iron Man', 'Black Panther', 'Doctor Strange', 'Wolverine', 'The Flash', 'Aquaman',
  ],
  'Supervillains': [
    'Thanos', 'Joker', 'Darth Vader', 'Magneto', 'Lex Luthor',
    'Doctor Doom', 'Loki', 'Venom', 'Ultron', 'Galactus', 'Apocalypse',
  ],
  'Mythological Creatures': [
    'Dragon', 'Kraken', 'Phoenix', 'Minotaur', 'Hydra', 'Medusa',
    'Chimera', 'Basilisk', 'Griffin', 'Cerberus', 'Cyclops', 'Leviathan',
  ],
  'Historical Warriors': [
    'Spartan Soldier', 'Viking Berserker', 'Samurai', 'Roman Legionary',
    'Mongol Horseman', 'Ninja', 'Knight Templar', 'Aztec Eagle Warrior',
    'Zulu Warrior', 'Pirate Captain',
  ],
  'Movie Monsters': [
    'Godzilla', 'King Kong', 'Xenomorph (Alien)', 'Predator', 'The Terminator',
    'Jaws', 'Pennywise', "Frankenstein's Monster", 'Dracula', 'King Ghidorah',
  ],
  'Foods': [
    'Ghost Pepper', 'Wedding Cake', 'Gas Station Sushi', 'Deep-Dish Pizza',
    'A Single Grape', 'Fermented Shark', 'Instant Ramen',
    "World's Hottest Burrito", "Grandma's Meatloaf", 'Candy Corn',
  ],
  'Household Objects': [
    'Roomba', 'Ceiling Fan', 'Garden Hose', 'Toaster', 'Microwave',
    'Lawn Mower', 'Power Drill', 'Blender', 'Leaf Blower', 'Smart Fridge',
  ],
};

const WILDCARDS = [
  "...but it's 3am",
  '...underwater',
  '...in space',
  '...after eating Chipotle',
  '...with no sleep for 48 hours',
  '...in a library (must be completely silent)',
  '...on a Monday morning',
  '...wearing Crocs',
  '...with a head cold',
  '...in IKEA',
  '...during a fire drill',
  '...with 10% battery remaining',
  '...fueled purely by spite',
  '...on their lunch break',
  '...in a Walmart parking lot at midnight',
  '...right after leg day',
  '...in slow motion',
  '...during Mercury retrograde',
  '...in the metaverse',
  '...after watching too much YouTube',
];

const DEFAULT_CAT = Object.keys(CATEGORIES)[0];

async function callClaude(prompt: string, temperature: number): Promise<string> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}

function parseJSON<T>(text: string): T | null {
  try { return JSON.parse(text.trim()) as T; } catch { /* */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]) as T; } catch { /* */ } }
  return null;
}

async function decideBattle(p1: string, p2: string, mode: Mode, modifier?: string): Promise<BattleResult> {
  if (p1.trim().toLowerCase() === p2.trim().toLowerCase()) {
    return {
      winner: 'tie',
      winning_concept: 'Nobody',
      battle_title: 'The Mirror Match',
      explanation: `Both fighters entered "${p1}" -- when you fight your own reflection, nobody wins.`,
      reasons: ['Identical concepts', 'Perfect stalemate'],
    };
  }

  const modLine = modifier ? `\nContext modifier: Both combatants are affected by this condition: ${modifier}` : '';

  const judgePrompt = `You are a decisive battle judge. YOU MUST PICK A WINNER -- ties are forbidden.

Player 1: ${p1}
Player 2: ${p2}
Battle Mode: ${mode}${modLine}

Mode rules:
- Realistic: judge by real-world physical and logical properties
- Funny: judge by absurdist comedic logic
- Strategic: judge by intellectual and tactical superiority

Output ONLY valid JSON with no extra text:
{"winner":"player1","reason_tags":["reason 1","reason 2","reason 3"]}

The winner field must be exactly "player1" or "player2".`;

  const judgeText = await callClaude(judgePrompt, 0.3);
  const judgeResult = parseJSON<{ winner: string; reason_tags: string[] }>(judgeText);

  const winner: BattleWinner = judgeResult?.winner === 'player2' ? 'player2' : 'player1';
  const winning_concept = winner === 'player1' ? p1 : p2;
  const losing_concept = winner === 'player1' ? p2 : p1;
  const reasons = judgeResult?.reason_tags ?? [];

  const commentatorModLine = modifier ? `\nContext modifier: ${modifier} -- weave this into the narrative` : '';

  const commentatorPrompt = `You are an entertaining battle commentator.

Player 1: ${p1}
Player 2: ${p2}
Winner: ${winning_concept}
Loser: ${losing_concept}
Mode: ${mode}
Key Reasons: ${reasons.join(', ')}${commentatorModLine}

Write how ${winning_concept} defeated ${losing_concept}. Match the tone:
- Realistic: factual and vivid
- Funny: absurd and hilarious
- Strategic: analytical and tactical

2-3 punchy sentences. Be specific about HOW the winner won.

Output ONLY valid JSON with no extra text:
{"battle_title":"A Short Catchy Headline","explanation":"Your explanation here."}`;

  const commentatorText = await callClaude(commentatorPrompt, 0.7);
  const commentatorResult = parseJSON<{ battle_title: string; explanation: string }>(commentatorText);

  return {
    winner,
    winning_concept,
    battle_title: commentatorResult?.battle_title ?? `${winning_concept} Wins!`,
    explanation: commentatorResult?.explanation ?? `${winning_concept} emerged victorious over ${losing_concept}.`,
    reasons,
  };
}

// ── Components ───────────────────────────────────────────────────────────────

function BackgroundGrid() {
  return (
    <div className="bg-grid">
      <div className="bg-grid-pattern" />
      <motion.div className="bg-blob bg-blob-blue" animate={{ scale: [1, 1.1, 1], opacity: [0.12, 0.22, 0.12] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="bg-blob bg-blob-rose" animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.18, 0.1] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
    </div>
  );
}

function ChaosReveal({ modifier, onAdvance }: { modifier: string; onAdvance: () => void }) {
  useEffect(() => {
    const t = setTimeout(onAdvance, 2600);
    return () => clearTimeout(t);
  }, [onAdvance]);

  return (
    <div className="reveal-phase">
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
        className="reveal-badge"
      >
        <Zap size={28} className="reveal-zap" />
        <span>CHAOS UNLEASHED</span>
        <Zap size={28} className="reveal-zap" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.4, duration: 0.7, delay: 0.35 }}
        className="reveal-modifier-text"
      >
        {modifier}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="reveal-sub"
      >
        Prepare yourselves...
      </motion.div>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 2.6, ease: 'linear', delay: 0 }}
        className="reveal-progress"
      />
    </div>
  );
}

function BattleSimulation({ conceptA, conceptB }: { conceptA: string; conceptB: string }) {
  const [healthA, setHealthA] = useState(80);
  const [healthB, setHealthB] = useState(80);
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    const h = setInterval(() => {
      setHealthA(p => Math.max(30, Math.min(100, p + Math.random() * 30 - 15)));
      setHealthB(p => Math.max(30, Math.min(100, p + Math.random() * 30 - 15)));
    }, 800);
    const s = setInterval(() => setStatusIdx(p => (p + 1) % LOADING_STATUSES.length), 1500);
    return () => { clearInterval(h); clearInterval(s); };
  }, []);

  return (
    <div className="sim-container">
      <div className="sim-health-row">
        <div className="sim-concept sim-concept-a">
          <span className="sim-name sim-name-a">{conceptA.substring(0, 20)}</span>
          <div className="sim-health-bar">
            <motion.div className="sim-fill sim-fill-a" animate={{ width: `${healthA}%` }} transition={{ type: 'spring', bounce: 0.5 }} />
          </div>
        </div>
        <motion.div className="sim-vs" animate={{ scale: [1, 1.3, 1], rotate: [-10, 10, -10] }} transition={{ duration: 0.6, repeat: Infinity }}>
          <Zap size={26} className="zap-icon" />
        </motion.div>
        <div className="sim-concept sim-concept-b">
          <span className="sim-name sim-name-b">{conceptB.substring(0, 20)}</span>
          <div className="sim-health-bar">
            <motion.div className="sim-fill sim-fill-b" animate={{ width: `${healthB}%` }} transition={{ type: 'spring', bounce: 0.5 }} />
          </div>
        </div>
      </div>
      <div className="sim-status">
        <motion.div className="sim-spinner" animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
        <motion.p className="sim-status-text" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.5, repeat: Infinity }}>
          {LOADING_STATUSES[statusIdx]}
        </motion.p>
      </div>
    </div>
  );
}

function ModeButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`mode-btn${active ? ' mode-btn-active' : ''}`}>
      {active && <motion.div layoutId="mode-bg" className="mode-btn-bg" transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} />}
      <span className="mode-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function VersionTabs({ version, onChange }: { version: AppVersion; onChange: (v: AppVersion) => void }) {
  return (
    <div className="version-tabs">
      {(['raw', 'curated'] as AppVersion[]).map(v => (
        <button type="button" key={v} onClick={() => onChange(v)} className={`version-tab${version === v ? ' version-tab-active' : ''}`}>
          {version === v && <motion.div layoutId="version-tab-bg" className="version-tab-bg" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
          <span className="version-tab-icon">{v === 'raw' ? <PenLine size={15} /> : <LayoutGrid size={15} />}</span>
          <span>{v === 'raw' ? 'Raw' : 'Curated'}</span>
        </button>
      ))}
    </div>
  );
}

function CuratedInput({
  cat1, setCat1, sel1, setSel1,
  cat2, setCat2, sel2, setSel2,
}: {
  cat1: string; setCat1: (v: string) => void; sel1: string; setSel1: (v: string) => void;
  cat2: string; setCat2: (v: string) => void; sel2: string; setSel2: (v: string) => void;
}) {
  const handleCat1Change = (cat: string) => { setCat1(cat); setSel1(CATEGORIES[cat][0]); };
  const handleCat2Change = (cat: string) => { setCat2(cat); setSel2(CATEGORIES[cat][0]); };

  return (
    <div className="curated-wrap">
      <div className="curated-cols">
        <div className="curated-col">
          <span className="curated-col-label curated-col-label-a">Player 1</span>
          <select title="Player 1 category" className="battle-select battle-select-cat battle-select-a" value={cat1} onChange={e => handleCat1Change(e.target.value)}>
            {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select title="Player 1 concept" className="battle-select battle-select-concept battle-select-a" value={sel1} onChange={e => setSel1(e.target.value)}>
            {CATEGORIES[cat1].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="curated-vs">
          <span className="vs-text">VS</span>
        </div>

        <div className="curated-col">
          <span className="curated-col-label curated-col-label-b">Player 2</span>
          <select title="Player 2 category" className="battle-select battle-select-cat battle-select-b" value={cat2} onChange={e => handleCat2Change(e.target.value)}>
            {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select title="Player 2 concept" className="battle-select battle-select-concept battle-select-b" value={sel2} onChange={e => setSel2(e.target.value)}>
            {CATEGORIES[cat2].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [gameState, setGameState] = useState<GameState>('input');
  const [version, setVersion] = useState<AppVersion>('raw');

  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');

  const [cat1, setCat1] = useState(DEFAULT_CAT);
  const [sel1, setSel1] = useState(CATEGORIES[DEFAULT_CAT][0]);
  const [cat2, setCat2] = useState(DEFAULT_CAT);
  const [sel2, setSel2] = useState(CATEGORIES[DEFAULT_CAT][0]);

  const [mode, setMode] = useState<Mode>('Realistic');
  const [wantsChaos, setWantsChaos] = useState(false);
  const [revealModifier, setRevealModifier] = useState('');

  const [fightConcept1, setFightConcept1] = useState('');
  const [fightConcept2, setFightConcept2] = useState('');
  const [currentResult, setCurrentResult] = useState<BattleResult | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState('');
  const [streak, setStreak] = useState(0);
  const [lastWinner, setLastWinner] = useState<BattleWinner | null>(null);
  const [isHoveringFight, setIsHoveringFight] = useState(false);

  const pendingModifier = useRef('');

  const totalScore = useMemo(() => rounds.reduce(
    (acc, r) => {
      if (r.winner === 'player1') acc.player1++;
      else if (r.winner === 'player2') acc.player2++;
      else acc.ties++;
      return acc;
    },
    { player1: 0, player2: 0, ties: 0 }
  ), [rounds]);

  const executeBattle = useCallback(async (p1: string, p2: string, modifier: string) => {
    setGameState('loading');
    try {
      const result = await decideBattle(p1, p2, mode, modifier || undefined);
      setCurrentResult(result);
      setRounds(prev => [{ ...result, player1: p1, player2: p2, modifier: modifier || undefined, timestamp: Date.now() }, ...prev]);
      if (result.winner === 'tie') { setStreak(0); setLastWinner(null); }
      else if (result.winner === lastWinner) setStreak(s => s + 1);
      else { setStreak(1); setLastWinner(result.winner); }
      setGameState('result');
    } catch (err) {
      let msg = 'Something went wrong.';
      if (err instanceof Anthropic.AuthenticationError) {
        msg = 'Invalid API key. Check your VITE_ANTHROPIC_API_KEY in .env.';
      } else if (err instanceof Anthropic.RateLimitError) {
        msg = 'Rate limited by Anthropic. Wait a moment and try again.';
      } else if (err instanceof Anthropic.APIError) {
        msg = `Anthropic API error (${err.status}): ${err.message}`;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      setGameState('input');
    }
  }, [mode, lastWinner]);

  const handleRevealAdvance = useCallback(() => {
    executeBattle(fightConcept1, fightConcept2, pendingModifier.current);
  }, [executeBattle, fightConcept1, fightConcept2]);

  const handleBattle = async () => {
    const p1 = version === 'raw' ? player1 : sel1;
    const p2 = version === 'raw' ? player2 : sel2;
    if (!p1.trim() || !p2.trim()) {
      setError('We need two champions for a battle.');
      return;
    }
    setError('');
    setFightConcept1(p1);
    setFightConcept2(p2);

    if (wantsChaos) {
      const mod = WILDCARDS[Math.floor(Math.random() * WILDCARDS.length)];
      pendingModifier.current = mod;
      setRevealModifier(mod);
      setGameState('reveal');
    } else {
      pendingModifier.current = '';
      executeBattle(p1, p2, '');
    }
  };

  const resetGame = () => {
    setPlayer1('');
    setPlayer2('');
    setCurrentResult(null);
    setError('');
    setRevealModifier('');
    pendingModifier.current = '';
    setGameState('input');
  };

  return (
    <main className="page">
      <BackgroundGrid />
      <div className="game-shell">

        {rounds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="scoreboard">
            <div className="score-card"><span className="score-label">Player 1</span><span className="score-value score-blue">{totalScore.player1}</span></div>
            <div className="score-card"><span className="score-label">Ties</span><span className="score-value score-dim">{totalScore.ties}</span></div>
            <div className="score-card"><span className="score-label">Player 2</span><span className="score-value score-rose">{totalScore.player2}</span></div>
            <div className="score-card score-streak"><span className="score-label">Streak</span><span className="score-value">{streak} 🔥</span></div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {gameState === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="input-phase"
            >
              <div className="title-area">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }} className="title-icon-wrap">
                  <Flame size={36} className="title-icon" />
                </motion.div>
                <h1 className="title-text">VERSUS</h1>
                <p className="title-sub">Define your concepts. Choose an arena. Watch them clash.</p>
              </div>

              {/* Step 1: Arena + Chaos */}
              <div className="arena-card">
                <p className="arena-card-label">Step 1 — Choose Your Arena</p>
                <div className="mode-row">
                  <ModeButton active={mode === 'Realistic'} onClick={() => setMode('Realistic')} icon={<Swords size={17} />} label="Realistic" />
                  <ModeButton active={mode === 'Funny'} onClick={() => setMode('Funny')} icon={<Laugh size={17} />} label="Funny" />
                  <ModeButton active={mode === 'Strategic'} onClick={() => setMode('Strategic')} icon={<Brain size={17} />} label="Strategic" />
                </div>
                <div className="chaos-toggle-section">
                  <div className="chaos-toggle-row">
                    <div className="chaos-toggle-info">
                      <span className="chaos-toggle-title"><Sparkles size={15} /> Add Chaos?</span>
                      <span className="chaos-recommended-badge">RECOMMENDED</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      title="Toggle chaos modifier"
                      aria-checked={wantsChaos}
                      className={`chaos-toggle${wantsChaos ? ' chaos-toggle-on' : ''}`}
                      onClick={() => setWantsChaos(v => !v)}
                    >
                      <motion.span
                        className="chaos-toggle-thumb"
                        layout
                        transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
                      />
                    </button>
                  </div>
                  <p className="chaos-toggle-desc">A random condition will be dramatically revealed when the battle starts</p>
                </div>
              </div>

              {/* Step 2: Combatants */}
              <div className="input-card">
                <p className="input-card-label">Step 2 — Choose Your Combatants</p>
                <VersionTabs version={version} onChange={v => { setVersion(v); setError(''); }} />

                <AnimatePresence mode="wait">
                  {version === 'raw' ? (
                    <motion.div key="raw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      <div className="concepts-row">
                        <div className="input-group">
                          <div className="input-glow input-glow-a" />
                          <div className="input-box input-box-a">
                            <input className="concept-input" placeholder="e.g. A Gorilla" maxLength={40} value={player1} onChange={e => setPlayer1(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleBattle()} />
                            <span className="input-label input-label-a">Player 1</span>
                          </div>
                        </div>
                        <div className="vs-badge"><span className="vs-text">VS</span></div>
                        <div className="input-group">
                          <div className="input-glow input-glow-b" />
                          <div className="input-box input-box-b">
                            <input className="concept-input" placeholder="e.g. A Grizzly Bear" maxLength={40} value={player2} onChange={e => setPlayer2(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleBattle()} />
                            <span className="input-label input-label-b">Player 2</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="curated" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      <CuratedInput cat1={cat1} setCat1={setCat1} sel1={sel1} setSel1={setSel1} cat2={cat2} setCat2={setCat2} sel2={sel2} setSel2={setSel2} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="error-msg">
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button type="button" className="fight-btn" onClick={handleBattle} onMouseEnter={() => setIsHoveringFight(true)} onMouseLeave={() => setIsHoveringFight(false)}>
                  <span>INITIATE BATTLE</span>
                  <motion.span animate={isHoveringFight ? { rotate: [0, -15, 15, -15, 0], scale: 1.2 } : {}} transition={{ duration: 0.5 }} style={{ display: 'flex' }}>
                    <Sparkles size={22} />
                  </motion.span>
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'reveal' && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
              transition={{ duration: 0.4 }}
              className="reveal-wrap"
            >
              <ChaosReveal modifier={revealModifier} onAdvance={handleRevealAdvance} />
            </motion.div>
          )}

          {gameState === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
              transition={{ duration: 0.5 }}
              className="loading-phase"
            >
              <BattleSimulation conceptA={fightConcept1} conceptB={fightConcept2} />
              {revealModifier && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="loading-modifier"
                >
                  <Sparkles size={14} /> {revealModifier}
                </motion.div>
              )}
            </motion.div>
          )}

          {gameState === 'result' && currentResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0.4, duration: 0.8 }}
              className="result-phase"
            >
              <div className="result-header">
                <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.6, delay: 0.2 }} className="trophy-wrap">
                  <Trophy size={46} />
                </motion.div>
                <div className="winner-name-wrap">
                  <motion.h2 initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', bounce: 0.2, delay: 0.3 }} className="winner-name">
                    {currentResult.winning_concept}
                  </motion.h2>
                </div>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="winner-sub">
                  {currentResult.winner === 'tie' ? 'A Perfect Stalemate' : 'Emerged Victorious'}
                </motion.p>
              </div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="result-card">
                <div className="result-card-glow result-glow-amber" />
                <div className="result-card-glow result-glow-blue" />
                <h3 className="result-title">"{currentResult.battle_title}"</h3>
                <div className="result-divider" />
                {revealModifier && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.65 }} className="result-modifier">
                    <Sparkles size={13} /> {revealModifier}
                  </motion.div>
                )}
                <p className="result-explanation">{currentResult.explanation}</p>
                {currentResult.reasons.length > 0 && (
                  <div className="decisive-factors">
                    <h4 className="factors-heading"><Brain size={15} /> Decisive Factors</h4>
                    <div className="factors-list">
                      {currentResult.reasons.map((r, i) => (
                        <motion.span key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8 + i * 0.1 }} className="factor-tag">{r}</motion.span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} onClick={resetGame} className="new-battle-btn">
                <RefreshCcw size={22} /><span>NEW BATTLE</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {rounds.length > 0 && (
          <div className="history-section">
            <h3 className="history-heading">Battle History</h3>
            <div className="history-grid">
              {rounds.map((round, idx) => (
                <motion.article key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx === 0 ? 0.3 : 0 }} className={`history-item history-${round.winner}`}>
                  <div className="h-time">{new Date(round.timestamp).toLocaleTimeString()}</div>
                  <div className="h-matchup">{round.player1} vs {round.player2}</div>
                  <div className="h-winner">{round.winner === 'tie' ? 'Tie' : round.winner === 'player1' ? 'P1 Wins' : 'P2 Wins'}</div>
                  <div className="h-title">"{round.battle_title}"</div>
                  {round.modifier && <div className="h-modifier">{round.modifier}</div>}
                </motion.article>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
