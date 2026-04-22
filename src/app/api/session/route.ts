import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("rta_session")?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const payload = await verifySessionToken(token);

    return NextResponse.json({
      user: {
        codigo: payload.codigo,
        nombre: payload.nombre,
        rol: payload.rol,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}