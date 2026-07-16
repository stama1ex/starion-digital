import { NextRequest, NextResponse } from 'next/server';
import { confirmVerificationCode } from '@/lib/email/verification';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();
    if (!email || !code) {
      return NextResponse.json(
        { error: 'Укажите email и код' },
        { status: 400 },
      );
    }

    const token = await confirmVerificationCode(email, code);
    return NextResponse.json({ token });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Не удалось подтвердить код';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
