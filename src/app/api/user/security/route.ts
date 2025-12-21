import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { z } from 'zod'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 64

const updatePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(PASSWORD_MIN, `密碼長度至少 ${PASSWORD_MIN} 字元`)
    .max(PASSWORD_MAX, `密碼長度不可超過 ${PASSWORD_MAX} 字元`)
    .refine((val) => /[A-Za-z]/.test(val), '密碼需包含英文')
    .refine((val) => /\d/.test(val), '密碼需包含數字'),
  // 向後相容：舊版前端可能不會送 confirmPassword
  confirmPassword: z.string().optional(),
}).superRefine((data, ctx) => {
  if (typeof data.confirmPassword === 'string' && data.confirmPassword !== data.newPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: '密碼與確認密碼不一致',
    })
  }
})

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.name) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { newPassword } = updatePasswordSchema.parse(body)

    const hashedPassword = await hash(newPassword, 10)

    // Update password (bcrypt hash) - keep consistent with register/login flow
    await prisma.user.update({
        where: { name: session.user.name },
        data: { password: hashedPassword }
    })

    return NextResponse.json({ message: 'Password updated' })
  } catch (error) {
    console.error('Password update error:', error)
    if (error instanceof z.ZodError) {
      const message = error.issues?.[0]?.message || '輸入資料不正確'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

