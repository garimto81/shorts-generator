import { NextResponse } from 'next/server';
import { fetchPhotos, getPhotoCount } from '@/lib/pocketbase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const groupId = searchParams.get('groupId') || undefined;
  const since = searchParams.get('since') || undefined;
  const countOnly = searchParams.get('countOnly') === 'true';

  try {
    if (countOnly) {
      const count = await getPhotoCount();
      return NextResponse.json({ count });
    }

    const photos = await fetchPhotos({ limit, groupId, since });
    return NextResponse.json({ photos });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}
