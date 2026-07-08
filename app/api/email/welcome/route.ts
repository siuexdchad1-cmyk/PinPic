import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import type { WelcomeEmailRequest } from '@/lib/types';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(request: NextRequest) {
  let body: WelcomeEmailRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { email, username } = body;
  if (!email) {
    return NextResponse.json({ error: 'email is required.' }, { status: 400 });
  }

  try {
    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL!,
      to:      email,
      subject: '📸 Welcome to PinPic — Start Composing Like a Pro',
      html:    buildWelcomeEmail({ username, appUrl: process.env.NEXT_PUBLIC_APP_URL! }),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[email/welcome] Resend error:', err);
    return NextResponse.json({ error: 'Email send failed.' }, { status: 500 });
  }
}

function buildWelcomeEmail({ username, appUrl }: { username: string; appUrl: string }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#000;color:#fff;font-family:system-ui,sans-serif;margin:0;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;border:1px solid #27272a;border-radius:8px;padding:32px;background:#09090b;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
      <div style="width:8px;height:8px;background:#10b981;border-radius:50%;"></div>
      <span style="font-weight:600;font-size:16px;">PinPic</span>
    </div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;">
      Welcome, ${username || 'Traveler'} 🌍
    </h1>
    <p style="font-size:14px;color:#a1a1aa;margin:0 0 24px;line-height:1.6;">
      You're now part of a global community of travelers who shoot like professionals.
      Step into any GPS hotspot anywhere on Earth and let AI guide your composition.
    </p>

    <div style="border:1px solid #27272a;border-radius:6px;padding:16px;margin-bottom:24px;">
      <p style="font-size:12px;font-weight:600;color:#10b981;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Get Started</p>
      <ol style="font-size:13px;color:#a1a1aa;margin:0;padding-left:16px;line-height:2;">
        <li>Open <strong style="color:#fff;">PinPic Camera</strong> and allow location + camera access</li>
        <li>Walk toward any tagged landmark on Earth</li>
        <li>Align with the wireframe overlay and capture</li>
        <li>Get your AI composition score instantly</li>
      </ol>
    </div>

    <a href="${appUrl}/camera"
       style="display:block;background:#10b981;color:#000;text-align:center;padding:12px;border-radius:6px;font-weight:600;font-size:14px;text-decoration:none;">
      Open Camera →
    </a>

    <p style="margin-top:32px;font-size:11px;color:#3f3f46;text-align:center;">
      Curriculum and Lab Standards Curated by Prathamesh Sir
    </p>
  </div>
</body>
</html>`;
}
