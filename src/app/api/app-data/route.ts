import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "../../../lib/session";
import { supabaseAdmin } from "../../../lib/supabase-admin";

type TipoActividad = "CMR" | "CUENTA_CORRIENTE" | "ESCANEO";

function isApertura(tipo: TipoActividad) {
  return tipo === "CMR" || tipo === "CUENTA_CORRIENTE";
}

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

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("rta_session")?.value;

    if (!token) {
      return NextResponse.json({
        user: null,
        registros: [],
        ranking: [],
        usuarios: [],
      });
    }

    const session = await verifySessionToken(token);

    const { data: registros, error } = await supabaseAdmin
      .from("aperturas")
      .select(
        "id, codigo_vendedor, nombre_vendedor, rol_vendedor, rut_cliente, fecha, tipo, valor, detalle"
      )
      .order("fecha", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const hoyChile = getChileDateString();
    const offset = getChileOffset();
    const inicioChile = `${hoyChile}T00:00:00${offset}`;
    const finChile = `${hoyChile}T23:59:59${offset}`;

    const { data: rankingData, error: rankingError } = await supabaseAdmin
      .from("aperturas")
      .select("codigo_vendedor, nombre_vendedor, tipo, fecha")
      .gte("fecha", inicioChile)
      .lte("fecha", finChile);

    if (rankingError) {
      return NextResponse.json({ error: rankingError.message }, { status: 500 });
    }

    const agrupado = new Map<string, { nombre: string; total: number }>();

    (rankingData ?? []).forEach((item: any) => {
      if (!isApertura(item.tipo)) return;

      const key = item.codigo_vendedor;
      const actual = agrupado.get(key) ?? {
        nombre: item.nombre_vendedor ?? item.codigo_vendedor,
        total: 0,
      };

      actual.total += 1;
      agrupado.set(key, actual);
    });

    const ranking = Array.from(agrupado.entries())
      .map(([codigo_vendedor, value]) => ({
        codigo_vendedor,
        nombre_vendedor: value.nombre,
        total: value.total,
      }))
      .sort((a, b) => b.total - a.total);

    let usuarios: any[] = [];

    if (session.rol === "administrador") {
      const { data: usuariosData, error: usuariosError } = await supabaseAdmin
        .from("usuarios")
        .select("id, codigo_vendedor, nombre, rol, activo, created_at")
        .order("nombre");

      if (usuariosError) {
        return NextResponse.json({ error: usuariosError.message }, { status: 500 });
      }

      usuarios = usuariosData ?? [];
    }

    return NextResponse.json({
      user: {
        codigo: session.codigo,
        nombre: session.nombre,
        rol: session.rol,
      },
      registros: registros ?? [],
      ranking,
      usuarios,
    });
  } catch {
    return NextResponse.json({
      user: null,
      registros: [],
      ranking: [],
      usuarios: [],
    });
  }
}