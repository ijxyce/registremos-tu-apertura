import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const { codigo_vendedor, nombre, pin, rol } = await req.json();

    if (!codigo_vendedor || !nombre || !pin || !rol) {
      return NextResponse.json(
        { error: "Faltan datos." },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "El PIN debe tener 4 dígitos." },
        { status: 400 }
      );
    }

    const pin_hash = await bcrypt.hash(pin, 10);

    const { error } = await supabaseAdmin.from("usuarios").insert([
      {
        codigo_vendedor,
        nombre,
        rol,
        pin_hash,
        activo: true,
      },
    ]);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Error al crear usuario." },
      { status: 500 }
    );
  }
}