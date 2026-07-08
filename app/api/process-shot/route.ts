import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import type {
  ProcessShotRequest,
  GroqVisionResult,
  GroqCaptionResult,
} from '@/lib/types';

const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(request: NextRequest) {
  // ── 1. Auth guard ──────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: ProcessShotRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { imageBase64, hotspotImageUrl, hotspotId } = body;

  if (!imageBase64) {
    return NextResponse.json(
      { error: 'imageBase64 is required.' },
      { status: 400 }
    );
  }

  // ── 3. Groq Vision — composition analysis ─────────────────────────────────
  let visionResult: GroqVisionResult;

  try {
    const isUniversalMode = !hotspotImageUrl || !hotspotId;
    const messages = isUniversalMode
      ? [
          {
            role: 'system',
            content: `You are a professional photography composition analyst.
Analyze the user's captured photo.
Evaluate: subject alignment, framing, rule-of-thirds adherence, horizon leveling, and depth.
Return ONLY valid JSON with this exact schema:
{
  "match_accuracy_percentage": <integer 0-100>,
  "adjustments": [<array of max 3 short actionable text tips>],
  "composition_notes": "<one sentence summary>"
}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'User captured image:',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64,
                  detail: 'low',
                },
              },
            ],
          },
        ]
      : [
          {
            role: 'system',
            content: `You are a professional photography composition analyst.
Analyze the user's captured photo against the reference composition image.
Evaluate: subject alignment, framing, rule-of-thirds adherence, horizon leveling, and depth.
Return ONLY valid JSON with this exact schema:
{
  "match_accuracy_percentage": <integer 0-100>,
  "adjustments": [<array of max 3 short actionable text tips>],
  "composition_notes": "<one sentence summary>"
}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Reference composition image:',
              },
              {
                type: 'image_url',
                image_url: {
                  url: hotspotImageUrl,
                  detail: 'low',
                },
              },
              {
                type: 'text',
                text: 'User captured image:',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64,
                  detail: 'low',
                },
              },
            ],
          },
        ];

    const visionResponse = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
      max_tokens: 256,
      temperature: 0.2,
    });

    const raw = visionResponse.choices[0]?.message?.content ?? '{}';
    // Extract JSON from the response (model sometimes wraps in markdown)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    visionResult = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { match_accuracy_percentage: 50, adjustments: [], composition_notes: '' };
  } catch (err) {
    console.error('[process-shot] Groq Vision error:', err);
    // Graceful degradation — return a neutral score instead of failing
    visionResult = {
      match_accuracy_percentage: 50,
      adjustments: ['Could not analyse composition — try again.'],
      composition_notes: 'AI analysis unavailable.',
    };
  }

  const matchAccuracy = Math.min(100, Math.max(0, Math.round(visionResult.match_accuracy_percentage)));

  // ── 4. Groq Text — caption + hashtag synthesis ─────────────────────────────
  let captionResult: GroqCaptionResult;

  try {
    const captionResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a travel content creator writing viral social media captions.
You receive composition analysis data and produce engaging travel content.
Return ONLY valid JSON with this exact schema:
{
  "caption": "<immersive first-person travel story, 2-3 sentences, under 200 chars>",
  "tags": [<array of 10 trending hashtags without # symbol, mix of travel + location + photography>],
  "story_hook": "<one punchy opening line for Instagram Reels>"
}`,
        },
        {
          role: 'user',
          content: `Composition score: ${matchAccuracy}%
Notes: ${visionResult.composition_notes}
Adjustments made: ${visionResult.adjustments.join(', ')}

Write a travel caption and hashtags for this shot.`,
        },
      ],
      max_tokens: 512,
      temperature: 0.8,
    });

    const raw = captionResponse.choices[0]?.message?.content ?? '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    captionResult = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { caption: 'An unforgettable moment, perfectly framed.', tags: ['travel', 'photography'], story_hook: '' };
  } catch (err) {
    console.error('[process-shot] Groq Text error:', err);
    captionResult = {
      caption: 'Every frame tells a story. This one is mine.',
      tags: ['travel', 'photography', 'wanderlust', 'explore'],
      story_hook: 'Some places you never forget.',
    };
  }

  // ── 5. Persist to saved_shots ──────────────────────────────────────────────
  const { data: savedShot, error: insertError } = await supabase
    .from('saved_shots')
    .insert({
      user_id:            user.id,
      hotspot_id:         hotspotId,
      captured_image_url: imageBase64, // In production: upload to Supabase Storage first
      match_accuracy:     matchAccuracy,
      ai_caption:         captionResult.caption,
      tags:               captionResult.tags,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[process-shot] Insert error:', insertError.message);
  }

  // ── 6. Milestone email — fire if match >= 95% ──────────────────────────────
  if (matchAccuracy >= 95) {
    let hotspotTitle = 'your custom location';
    
    if (hotspotId) {
      const { data: hotspot } = await supabase
        .from('hotspots')
        .select('title')
        .eq('id', hotspotId)
        .single();
      if (hotspot?.title) {
        hotspotTitle = hotspot.title;
      }
    }

    // Get user email
    const { data: { user: freshUser } } = await supabase.auth.getUser();

    if (freshUser?.email) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to:   freshUser.email,
          subject: '🏆 Perfect Framing Achievement — PinPic',
          html: buildMilestoneEmail({
            username:     freshUser.user_metadata?.username ?? freshUser.email.split('@')[0],
            matchAccuracy,
            hotspotTitle,
            appUrl:       process.env.NEXT_PUBLIC_APP_URL!,
          }),
        });
      } catch (emailErr) {
        console.error('[process-shot] Milestone email error:', emailErr);
        // Non-fatal — shot is already saved
      }
    }
  }

  // ── 7. Return result ───────────────────────────────────────────────────────
  return NextResponse.json({
    matchAccuracy,
    adjustments:  visionResult.adjustments,
    caption:      captionResult.caption,
    tags:         captionResult.tags,
    savedShotId:  savedShot?.id ?? null,
  });
}

// ── Email template helpers ────────────────────────────────────────────────────

function buildMilestoneEmail({
  username,
  matchAccuracy,
  hotspotTitle,
  appUrl,
}: {
  username: string;
  matchAccuracy: number;
  hotspotTitle: string;
  appUrl: string;
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#000;color:#fff;font-family:system-ui,sans-serif;margin:0;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;border:1px solid #27272a;border-radius:8px;padding:32px;background:#09090b;">
    <div style="font-size:32px;margin-bottom:16px;">🏆</div>
    <h1 style="font-size:18px;font-weight:700;margin:0 0 8px;color:#10b981;">Perfect Framing Achievement</h1>
    <p style="font-size:14px;color:#a1a1aa;margin:0 0 24px;">
      Hey ${username}, you nailed it!
    </p>
    <div style="border:1px solid #10b981;border-radius:6px;padding:16px;margin-bottom:24px;text-align:center;">
      <div style="font-size:36px;font-weight:800;color:#10b981;font-family:monospace;">${matchAccuracy}%</div>
      <div style="font-size:12px;color:#71717a;margin-top:4px;">Composition Match at ${hotspotTitle}</div>
    </div>
    <p style="font-size:13px;color:#71717a;margin:0 0 24px;line-height:1.6;">
      Your shot at <strong style="color:#fff;">${hotspotTitle}</strong> scored a perfect
      ${matchAccuracy}% composition match — placing you in the top tier of PinPic travelers.
    </p>
    <a href="${appUrl}/scrapbook"
       style="display:block;background:#10b981;color:#000;text-align:center;padding:12px;border-radius:6px;font-weight:600;font-size:14px;text-decoration:none;">
      View in Scrapbook →
    </a>
    <p style="margin-top:32px;font-size:11px;color:#3f3f46;text-align:center;">
      Curriculum and Lab Standards Curated by Prathamesh Sir
    </p>
  </div>
</body>
</html>`;
}
