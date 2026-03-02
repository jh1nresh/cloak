import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET (" + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 20) + "...)" : "MISSING",
    fashnApiKey: process.env.FASHN_API_KEY ? "SET" : "MISSING",
  });
}
