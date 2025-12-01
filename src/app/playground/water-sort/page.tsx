'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { FlaskConical, RotateCcw, RefreshCw, Trophy, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'react-hot-toast'

// Color palette for the tubes - harmonious, unified tone with good distinction
// Using consistent saturation and brightness for visual harmony
const COLORS = [
  '#E57373', // Soft Red
  '#64B5F6', // Soft Blue
  '#81C784', // Soft Green
  '#FFD54F', // Soft Yellow
  '#BA68C8', // Soft Purple
  '#4DB6AC', // Soft Teal
  '#FFB74D', // Soft Orange
  '#F06292', // Soft Pink
  '#7986CB', // Soft Indigo
  '#A1887F', // Soft Brown
]

// Tube type - array of colors from bottom to top
type Tube = string[]

// Level configuration
interface Level {
  tubes: Tube[]
  emptyTubes: number
}

// Generate levels with increasing difficulty
const generateLevel = (levelNum: number): Level => {
  const baseColors = Math.min(4 + Math.floor(levelNum / 3), COLORS.length)
  const segmentsPerTube = 4
  const emptyTubes = levelNum < 5 ? 2 : (levelNum < 10 ? 2 : 1)
  
  // Create color pool
  const colorPool: string[] = []
  for (let i = 0; i < baseColors; i++) {
    for (let j = 0; j < segmentsPerTube; j++) {
      colorPool.push(COLORS[i])
    }
  }
  
  // Shuffle
  for (let i = colorPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colorPool[i], colorPool[j]] = [colorPool[j], colorPool[i]]
  }
  
  // Distribute into tubes
  const tubes: Tube[] = []
  for (let i = 0; i < baseColors; i++) {
    tubes.push(colorPool.slice(i * segmentsPerTube, (i + 1) * segmentsPerTube))
  }
  
  // Add empty tubes
  for (let i = 0; i < emptyTubes; i++) {
    tubes.push([])
  }
  
  return { tubes, emptyTubes }
}

export default function WaterSortPage() {
  const { data: session } = useSession()
  const [level, setLevel] = useState(1)
  const [tubes, setTubes] = useState<Tube[]>([])
  const [selectedTube, setSelectedTube] = useState<number | null>(null)
  const [moves, setMoves] = useState(0)
  const [history, setHistory] = useState<Tube[][]>([])
  const [gameWon, setGameWon] = useState(false)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [isPouring, setIsPouring] = useState(false)
  
  // Initialize level
  const initLevel = useCallback((lvl: number) => {
    const { tubes } = generateLevel(lvl)
    setTubes(tubes)
    setSelectedTube(null)
    setMoves(0)
    setHistory([])
    setGameWon(false)
  }, [])
  
  useEffect(() => {
    initLevel(level)
  }, [level, initLevel])
  
  // Fetch leaderboard
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/games/score?gameType=WATER_SORT&level=${level}`)
        if (res.ok) {
          const data = await res.json()
          setLeaderboard(data)
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchLeaderboard()
  }, [gameWon, level])
  
  // Check if tube is complete (all same color and full)
  const isTubeComplete = (tube: Tube) => {
    if (tube.length !== 4) return false
    return tube.every(c => c === tube[0])
  }
  
  // Check if all tubes are complete or empty
  const checkWin = useCallback((currentTubes: Tube[]) => {
    return currentTubes.every(tube => tube.length === 0 || isTubeComplete(tube))
  }, [])
  
  // Can pour from source to target?
  const canPour = (source: Tube, target: Tube) => {
    if (source.length === 0) return false
    if (target.length >= 4) return false
    if (target.length === 0) return true
    return source[source.length - 1] === target[target.length - 1]
  }
  
  // Pour from source to target
  const pour = (sourceIdx: number, targetIdx: number) => {
    if (isPouring) return
    
    const newTubes = tubes.map(t => [...t])
    const source = newTubes[sourceIdx]
    const target = newTubes[targetIdx]
    
    if (!canPour(source, target)) return
    
    // Save to history
    setHistory(prev => [...prev, tubes.map(t => [...t])])
    
    setIsPouring(true)
    
    // Pour all matching colors
    const topColor = source[source.length - 1]
    let poured = 0
    
    while (source.length > 0 && target.length < 4 && source[source.length - 1] === topColor) {
      target.push(source.pop()!)
      poured++
    }
    
    setTubes(newTubes)
    setMoves(m => m + 1)
    setSelectedTube(null)
    
    setTimeout(() => {
      setIsPouring(false)
      
      // Check win
      if (checkWin(newTubes)) {
        setGameWon(true)
        toast.success('🎉 太棒了！關卡完成！')
        
        // Submit score
        if (session) {
          submitScore(moves + 1)
        }
      }
    }, 200)
  }
  
  const submitScore = async (finalMoves: number) => {
    try {
      await fetch('/api/games/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType: 'WATER_SORT',
          score: finalMoves,
          level: level
        })
      })
    } catch (err) {
      console.error(err)
    }
  }
  
  // Handle tube tap
  const handleTubeTap = (idx: number) => {
    if (gameWon || isPouring) return
    
    if (selectedTube === null) {
      // Select this tube if it has content
      if (tubes[idx].length > 0) {
        setSelectedTube(idx)
      }
    } else {
      if (selectedTube === idx) {
        // Deselect
        setSelectedTube(null)
      } else {
        // Try to pour
        pour(selectedTube, idx)
      }
    }
  }
  
  // Undo last move
  const undo = () => {
    if (history.length === 0 || isPouring) return
    const prev = history[history.length - 1]
    setTubes(prev)
    setHistory(h => h.slice(0, -1))
    setMoves(m => m - 1)
    setSelectedTube(null)
  }
  
  // Restart level
  const restart = () => {
    initLevel(level)
  }
  
  // Next level
  const nextLevel = () => {
    setLevel(l => l + 1)
  }
  
  // Previous level
  const prevLevel = () => {
    if (level > 1) setLevel(l => l - 1)
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between mb-4 max-w-lg mx-auto w-full">
        <Link href="/playground" className="text-slate-400 hover:text-white p-2 -ml-2">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FlaskConical className="text-cyan-400" size={24} />
          顏色排序
        </h1>
        <div className="w-10"></div>
      </header>
      
      {/* Level & Stats */}
      <div className="flex justify-between items-center max-w-lg mx-auto w-full mb-4 px-2">
        <div className="flex items-center gap-2">
          <button 
            onClick={prevLevel} 
            disabled={level <= 1}
            className="p-2 rounded-lg bg-slate-700 text-white disabled:opacity-30 active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-white font-bold min-w-[80px] text-center">
            Level {level}
          </span>
          <button 
            onClick={nextLevel}
            className="p-2 rounded-lg bg-slate-700 text-white active:scale-95 transition-transform"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-slate-300 text-sm">
            <span className="text-cyan-400 font-bold">{moves}</span> 步
          </div>
          <button 
            onClick={undo}
            disabled={history.length === 0}
            className="p-2 rounded-lg bg-slate-700 text-white disabled:opacity-30 active:scale-95 transition-transform"
          >
            <RotateCcw size={20} />
          </button>
          <button 
            onClick={restart}
            className="p-2 rounded-lg bg-slate-700 text-white active:scale-95 transition-transform"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>
      
      {/* Game Area */}
      <div className="flex-1 flex items-center justify-center">
        <div 
          className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto px-2"
          style={{ maxWidth: '100%' }}
        >
          {tubes.map((tube, idx) => (
            <div
              key={idx}
              onClick={() => handleTubeTap(idx)}
              className={`
                relative cursor-pointer transition-all duration-200 
                ${selectedTube === idx ? '-translate-y-4' : ''}
                ${isTubeComplete(tube) ? 'opacity-60' : ''}
                active:scale-95
              `}
            >
              {/* Tube Container */}
              <div 
                className={`
                  relative w-14 h-36 rounded-b-full border-4 border-t-0 
                  flex flex-col-reverse overflow-hidden
                  ${selectedTube === idx 
                    ? 'border-cyan-400 shadow-lg shadow-cyan-400/30' 
                    : 'border-slate-500'
                  }
                  ${isTubeComplete(tube) ? 'border-green-400' : ''}
                `}
                style={{ 
                  background: 'linear-gradient(to bottom, rgba(30,41,59,0.8), rgba(15,23,42,0.95))',
                }}
              >
                {/* Tube opening / rim */}
                <div 
                  className={`
                    absolute -top-1 left-1/2 -translate-x-1/2 w-16 h-3 rounded-t-lg
                    ${selectedTube === idx 
                      ? 'bg-cyan-400' 
                      : isTubeComplete(tube) ? 'bg-green-400' : 'bg-slate-500'
                    }
                  `}
                />
                
                {/* Water segments */}
                {tube.map((color, segIdx) => (
                  <div
                    key={segIdx}
                    className="w-full transition-all duration-200"
                    style={{ 
                      backgroundColor: color,
                      height: '25%',
                      boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Win Modal */}
      {gameWon && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center animate-bounce-in">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">恭喜過關！</h2>
            <p className="text-slate-300 mb-6">
              你用了 <span className="text-cyan-400 font-bold">{moves}</span> 步完成了 Level {level}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={restart}
                className="px-6 py-3 bg-slate-700 text-white rounded-xl font-bold active:scale-95 transition-transform"
              >
                重玩
              </button>
              <button
                onClick={nextLevel}
                className="px-6 py-3 bg-cyan-500 text-white rounded-xl font-bold active:scale-95 transition-transform"
              >
                下一關
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Leaderboard */}
      <div className="mt-4 max-w-lg mx-auto w-full">
        <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" />
            最少步數排行榜
          </h3>
          <div className="space-y-2">
            {leaderboard.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-2">暫無紀錄</div>
            ) : (
              leaderboard.slice(0, 5).map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <div className={`
                    w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                    ${idx === 0 ? 'bg-yellow-500 text-yellow-900' : 
                      idx === 1 ? 'bg-slate-400 text-slate-800' : 
                      idx === 2 ? 'bg-orange-500 text-orange-900' : 'bg-slate-600 text-slate-300'}
                  `}>
                    {idx + 1}
                  </div>
                  <span className="flex-1 text-slate-300 truncate">{entry.user.name}</span>
                  <span className="text-cyan-400 font-mono font-bold">{entry.score} 步</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="mt-4 text-center text-slate-500 text-xs pb-4">
        點擊選擇試管，再點擊目標試管倒入
      </div>
    </div>
  )
}

