'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Grid3x3, RefreshCw, Trophy } from 'lucide-react'
import { toast } from 'react-hot-toast'

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

interface Tile {
  id: number
  value: number
  row: number
  col: number
  isNew?: boolean
  isMerged?: boolean
}

// Grid configuration
const CELL_SIZE = 100 // px
const GAP = 12 // px
const GRID_SIZE = 4
const BOARD_SIZE = CELL_SIZE * GRID_SIZE + GAP * (GRID_SIZE - 1) // 436px

let tileIdCounter = 0
const getNextTileId = () => ++tileIdCounter

export default function Game2048Page() {
  const { data: session } = useSession()
  const [tiles, setTiles] = useState<Tile[]>([])
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [isAnimating, setIsAnimating] = useState(false)

  // Get position in pixels
  const getPosition = (index: number) => index * (CELL_SIZE + GAP)

  // Get board state from tiles
  const getBoardFromTiles = useCallback((currentTiles: Tile[]) => {
    const board: number[][] = Array(4).fill(0).map(() => Array(4).fill(0))
    currentTiles.forEach(tile => {
      board[tile.row][tile.col] = tile.value
    })
    return board
  }, [])

  // Add a random tile
  const addRandomTile = useCallback((currentTiles: Tile[]): Tile[] => {
    const board = getBoardFromTiles(currentTiles)
    const emptyCells: { r: number, c: number }[] = []
    
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] === 0) emptyCells.push({ r, c })
      }
    }
    
    if (emptyCells.length === 0) return currentTiles
    
    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)]
    const newTile: Tile = {
      id: getNextTileId(),
      value: Math.random() < 0.9 ? 2 : 4,
      row: r,
      col: c,
      isNew: true
    }
    
    return [...currentTiles, newTile]
  }, [getBoardFromTiles])

  // Initialize Game
  const initGame = useCallback(() => {
    tileIdCounter = 0
    let newTiles: Tile[] = []
    newTiles = addRandomTile(newTiles)
    newTiles = addRandomTile(newTiles)
    setTiles(newTiles)
    setScore(0)
    setGameOver(false)
    setIsAnimating(false)
  }, [addRandomTile])

  useEffect(() => {
    initGame()
  }, [initGame])

  // Fetch Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/games/score?gameType=GAME_2048')
      if (res.ok) {
        const data = await res.json()
        setLeaderboard(data)
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Check if game is over
  const checkGameOver = useCallback((currentTiles: Tile[]) => {
    const board = getBoardFromTiles(currentTiles)
    
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] === 0) return false
      }
    }
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (c < 3 && board[r][c] === board[r][c + 1]) return false
        if (r < 3 && board[r][c] === board[r + 1][c]) return false
      }
    }
    return true
  }, [getBoardFromTiles])

  const handleGameOver = useCallback(async (finalScore: number) => {
    toast('遊戲結束！', { icon: '🎮' })
    if (session) {
      try {
        await fetch('/api/games/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameType: 'GAME_2048',
            score: finalScore
          })
        })
        toast.success('分數已紀錄！')
        fetchLeaderboard()
      } catch (err) {
        console.error(err)
      }
    }
  }, [session, fetchLeaderboard])

  // Move tiles
  const move = useCallback((direction: Direction) => {
    if (gameOver || isAnimating) return

    setIsAnimating(true)

    let currentTiles = tiles.map(t => ({ ...t, isNew: false, isMerged: false }))
    const board = getBoardFromTiles(currentTiles)
    
    const tileMap = new Map<string, Tile>()
    currentTiles.forEach(t => {
      tileMap.set(`${t.row}-${t.col}`, t)
    })

    let moved = false
    let addedScore = 0
    const newTiles: Tile[] = []

    const processLine = (line: number[], lineTiles: (Tile | null)[]) => {
      const result: { value: number, tile: Tile | null, merged: boolean }[] = []
      const filtered = line.map((val, i) => ({ value: val, tile: lineTiles[i] })).filter(x => x.value !== 0)
      
      for (let i = 0; i < filtered.length; i++) {
        if (i < filtered.length - 1 && filtered[i].value === filtered[i + 1].value) {
          const mergedValue = filtered[i].value * 2
          addedScore += mergedValue
          result.push({ value: mergedValue, tile: filtered[i].tile, merged: true })
          i++
        } else {
          result.push({ value: filtered[i].value, tile: filtered[i].tile, merged: false })
        }
      }
      
      while (result.length < 4) {
        result.push({ value: 0, tile: null, merged: false })
      }
      
      return result
    }

    if (direction === 'LEFT') {
      for (let r = 0; r < 4; r++) {
        const line = board[r]
        const lineTiles = line.map((_, c) => tileMap.get(`${r}-${c}`) || null)
        const result = processLine(line, lineTiles)
        
        result.forEach((item, c) => {
          if (item.value !== 0 && item.tile) {
            if (item.tile.row !== r || item.tile.col !== c || item.merged) moved = true
            newTiles.push({
              id: item.merged ? getNextTileId() : item.tile.id,
              value: item.value,
              row: r,
              col: c,
              isMerged: item.merged
            })
          }
        })
      }
    } else if (direction === 'RIGHT') {
      for (let r = 0; r < 4; r++) {
        const line = [...board[r]].reverse()
        const lineTiles = [...board[r]].map((_, c) => tileMap.get(`${r}-${3 - c}`) || null)
        const result = processLine(line, lineTiles)
        
        result.forEach((item, i) => {
          const c = 3 - i
          if (item.value !== 0 && item.tile) {
            if (item.tile.row !== r || item.tile.col !== c || item.merged) moved = true
            newTiles.push({
              id: item.merged ? getNextTileId() : item.tile.id,
              value: item.value,
              row: r,
              col: c,
              isMerged: item.merged
            })
          }
        })
      }
    } else if (direction === 'UP') {
      for (let c = 0; c < 4; c++) {
        const line = [board[0][c], board[1][c], board[2][c], board[3][c]]
        const lineTiles = line.map((_, r) => tileMap.get(`${r}-${c}`) || null)
        const result = processLine(line, lineTiles)
        
        result.forEach((item, r) => {
          if (item.value !== 0 && item.tile) {
            if (item.tile.row !== r || item.tile.col !== c || item.merged) moved = true
            newTiles.push({
              id: item.merged ? getNextTileId() : item.tile.id,
              value: item.value,
              row: r,
              col: c,
              isMerged: item.merged
            })
          }
        })
      }
    } else if (direction === 'DOWN') {
      for (let c = 0; c < 4; c++) {
        const line = [board[3][c], board[2][c], board[1][c], board[0][c]]
        const lineTiles = line.map((_, i) => tileMap.get(`${3 - i}-${c}`) || null)
        const result = processLine(line, lineTiles)
        
        result.forEach((item, i) => {
          const r = 3 - i
          if (item.value !== 0 && item.tile) {
            if (item.tile.row !== r || item.tile.col !== c || item.merged) moved = true
            newTiles.push({
              id: item.merged ? getNextTileId() : item.tile.id,
              value: item.value,
              row: r,
              col: c,
              isMerged: item.merged
            })
          }
        })
      }
    }

    if (moved) {
      setTiles(newTiles)
      const newScore = score + addedScore
      setScore(newScore)
      if (newScore > bestScore) setBestScore(newScore)

      setTimeout(() => {
        setTiles(prev => {
          const withNewTile = addRandomTile(prev.map(t => ({ ...t, isMerged: false })))
          
          if (checkGameOver(withNewTile)) {
            setGameOver(true)
            handleGameOver(newScore)
          }
          
          return withNewTile
        })
        setIsAnimating(false)
      }, 150)
    } else {
      setIsAnimating(false)
    }
  }, [tiles, gameOver, isAnimating, score, bestScore, getBoardFromTiles, addRandomTile, checkGameOver, handleGameOver])

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); move('UP') }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move('DOWN') }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move('LEFT') }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move('RIGHT') }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [move])

  // Touch Controls
  const touchStart = useRef<{ x: number, y: number } | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    const dx = touchEnd.x - touchStart.current.x
    const dy = touchEnd.y - touchStart.current.y

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) move(dx > 0 ? 'RIGHT' : 'LEFT')
    } else {
      if (Math.abs(dy) > 30) move(dy > 0 ? 'DOWN' : 'UP')
    }
    touchStart.current = null
  }

  const getTileColor = (value: number) => {
    const colors: { [key: number]: string } = {
      2: 'bg-[#eee4da] text-[#776e65]',
      4: 'bg-[#ede0c8] text-[#776e65]',
      8: 'bg-[#f2b179] text-white',
      16: 'bg-[#f59563] text-white',
      32: 'bg-[#f67c5f] text-white',
      64: 'bg-[#f65e3b] text-white',
      128: 'bg-[#edcf72] text-white',
      256: 'bg-[#edcc61] text-white',
      512: 'bg-[#edc850] text-white',
      1024: 'bg-[#edc53f] text-white',
      2048: 'bg-[#edc22e] text-white',
    }
    return colors[value] || 'bg-[#3c3a32] text-white'
  }

  const getFontSize = (value: number) => {
    if (value >= 1024) return 'text-2xl md:text-3xl'
    if (value >= 128) return 'text-3xl md:text-4xl'
    return 'text-4xl md:text-5xl'
  }

  return (
    <div className="min-h-screen bg-[#faf8ef] p-4 md:p-8 flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
      {/* Game Area */}
      <div className="flex-1 flex flex-col items-center">
        <header className="w-full flex items-center justify-between mb-6 max-w-[500px]">
            <Link href="/playground" className="text-[#776e65] hover:text-[#5a5248]">
                ← 回遊樂場
            </Link>
            <h1 className="text-2xl font-bold text-[#776e65] flex items-center gap-2">
                <Grid3x3 className="text-[#edc22e]" />
                2048
            </h1>
            <div className="w-[80px]"></div>
        </header>

        <div className="w-full max-w-[500px]">
            <div className="flex justify-between items-center mb-6">
                <div className="bg-[#bbada0] text-white p-3 rounded-lg min-w-[100px] text-center">
                    <div className="text-xs opacity-80 uppercase font-bold">Score</div>
                    <div className="text-xl font-bold">{score}</div>
                </div>
                <button 
                    onClick={initGame}
                    className="bg-[#8f7a66] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#7a6658] transition-colors flex items-center gap-2"
                >
                    <RefreshCw size={18} /> 新遊戲
                </button>
                <div className="bg-[#bbada0] text-white p-3 rounded-lg min-w-[100px] text-center">
                    <div className="text-xs opacity-80 uppercase font-bold">Best</div>
                    <div className="text-xl font-bold">{bestScore}</div>
                </div>
            </div>

            {/* Game Board Container - Responsive */}
            <div 
                className="bg-[#bbada0] p-3 rounded-xl relative touch-none mx-auto"
                style={{ 
                    width: 'min(100%, 460px)',
                    aspectRatio: '1 / 1'
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {gameOver && (
                    <div className="absolute inset-0 bg-[#eee4da]/80 z-20 rounded-xl flex flex-col items-center justify-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-[#776e65] mb-2">Game Over!</h2>
                        <p className="text-lg text-[#776e65] mb-6">Final Score: {score}</p>
                        <button 
                            onClick={initGame}
                            className="bg-[#8f7a66] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#7a6658] shadow-lg"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Inner game area with fixed aspect ratio */}
                <div className="w-full h-full relative">
                    {/* Background Grid */}
                    <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-[12px]">
                        {Array(16).fill(0).map((_, i) => (
                            <div key={i} className="bg-[#cdc1b4] rounded-lg" />
                        ))}
                    </div>

                    {/* Animated Tiles */}
                    <div className="absolute inset-0">
                        {tiles.map((tile) => (
                            <div
                                key={tile.id}
                                className={`
                                    absolute rounded-lg flex items-center justify-center font-bold
                                    ${getTileColor(tile.value)}
                                    ${getFontSize(tile.value)}
                                    ${tile.isNew ? 'animate-tile-appear' : ''}
                                    ${tile.isMerged ? 'animate-tile-merge' : ''}
                                `}
                                style={{
                                    // Cell size: (100% - 3 gaps) / 4 = (100% - 36px) / 4
                                    width: 'calc((100% - 36px) / 4)',
                                    height: 'calc((100% - 36px) / 4)',
                                    // Position: row/col * (cellSize + gap)
                                    top: `calc(${tile.row} * ((100% - 36px) / 4 + 12px))`,
                                    left: `calc(${tile.col} * ((100% - 36px) / 4 + 12px))`,
                                    transition: 'top 150ms ease-in-out, left 150ms ease-in-out',
                                    zIndex: tile.isMerged ? 10 : 1,
                                }}
                            >
                                {tile.value}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <p className="text-center text-[#776e65] mt-4 text-sm">
                使用方向鍵或滑動螢幕來移動方塊
            </p>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="w-full md:w-80">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 sticky top-8">
            <h2 className="text-lg font-bold text-[#776e65] mb-4 flex items-center gap-2">
                <Trophy className="text-yellow-500" />
                排行榜
            </h2>
            <div className="space-y-3">
                {leaderboard.length === 0 ? (
                    <div className="text-gray-400 text-sm text-center py-4">暫無紀錄，快來挑戰！</div>
                ) : (
                    leaderboard.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-3 border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                             <div className={`
                                w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
                                ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-blue-100 text-blue-600'}
                            `}>
                                {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{entry.user.name}</div>
                                <div className="text-[10px] text-gray-400">{new Date(entry.playedAt).toLocaleDateString()}</div>
                            </div>
                            <div className="font-mono font-bold text-[#776e65]">
                                {entry.score}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* Animation Styles */}
      <style jsx global>{`
        @keyframes tile-appear {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes tile-merge {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }
        
        .animate-tile-appear {
          animation: tile-appear 200ms ease-out forwards;
        }
        
        .animate-tile-merge {
          animation: tile-merge 200ms ease-out;
        }
      `}</style>
    </div>
  )
}
