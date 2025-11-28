'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'

interface Notification {
    id: string
    title: string
    message: string
    type: string
    isRead: boolean
    createdAt: string
    link?: string
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const res = await fetch('/api/user/notifications')
                if (res.ok) {
                    const data = await res.json()
                    // Handle structure from API: { notifications: [], unreadCount: number } or just []
                    if (data.notifications) {
                        setNotifications(data.notifications)
                    } else if (Array.isArray(data)) {
                        setNotifications(data)
                    }
                }
            } catch (error) {
                console.error('Failed to fetch notifications', error)
            }
        }

        fetchNotifications()
        
        // Optional: Poll every minute
        const interval = setInterval(fetchNotifications, 60000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const unreadCount = notifications.filter(n => !n.isRead).length

    const handleMarkRead = async (id: string) => {
        try {
            await fetch('/api/user/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId: id }) // API expects notificationId
            })
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
        } catch (error) {
            console.error('Failed to mark as read', error)
        }
    }

    const handleMarkAllRead = async () => {
        try {
            await fetch('/api/user/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAll: true })
            })
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        } catch (error) {
            console.error('Failed to mark all as read', error)
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 hover:bg-gray-100 rounded-full relative transition-colors"
            >
                <Bell className="text-gray-600 w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
                )}
            </button>
            
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-3 border-b bg-gray-50 text-sm font-bold text-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span>通知中心</span>
                            {unreadCount > 0 && <span className="text-xs font-normal text-gray-500">({unreadCount} 未讀)</span>}
                        </div>
                        {unreadCount > 0 && (
                            <button 
                                onClick={handleMarkAllRead}
                                className="text-xs text-blue-600 hover:text-blue-800 font-normal"
                            >
                                全部已讀
                            </button>
                        )}
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <p className="text-center py-8 text-sm text-gray-400">沒有新通知</p>
                        ) : (
                            notifications.map(n => (
                                <div 
                                    key={n.id} 
                                    onClick={() => !n.isRead && handleMarkRead(n.id)}
                                    className={`p-3 border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer ${!n.isRead ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-sm font-bold text-gray-900">{n.title}</p>
                                        {!n.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>}
                                    </div>
                                    <p className="text-xs text-gray-600 line-clamp-2 mb-1">{n.message}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-[10px] text-gray-400">{new Date(n.createdAt).toLocaleDateString()}</p>
                                        {n.link && (
                                            <Link href={n.link} className="text-xs text-blue-600 hover:text-blue-800" onClick={(e) => e.stopPropagation()}>
                                                查看詳情
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

