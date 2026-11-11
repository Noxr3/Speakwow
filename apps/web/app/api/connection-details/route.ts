import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';
import { PERSONA_CARDS, resolvePersonaId } from '@speakwow/shared';
import { byokSecret, isByokProvider, looksLikeApiKey, sealUserKey } from '@/lib/byok';
import { resolveCallCourse } from '@/lib/call-course';
import { isSameOriginJson } from '@/lib/request-origin';
import { getSessionUser } from '@/lib/supabase/server';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const DISPATCH_NAME = 'speakwow';

export const revalidate = 0;

function refuse(status: number, error: string, message: string) {
  return NextResponse.json(
    { error, message },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

/**
 * Mints the student's LiveKit token. Everything the voice agent needs to know
 * about the call (teacher, student, mode, sealed key) is signed into the
 * token's dispatch metadata, so the browser cannot forge it.
 *
 *   ALLOW_GUESTS=false  only signed-in students may start a call
 *   REQUIRE_BYOK=true   every call must bring its own model key
 */
/** A BCP 47 tag like "zh-CN" from the browser, or undefined. */
function languageTag(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/.test(value)
    ? value
    : undefined;
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginJson(req)) return refuse(403, 'invalid_request', 'Invalid request.');
    if (LIVEKIT_URL === undefined) throw new Error('LIVEKIT_URL is not defined');
    if (API_KEY === undefined) throw new Error('LIVEKIT_API_KEY is not defined');
    if (API_SECRET === undefined) throw new Error('LIVEKIT_API_SECRET is not defined');

    const body = (await req.json().catch(() => ({}))) ?? {};
    const personaId = resolvePersonaId(body.persona ?? body.selected_agent);
    const persona = PERSONA_CARDS.find((c) => c.id === personaId)!;

    const { supabase, user } = await getSessionUser();
    if (!user && process.env.ALLOW_GUESTS === 'false') {
      return refuse(401, 'sign_in_required', 'Please sign in to talk to your teacher.');
    }

    if (body.mode === 'course' && (!supabase || !user)) {
      return refuse(401, 'sign_in_required', 'Sign in to save your course and progress.');
    }
    const mode = body.mode === 'course' ? 'course' : 'free';
    const secret = byokSecret();
    const [sealedKey, course] = await Promise.all([
      (async () => {
        if (!secret) return undefined;
        const offered = body.byok;
        if (isByokProvider(offered?.provider) && looksLikeApiKey(offered?.key))
          return sealUserKey({ provider: offered.provider, key: offered.key }, secret);
        if (!supabase || !user) return undefined;
        const { data } = await supabase
          .from('user_api_keys')
          .select('sealed_key')
          .eq('user_id', user.id)
          .maybeSingle();
        return data?.sealed_key ?? undefined;
      })(),
      mode === 'course' && supabase && user
        ? resolveCallCourse(supabase, user.id, body)
        : Promise.resolve(null),
    ]);
    if (!sealedKey && process.env.REQUIRE_BYOK === 'true') {
      return refuse(402, 'api_key_required', 'Add your own API key in Settings to start a call.');
    }
    if (mode === 'course' && !course)
      return refuse(409, 'course_unavailable', 'Choose your course again before starting.');
    if (course && body.unit_id !== undefined) {
      revalidatePath('/');
      revalidatePath('/profile');
      revalidatePath('/courses');
    }
    // || not ??: a guest (anonymous user) has an empty email, not none
    const participantName =
      (user?.user_metadata?.display_name as string | undefined) ||
      user?.email?.split('@')[0] ||
      'Guest';
    const roomName = `speakwow_${randomUUID()}`;
    const metadata = {
      persona: persona.id,
      agent: persona.display_name, // read by agents older than persona ids
      student_id: user?.id,
      mode,
      course_id: course?.courseId,
      unit_id: course?.unitId,
      byok: sealedKey,
      native_language: languageTag(body.native_language),
    };

    const participantToken = await createParticipantToken(
      { identity: user ? `user_${user.id}` : `guest_${randomUUID()}`, name: participantName },
      roomName,
      JSON.stringify(metadata)
    );

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken,
      participantName,
    };
    return NextResponse.json(data, {
      headers: new Headers({ 'Cache-Control': 'no-store' }),
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Could not start the call';
    return refuse(500, 'connection_failed', message);
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  metadata: string
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, { ...userInfo, ttl: '15m' });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  at.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: DISPATCH_NAME, metadata })],
  });

  return at.toJwt();
}
