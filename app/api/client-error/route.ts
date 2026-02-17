 import { NextResponse } from "next/server";
 
 export async function POST(request: Request) {
   try {
     const body = await request.json().catch(() => null);
     // Log server-side for visibility in deployment logs.
     console.error("ClientErrorReporter:", body);
   } catch (error) {
     console.error("ClientErrorReporter: failed to parse payload", error);
   }
 
   return NextResponse.json({ ok: true });
 }
