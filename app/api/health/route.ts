import { NextResponse } from "next/server";

export async function GET() {
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json(
    {
      ok: true,
      supabase: {
        configured: supabaseConfigured,
      },
    },
    { status: 200 }
  );
}
