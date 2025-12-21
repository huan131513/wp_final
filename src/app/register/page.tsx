'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 64

function getPasswordSignals(password: string) {
  const length = password.length
  const hasLetter = /[A-Za-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const isTooShort = length > 0 && length < PASSWORD_MIN
  const isTooLong = length > PASSWORD_MAX

  // 強度只是引導用：不強制符號/大寫，但有會加分
  let score = 0
  if (length >= PASSWORD_MIN) score += 1
  if (hasLetter) score += 1
  if (hasNumber) score += 1
  if (length >= 12) score += 1
  if (hasSymbol) score += 1
  if (isTooLong) score = 0

  const normalized = Math.min(Math.max(score, 0), 5)
  const percent = (normalized / 5) * 100

  let label = '尚未輸入'
  let barClass = 'bg-gray-200'
  if (length > 0) {
    if (normalized <= 2) {
      label = '弱'
      barClass = 'bg-red-500'
    } else if (normalized === 3) {
      label = '普通'
      barClass = 'bg-yellow-500'
    } else if (normalized === 4) {
      label = '強'
      barClass = 'bg-green-500'
    } else {
      label = '很強'
      barClass = 'bg-emerald-600'
    }
  }

  const ruleLengthOk = length >= PASSWORD_MIN && length <= PASSWORD_MAX
  const ruleAlphaNumOk = hasLetter && hasNumber

  return {
    length,
    hasLetter,
    hasNumber,
    hasSymbol,
    isTooShort,
    isTooLong,
    score: normalized,
    percent,
    label,
    barClass,
    ruleLengthOk,
    ruleAlphaNumOk,
  }
}

export default function RegisterPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const signals = useMemo(() => getPasswordSignals(password), [password])
  const isConfirmTouched = confirmPassword.length > 0
  const isConfirmMatch = confirmPassword === password

  const canSubmit =
    name.trim().length > 0 &&
    signals.ruleLengthOk &&
    signals.ruleAlphaNumOk &&
    confirmPassword.length > 0 &&
    isConfirmMatch &&
    !isSubmitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!signals.ruleLengthOk) {
      setError(`密碼需為 ${PASSWORD_MIN}–${PASSWORD_MAX} 字元`)
      return
    }
    if (!signals.ruleAlphaNumOk) {
      setError('密碼需包含英文與數字（英數混用）')
      return
    }
    if (!confirmPassword) {
      setError('請再次輸入密碼以確認')
      return
    }
    if (!isConfirmMatch) {
      setError('密碼與確認密碼不一致')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmPassword, name }),
      })

      if (res.ok) {
        router.push('/login')
      } else {
        const data = await res.json()
        setError(data.error || 'Registration failed')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-md">
        <div className="text-center relative">
          <Link href="/" className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
            ← 返回
          </Link>
          <h2 className="text-3xl font-bold text-gray-900">註冊會員</h2>
          <p className="mt-2 text-gray-600">
            已有帳號？ <Link href="/login" className="text-blue-600 hover:text-blue-500">登入</Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="使用者名稱"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder={`密碼（${PASSWORD_MIN}–${PASSWORD_MAX} 字元，英數混用）`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="確認密碼"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">密碼強度</div>
              <div className="text-sm font-medium text-gray-700">{signals.label}</div>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full ${signals.barClass} transition-all duration-300`}
                style={{ width: `${signals.percent}%` }}
              />
            </div>

            <div className="text-sm space-y-1">
              <div className={signals.ruleLengthOk ? 'text-green-600' : 'text-gray-600'}>
                長度：{PASSWORD_MIN}–{PASSWORD_MAX} 字元（目前 {signals.length}）
              </div>
              <div className={signals.ruleAlphaNumOk ? 'text-green-600' : 'text-gray-600'}>
                英數混用：需同時包含英文與數字
              </div>
              <div className={!isConfirmTouched ? 'text-gray-600' : isConfirmMatch ? 'text-green-600' : 'text-red-600'}>
                確認密碼：{!isConfirmTouched ? '尚未輸入' : isConfirmMatch ? '一致' : '不一致'}
              </div>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isSubmitting ? '註冊中...' : '註冊'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

