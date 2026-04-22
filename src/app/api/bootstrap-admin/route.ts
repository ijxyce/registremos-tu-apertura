import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export async function GET() {
  const { count, error } = await supabaseAdmin
    .from("usuarios")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    needsBootstrap: (count ?? 0) === 0,
  });
}

export async function POST(req: Request) {
  try {
    const { count, error: countError } = await supabaseAdmin
      .from("usuarios")
      .select("*", { count: "exact", head: true });

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "El administrador inicial ya fue creado." },
        { status: 400 }
      );
    }

    const { codigo_vendedor, nombre, pin } = await req.json();

    if (!codigo_vendedor || !nombre || !pin) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
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
        rol: "administrador",
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
      { error: "Error al crear administrador inicial." },
      { status: 500 }
    );
  }
}