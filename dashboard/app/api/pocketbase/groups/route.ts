import { NextResponse } from 'next/server';
import { fetchGroups } from '@/lib/pocketbase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const since = searchParams.get('since') || undefined;

  try {
    const groups = await fetchGroups({ limit, since });
    return NextResponse.json({ groups });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
}
