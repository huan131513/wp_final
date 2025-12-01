'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Gamepad2, Bomb, Grid3x3 } from 'lucide-react'

export default function PlaygroundPage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <Gamepad2 size={32} className="text-purple-600" />
                <h1 className="text-3xl font-bold text-gray-900">便便遊樂場</h1>
            </div>
            <p className="text-gray-600">如廁時光不無聊，來場輕鬆的小遊戲吧！</p>
            <Link href="/" className="text-sm text-blue-600 hover:text-blue-800 self-start">
              ← 回地圖首頁
            </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Minesweeper Card */}
            <Link href="/playground/minesweeper" className="block group">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full transition-all duration-300 hover:shadow-md hover:border-purple-200 hover:-translate-y-1">
                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-red-200 transition-colors">
                        <Bomb className="text-red-600" size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">踩地雷</h2>
                    <p className="text-gray-500 text-sm mb-4">
                        經典益智遊戲。小心不要踩到地雷！挑戰最快完成時間。
                    </p>
                    <div className="flex items-center gap-2 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded w-fit">
                        <span>計時挑戰</span>
                    </div>
                </div>
            </Link>

            {/* 2048 Card */}
            <Link href="/playground/2048" className="block group">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full transition-all duration-300 hover:shadow-md hover:border-blue-200 hover:-translate-y-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                        <Grid3x3 className="text-blue-600" size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">2048</h2>
                    <p className="text-gray-500 text-sm mb-4">
                        滑動合併數字，目標是達到 2048！單手也能輕鬆玩。
                    </p>
                    <div className="flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                        <span>積分挑戰</span>
                    </div>
                </div>
            </Link>

            {/* Coming Soon */}
            <div className="bg-gray-100 rounded-2xl p-6 shadow-inner border border-gray-200 h-full opacity-60 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mb-4">
                    <span className="text-2xl">🚧</span>
                </div>
                <h2 className="text-lg font-bold text-gray-500 mb-1">更多遊戲</h2>
                <p className="text-gray-400 text-xs">
                    數獨、接龍... 敬請期待！
                </p>
            </div>
        </div>
      </div>
    </div>
  )
}

