export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');

  console.log('[places/autocomplete] input:', input);
  console.log('[places/autocomplete] key defined:', !!process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY);

  if (!input || input.trim().length < 2) {
    return Response.json({ suggestions: [] });
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key) {
    console.log('[places/autocomplete] ERROR: API key is undefined');
    return Response.json({ suggestions: [] }, { status: 500 });
  }

  const url = 'https://places.googleapis.com/v1/places:autocomplete';
  console.log('[places/autocomplete] calling URL:', url, 'with input:', input.trim());

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
      },
      body: JSON.stringify({
        input: input.trim(),
        includedPrimaryTypes: ['establishment'],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log('[places/autocomplete] fetch error:', res.status, errText);
      return Response.json({ suggestions: [] });
    }

    const data = await res.json();
    console.log('[places/autocomplete] response preview:', JSON.stringify(data).slice(0, 300));
    return Response.json(data);
  } catch (err) {
    console.log('[places/autocomplete] fetch threw:', err);
    return Response.json({ suggestions: [] });
  }
}
