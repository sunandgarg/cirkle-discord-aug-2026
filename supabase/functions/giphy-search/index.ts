import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const GIPHY_API_KEY = Deno.env.get('GIPHY_API_KEY');
  if (!GIPHY_API_KEY) {
    return new Response(JSON.stringify({ error: 'GIPHY_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { q, type = 'gifs', limit = 20, offset = 0 } = await req.json();

    // Support both 'gifs' and 'stickers' types
    const apiType = type === 'stickers' ? 'stickers' : 'gifs';
    let url: string;
    if (q && q.trim()) {
      url = `https://api.giphy.com/v1/${apiType}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&rating=pg-13&lang=en`;
    } else {
      url = `https://api.giphy.com/v1/${apiType}/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&offset=${offset}&rating=pg-13`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Giphy API error [${response.status}]: ${await response.text()}`);
    }

    const data = await response.json();

    // Return minimal data to reduce payload
    const results = data.data.map((gif: any) => ({
      id: gif.id,
      title: gif.title,
      url: gif.images.fixed_height.url,
      preview: gif.images.fixed_height_small.url || gif.images.preview_gif?.url || gif.images.fixed_height.url,
      width: parseInt(gif.images.fixed_height.width),
      height: parseInt(gif.images.fixed_height.height),
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Giphy search error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
