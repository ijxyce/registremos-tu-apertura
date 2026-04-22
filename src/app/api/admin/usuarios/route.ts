import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { verifySessionToken } from "../../../../lib/session";

function cleanRut(value: string) {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("rta_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const session = await verifySessionToken(token);

    if (session.rol !== "administrador") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("usuarios")
      .select("id, codigo_vendedor, nombre, rut, rol, activo, created_at")
      .order("nombre");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ usuarios: data ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Error al cargar usuarios." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("rta_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const session = await verifySessionToken(token);

    if (session.rol !== "administrador") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { codigo_vendedor, nombre, rut, pin, rol } = await req.json();

    if (!codigo_vendedor || !nombre || !rut || !pin || !rol) {
      return NextResponse.json(
        { error: "Faltan datos para crear usuario." },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "El PIN debe tener 4 dígitos." },
        { status: 400 }
      );
    }

    if (!["vendedor", "jefe", "administrador"].includes(rol)) {
      return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
    }

    const pin_hash = await bcrypt.hash(pin, 10);

    const { error } = await supabaseAdmin.from("usuarios").insert([
      {
        codigo_vendedor,
        nombre,
        rut: cleanRut(rut),
        rol,
        pin_hash,
        activo: true,
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Error al crear usuario." },
      { status: 500 }
    );
  }
}