'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface AchievementDisplay {
    id: string
    name: string
    description: string
    icon: string
    criteriaType: string
    threshold: number
    isUnlocked: boolean
    progress: number
    currentVal: number
    unlockedAt: string | null
}

interface UserProfile {
  id: string
  name: string
  role: string
  _count: {
    reviews: number
    reports: number
    requests: number
  }
  achievements: AchievementDisplay[]
}

export default function MemberDashboard() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          setProfile(await res.json())
        }
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [])

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Failed to load profile</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl text-white font-bold">
                    {profile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {profile.role}
                    </span>
                </div>
            </div>
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                ← 回首頁
            </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard 
                label="已發表評論" 
                value={profile._count.reviews} 
                icon="📝" 
                link="/member/history"
                linkText="查看紀錄"
            />
            <StatCard 
                label="已回報問題" 
                value={profile._count.reports} 
                icon="📢" 
                link="/member/reports"
                linkText="查看紀錄"
            />
            <StatCard 
                label="已申請地點" 
                value={profile._count.requests} 
                icon="📍" 
                link="/member/requests"
                linkText="查看紀錄"
            />
        </div>

        {/* Achievements Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                🏆 成就系統
                <span className="text-sm font-normal text-gray-500 ml-2">
                    ({profile.achievements.filter(a => a.isUnlocked).length}/{profile.achievements.length})
                </span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {profile.achievements.map((ach) => (
                    <div 
                        key={ach.id} 
                        className={`
                            relative p-4 rounded-xl border transition-all duration-200
                            ${ach.isUnlocked 
                                ? 'bg-yellow-50/50 border-yellow-200 shadow-sm' 
                                : 'bg-gray-50 border-dashed border-gray-200 opacity-70 hover:opacity-100'
                            }
                        `}
                    >
                        {/* Status Badge */}
                        <div className="absolute top-3 right-3">
                            {ach.isUnlocked ? (
                                <span className="text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                                    已獲得
                                </span>
                            ) : (
                                <span className="text-xs font-medium text-gray-400 bg-gray-200 px-2 py-1 rounded-full">
                                    未解鎖
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col items-center text-center mt-2">
                            <div className={`text-4xl mb-3 ${!ach.isUnlocked && 'grayscale opacity-50'}`}>
                                {ach.icon}
                            </div>
                            <h3 className={`font-bold ${ach.isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>
                                {ach.name}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1 mb-3 h-8 flex items-center justify-center w-full">
                                {ach.description}
                            </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                <span>進度</span>
                                <span>{ach.currentVal} / {ach.threshold}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        ach.isUnlocked ? 'bg-yellow-400' : 'bg-gray-400'
                                    }`}
                                    style={{ width: `${ach.progress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1">
            <ActionCard 
                title="新增地點 / 回報問題" 
                desc="發現地圖上沒有的廁所？或者現有設施有問題？點擊返回地圖進行操作。"
                link="/"
                linkText="前往地圖"
            />
        </div>

      </div>
    </div>
  )
}

function StatCard({ label, value, icon, link, linkText }: { label: string, value: number, icon: string, link?: string, linkText?: string }) {
    const Content = () => (
        <div className={`bg-white p-6 rounded-2xl shadow-sm flex items-center justify-between ${link ? 'hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-blue-100 group' : ''}`}>
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-gray-500">{label}</p>
                    {link && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            {linkText} ➜
                        </span>
                    )}
                </div>
                <p className="text-3xl font-bold text-gray-900">{value}</p>
            </div>
            <div className="text-4xl opacity-20 grayscale">{icon}</div>
        </div>
    )

    if (link) {
        return (
            <Link href={link} className="block">
                <Content />
            </Link>
        )
    }

    return <Content />
}

function ActionCard({ title, desc, link, linkText }: { title: string, desc: string, link: string, linkText: string }) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center md:text-left md:flex md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
                <h3 className="font-bold text-lg text-gray-900 mb-1">{title}</h3>
                <p className="text-gray-500 text-sm">{desc}</p>
            </div>
            <Link 
                href={link}
                className="inline-block py-2 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm shadow-blue-200"
            >
                {linkText}
            </Link>
        </div>
    )
}
