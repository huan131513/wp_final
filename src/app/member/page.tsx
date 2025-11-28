'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Edit, Key, Heart, Trash2, Crown, Upload, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import { NotificationBell } from '@/components/NotificationBell'

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
  bio?: string
  avatar?: string
  _count: {
    reviews: number
    reports: number
    requests: number
  }
  achievements: AchievementDisplay[]
}

interface SavedLocation {
    location: {
        id: string
        name: string
        type: string
    }
    createdAt: string
}

interface LeaderboardUser {
    name: string
    avatar?: string
    points: number
    counts: {
        reviews: number
        reports: number
        requests: number
    }
}

export default function MemberDashboard() {
  useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Modal States
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)

  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true)
        try {
            const [profileRes, savedRes, leaderRes] = await Promise.all([
                fetch('/api/user/profile'),
                fetch('/api/user/saved-locations'),
                fetch('/api/leaderboard')
            ])
            
            if (profileRes.ok) setProfile(await profileRes.json())
            if (savedRes.ok) setSavedLocations(await savedRes.json())
            if (leaderRes.ok) setLeaderboard(await leaderRes.json())

        } catch (error) {
            console.error(error)
            toast.error('Failed to load data')
        } finally {
            setIsLoading(false)
        }
    }
    loadData()
  }, [])

  const handleDeleteSaved = async (locationId: string) => {
      const res = await fetch(`/api/user/saved-locations?locationId=${locationId}`, {
          method: 'DELETE'
      })
      if (res.ok) {
          setSavedLocations(prev => prev.filter(s => s.location.id !== locationId))
          toast.success('已移除收藏')
      }
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Failed to load profile</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header & Profile Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
            <div className="flex items-center gap-4">
                <div 
                    className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-md overflow-hidden relative group cursor-pointer"
                    onClick={() => setIsEditProfileOpen(true)}
                    title="點擊更換頭像"
                >
                    {profile.avatar && profile.avatar.startsWith('data:image') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-3xl text-white font-bold">{profile.avatar || profile.name.charAt(0).toUpperCase()}</span>
                    )}
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white w-6 h-6" />
                    </div>
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            LV. {Math.floor((profile._count.reviews * 10 + profile._count.reports * 20 + profile._count.requests * 50) / 100) + 1}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{profile.bio || '這傢伙很懶，什麼都沒寫...'}</p>
                    <div className="flex gap-2 mt-3">
                        <button 
                            onClick={() => setIsEditProfileOpen(true)}
                            className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors"
                        >
                            <Edit size={12} /> 編輯資料
                        </button>
                        <button 
                            onClick={() => setIsChangePasswordOpen(true)}
                            className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors"
                        >
                            <Key size={12} /> 修改密碼
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-4 self-end md:self-auto">
                <NotificationBell />
                <Link href="/" className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">
                    ← 回地圖
                </Link>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Left 2 Columns */}
            <div className="lg:col-span-2 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard label="已發表評論" value={profile._count.reviews} icon="📝" link="/member/history" linkText="紀錄" />
                    <StatCard label="已回報問題" value={profile._count.reports} icon="📢" link="/member/reports" linkText="紀錄" />
                    <StatCard label="已申請地點" value={profile._count.requests} icon="📍" link="/member/requests" linkText="紀錄" />
                </div>

                {/* Saved Locations */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Heart className="text-red-500 fill-red-500" size={20} /> 我的收藏
                    </h2>
                    {savedLocations.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-500 text-sm">還沒有收藏任何地點</p>
                            <Link href="/" className="text-blue-600 text-xs font-medium hover:underline mt-1 block">去地圖逛逛</Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {savedLocations.map(saved => (
                                <div key={saved.location.id} className="p-3 border rounded-xl flex justify-between items-center hover:shadow-md transition-all bg-white">
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{saved.location.name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{saved.location.type}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteSaved(saved.location.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Achievements */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Crown className="text-yellow-500" size={20} /> 成就系統
                        <span className="text-sm font-normal text-gray-500 ml-auto">
                            ({profile.achievements.filter(a => a.isUnlocked).length}/{profile.achievements.length})
                        </span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {profile.achievements.map((ach) => (
                            <div 
                                key={ach.id} 
                                className={`relative p-4 rounded-xl border transition-all duration-200 ${ach.isUnlocked ? 'bg-yellow-50/50 border-yellow-200' : 'bg-gray-50 border-dashed opacity-70'}`}
                            >
                                <div className="flex flex-col items-center text-center">
                                    <div className={`text-3xl mb-2 ${!ach.isUnlocked && 'grayscale opacity-50'}`}>{ach.icon}</div>
                                    <h3 className={`font-bold text-sm ${ach.isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>{ach.name}</h3>
                                    <p className="text-[10px] text-gray-500 mt-1 h-8 flex items-center justify-center">{ach.description}</p>
                                </div>
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                        <span>進度</span>
                                        <span>{ach.currentVal} / {ach.threshold}</span>
                                    </div>
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${ach.isUnlocked ? 'bg-yellow-400' : 'bg-gray-400'}`}
                                        style={{ width: `${ach.progress}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar - Right Column */}
            <div className="space-y-6">
                {/* Leaderboard */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        🏆 本月排行榜
                    </h2>
                    <div className="space-y-4">
                        {leaderboard.map((user, index) => (
                            <div key={index} className="flex items-center gap-3">
                                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                                    index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                                    index === 1 ? 'bg-gray-100 text-gray-700' : 
                                    index === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'
                                }`}>
                                    {index + 1}
                                </div>
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600 overflow-hidden">
                                    {user.avatar && user.avatar.startsWith('data:image') ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                    ) : (
                                        user.avatar || user.name.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                                    <p className="text-[10px] text-gray-500">
                                        {user.counts.reviews} 評論 • {user.counts.reports} 回報 • {user.counts.requests} 申請
                                    </p>
                                </div>
                                <div className="text-xs font-bold text-blue-600">
                                    {user.points} pt
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
          <EditProfileModal 
            user={profile} 
            onClose={() => setIsEditProfileOpen(false)} 
            onUpdate={(newProfile) => setProfile({ ...profile, ...newProfile })} 
          />
      )}

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
          <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </div>
  )
}

// --- Sub Components ---

function StatCard({ label, value, icon, link, linkText }: { label: string, value: number, icon: string, link?: string, linkText?: string }) {
    const content = (
        <div className={`bg-white p-5 rounded-xl shadow-sm border border-transparent ${link ? 'hover:border-blue-200 hover:shadow-md cursor-pointer transition-all group' : ''}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
                <div className="text-2xl opacity-80">{icon}</div>
            </div>
            {link && (
                <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
                    <span className="text-xs text-blue-600 font-medium flex items-center opacity-60 group-hover:opacity-100 transition-opacity">
                        {linkText} →
                    </span>
                </div>
            )}
        </div>
    )
    return link ? <Link href={link}>{content}</Link> : content
}

function EditProfileModal({ user, onClose, onUpdate }: { user: UserProfile, onClose: () => void, onUpdate: (data: Partial<UserProfile>) => void }) {
    const [bio, setBio] = useState(user.bio || '')
    const [avatar, setAvatar] = useState(user.avatar || '')
    const [loading, setLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bio, avatar })
            })
            if (res.ok) {
                onUpdate({ bio, avatar })
                toast.success('資料已更新')
                onClose()
            }
        } catch (error) {
            console.error(error)
            toast.error('更新失敗')
        } finally {
            setLoading(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit
                toast.error('圖片大小不能超過 1MB')
                return
            }
            
            const reader = new FileReader()
            reader.onloadend = () => {
                setAvatar(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                <h2 className="text-lg font-bold mb-4">編輯個人資料</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">頭像</label>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-16 h-16 rounded-full border border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
                                {avatar && avatar.startsWith('data:image') ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={avatar} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-2xl">{avatar || '👤'}</span>
                                )}
                            </div>
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-sm bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                            >
                                <Upload size={14} /> 上傳圖片
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>
                        
                        <p className="text-xs text-gray-500 mb-2">或選擇一個 Emoji：</p>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {['😊', '😎', '🐱', '🐶', '🦊', '🤖', '👻', '💩'].map(emoji => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => setAvatar(emoji)}
                                    className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-xl border ${avatar === emoji ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 border-gray-200'}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">個人簡介</label>
                        <textarea 
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            rows={3}
                            placeholder="寫點什麼介紹自己..."
                        />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">取消</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                            {loading ? '儲存中...' : '儲存變更'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirm) return toast.error('兩次密碼輸入不一致')
        if (password.length < 6) return toast.error('密碼長度至少需 6 碼')

        setLoading(true)
        try {
            const res = await fetch('/api/user/security', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: password })
            })
            if (res.ok) {
                toast.success('密碼已修改')
                onClose()
            } else {
                toast.error('修改失敗')
            }
        } catch (error) {
            console.error(error)
            toast.error('修改失敗')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                <h2 className="text-lg font-bold mb-4">修改密碼</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
                        <input 
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="至少 6 碼"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">確認新密碼</label>
                        <input 
                            type="password"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">取消</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                            {loading ? '處理中...' : '確認修改'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
