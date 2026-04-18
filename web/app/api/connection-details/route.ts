import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';

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

export async function POST(req: Request) {
  try {
    if (LIVEKIT_URL === undefined) throw new Error('LIVEKIT_URL is not defined');
    if (API_KEY === undefined) throw new Error('LIVEKIT_API_KEY is not defined');
    if (API_SECRET === undefined) throw new Error('LIVEKIT_API_SECRET is not defined');

    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      // Empty or invalid body — default to Frank
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selected = ((body as any)?.selected_agent as string) ?? 'Frank';
    const agent = selected === 'Lucy' ? 'Lucy' : 'Frank';

    const participantName = 'You';
    const participantIdentity = `user_${Math.floor(Math.random() * 100_000)}`;
    const roomName = `speakwow_${Math.floor(Math.random() * 100_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      agent
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
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  selectedAgent: string
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
    agents: [
      new RoomAgentDispatch({
        agentName: DISPATCH_NAME,
        metadata: JSON.stringify({ agent: selectedAgent }),
      }),
    ],
  });

  return at.toJwt();
}
