import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { verifySessionToken } from "../../../lib/session";

type TipoSeguro = "COMPRA_PROTEGIDA" | "SEGURO_VIDA";

function getChileDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getChileOffset() {
  const now = new Date();
  const chileNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Santiago" })
  );
  const diffMinutes = Math.round((chileNow.getTime() - now.getTime()) / 60000);
  const sign = diffMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(diffMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("rta_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    const { tipo, rut_cliente, detalle } = await req.json();

    if (!tipo) {
      return NextResponse.json({ error: "Falta el tipo de seguro." }, { status: 400 });
    }

    if (!rut_cliente) {
      return NextResponse.json({ error: "El RUT es obligatorio en seguros." }, { status: 400 });
    }

    const hoyChile = getChileDateString();
    const offset = getChileOffset();
    const inicioChile = `${hoyChile}T00:00:00${offset}`;
    const finChile = `${hoyChile}T23:59:59${offset}`;

    const { data: duplicados, error: dupError } = await supabaseAdmin
      .from("seguros")
      .select("id")
      .eq("codigo_vendedor", session.codigo)
      .eq("rut_cliente", rut_cliente)
      .eq("tipo", tipo)
      .gte("fecha", inicioChile)
      .lte("fecha", finChile);

    if (dupError) {
      return NextResponse.json({ error: dupError.message }, { status: 500 });
    }

    if ((duplicados ?? []).length > 0) {
      return NextResponse.json(
        { error: "Este RUT ya fue registrado hoy en ese tipo de seguro." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("seguros").insert([
      {
        codigo_vendedor: session.codigo,
        nombre_vendedor: session.nombre,
        rut_vendedor: session.rut,
        rol_vendedor: session.rol,
        rut_cliente,
        tipo,
        valor: 3000,
        detalle: detalle || null,
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Error al registrar seguro." },
      { status: 500 }
    );
  }
}