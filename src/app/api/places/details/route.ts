export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('place_id');

  console.log('[places/details] place_id:', placeId);
  console.log('[places/details] key defined:', !!process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY);

  if (!placeId) {
    return Response.json({});
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key) {
    console.log('[places/details] ERROR: API key is undefined');
    return Response.json({}, { status: 500 });
  }

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  console.log('[places/details] calling URL:', url);

  try {
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'displayName,addressComponents',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log('[places/details] fetch error:', res.status, errText);
      return Response.json({});
    }

    const data = await res.json();
    console.log('[places/details] response preview:', JSON.stringify(data).slice(0, 300));
    return Response.json(data);
  } catch (err) {
    console.log('[places/details] fetch threw:', err);
    return Response.json({});
  }
}
