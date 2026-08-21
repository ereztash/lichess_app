import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Clipboard, FileUp, FlipVertical2, Focus, Link2, Plus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChessBoard } from "@/components/ChessBoard";
import { EvaluationBar } from "@/components/EvaluationBar";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { LichessLayersPanel } from "@/components/LichessLayersPanel";
import { MoveTimeline } from "@/components/MoveTimeline";
import { buildHistory, DEFAULT_PGN, INITIAL_FEN, type GameSnapshot, type Orientation, uciToSquares } from "@/lib/game-data";
import { StockfishClient, type EngineLine, type EngineStatus } from "@/lib/stockfish";
import { startLogin } from "@/const";

type AnalysisSource = "imported" | "live";
const FALLBACK: EngineLine = { scoreCp: 42, depth: 14, pv: ["d2d4", "e5d4", "f3d4"], bestMove: "d2d4" };
const INITIAL_STATUS: EngineStatus = { mode: "loading", detail: "מכין מנוע" };
function snapshot(game: Chess, move: { san: string; from: string; to: string; color: "w" | "b" }, ply: number): GameSnapshot { return { ply, san: move.san, from: move.from, to: move.to, color: move.color, fen: game.fen() }; }

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [history, setHistory] = useState<GameSnapshot[]>(() => buildHistory(DEFAULT_PGN));
  const [currentPly, setCurrentPly] = useState(12);
  const [orientation, setOrientation] = useState<Orientation>("w");
  const [selectedSquare, setSelectedSquare] = useState<string>();
  const [analysis, setAnalysis] = useState<EngineLine>(FALLBACK);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(INITIAL_STATUS);
  const [pgnInput, setPgnInput] = useState(DEFAULT_PGN);
  const [showPgn, setShowPgn] = useState(false);
  const [source, setSource] = useState<AnalysisSource>("imported");
  const [notice, setNotice] = useState("הדגמה נטענה — בחרו מהלך או נתחו את העמדה.");
  const engineRef = useRef<StockfishClient | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeMove = currentPly >= 0 ? history[currentPly] : undefined;
  const activeFen = activeMove?.fen ?? INITIAL_FEN;
  const activeGame = useMemo(() => new Chess(activeFen), [activeFen]);
  const board = activeGame.board();
  const sideToMove = activeGame.turn() === "w" ? "לבן" : "שחור";
  const material = useMemo(() => { const values: Record<string, number> = { p:1,n:3,b:3,r:5,q:9,k:0 }; return board.flat().reduce((t,piece)=>{if(piece)t[piece.color==="w"?"white":"black"]+=values[piece.type];return t;},{white:0,black:0}); }, [board]);
  const legalTargets = useMemo(() => { if(!selectedSquare)return []; try{return activeGame.moves({square:selectedSquare as never,verbose:true}).map(m=>m.to)}catch{return []} }, [activeGame, selectedSquare]);
  const runAnalysis = useCallback(async()=>{try{const line=await engineRef.current?.analyze(activeFen,14);if(line?.pv.length)setAnalysis(line)}catch(error){if(error instanceof Error&&error.message!=="Analysis superseded")setEngineStatus({mode:"error",detail:"Stockfish לא החזיר קו חדש."})}},[activeFen]);
  useEffect(()=>{const client=new StockfishClient(setEngineStatus);engineRef.current=client;client.start().catch(()=>undefined);return()=>client.dispose()},[]);
  useEffect(()=>{setSelectedSquare(undefined);void runAnalysis()},[activeFen,runAnalysis]);
  const commitMove=useCallback((from:string,to:string)=>{const game=new Chess(activeFen);try{const move=game.move({from,to,promotion:"q"});setHistory(prev=>[...prev.slice(0,currentPly+1),snapshot(game,move,currentPly+1)]);setCurrentPly(currentPly+1);setNotice(`${move.san} נרשם.`)}catch{setNotice("המהלך אינו חוקי בעמדה זו.")}},[activeFen,currentPly]);
  const importPgn=(pgn:string)=>{try{const loaded=buildHistory(pgn);if(!loaded.length)throw new Error("empty");setHistory(loaded);setCurrentPly(loaded.length-1);setPgnInput(pgn);setShowPgn(false);setSource("imported");setNotice(`נטענו ${loaded.length} חצאי־מהלכים.`)}catch{setNotice("לא הצלחתי לקרוא את ה־PGN.")}};
  const newGame=()=>{setHistory([]);setCurrentPly(-1);setPgnInput("");setSource("live");setNotice("משחק חדש מוכן. לבן מתחיל.")};
  const applySuggestion=()=>{const move=uciToSquares(analysis.bestMove);if(move)commitMove(move.from,move.to)};
  const openLichess=()=>{if(!isAuthenticated)startLogin();else setNotice("Lichess מחובר — שכבות הניתוח זמינות מימין.")};
  return <main className="studio-shell" dir="rtl"><header className="studio-header"><div className="brand-lockup"><div className="brand-mark">♞</div><div><p className="brand-name">CHESS STUDIO</p><span>STOCKFISH · ANALYSIS</span></div></div><div className="header-reading"><span>תור</span><b>{sideToMove}</b></div><div className="header-actions"><Button className="primary-control" onClick={runAnalysis} disabled={engineStatus.mode==="thinking"}><Focus size={16}/> נתח עכשיו</Button><button className="icon-control" onClick={()=>setOrientation(v=>v==="w"?"b":"w")}><FlipVertical2 size={17}/></button></div></header><section className="workbench"><aside className="control-rail"><div className="rail-label">כלי עבודה</div><button className="rail-button prominent" onClick={newGame}><Plus size={18}/><span>משחק חדש</span></button><button className="rail-button" onClick={()=>setShowPgn(v=>!v)}><FileUp size={18}/><span>טעינת PGN</span></button><button className="rail-button" onClick={openLichess}><Link2 size={18}/><span>Lichess</span></button><input ref={fileRef} hidden type="file" accept=".pgn,text/plain" onChange={async e=>{const f=e.target.files?.[0];if(f)importPgn(await f.text())}}/><button className="rail-button" onClick={()=>fileRef.current?.click()}><FileUp size={18}/><span>קובץ</span></button></aside><section className="board-workspace"><div className="workspace-meta"><div><p>POSITION LAB</p><h1>{activeMove?`${Math.ceil((activeMove.ply+1)/2)}. ${activeMove.san}`:"עמדת פתיחה"}</h1></div><div className="turn-reading"><span>תור</span><b>{sideToMove}</b></div></div>{showPgn&&<section className="pgn-drawer"><div className="drawer-heading"><div><span>טעינת PGN</span><b>IMPORT</b></div><button onClick={()=>setShowPgn(false)}>סגור</button></div><Textarea value={pgnInput} onChange={e=>setPgnInput(e.target.value)} dir="ltr"/><div className="drawer-actions"><button className="drawer-confirm" onClick={()=>importPgn(pgnInput)}>טען למשחק</button></div></section>}<div className="board-assembly"><EvaluationBar scoreCp={analysis.scoreCp} mate={analysis.mate}/><ChessBoard board={board} orientation={orientation} selectedSquare={selectedSquare} legalTargets={legalTargets} lastMove={activeMove?{from:activeMove.from,to:activeMove.to}:undefined} suggestedMove={uciToSquares(analysis.bestMove)} onSelect={setSelectedSquare} onMove={commitMove}/></div><div className="board-note"><i/>{notice}<button onClick={async()=>{await navigator.clipboard?.writeText(activeFen);setNotice("FEN הועתק.")}}><Clipboard size={13}/> העתק FEN</button></div></section><aside className="analysis-stack"><AnalysisPanel analysis={analysis} status={engineStatus} fen={activeFen} activeMove={activeMove} material={material} onAnalyze={()=>void runAnalysis()} onApplySuggestion={applySuggestion}/><LichessLayersPanel fen={activeFen} source={source} enabled={isAuthenticated} onConnect={openLichess}/></aside></section><MoveTimeline moves={history} currentPly={currentPly} onNavigate={setCurrentPly}/></main>;
}
