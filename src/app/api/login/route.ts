import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { createSessionToken } from "../../../lib/session";

export async function POST(req: Request) {
  try {
    const { codigo, pin } = await req.json();

    if (!codigo || !pin) {
      return NextResponse.json(
        { error: "Debes ingresar código y PIN." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("usuarios")
      .select("codigo_vendedor, nombre, rol, pin_hash, activo")
      .eq("codigo_vendedor", codigo)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 401 }
      );
    }

    if (!data.activo) {
      return NextResponse.json(
        { error: "Usuario inactivo." },
        { status: 403 }
      );
    }

    const ok = await bcrypt.compare(pin, data.pin_hash);

    if (!ok) {
      return NextResponse.json(
        { error: "PIN incorrecto." },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      codigo: data.codigo_vendedor,
      nombre: data.nombre,
      rol: data.rol,
    });

    const res = NextResponse.json({
      ok: true,
      user: {
        codigo: data.codigo_vendedor,
        nombre: data.nombre,
        rol: data.rol,
      },
    });

    res.cookies.set("rta_session", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: "Error al iniciar sesión." },
      { status: 500 }
    );
  }
}