import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { verifySessionToken } from "../../../lib/session";

type TipoActividad = "CMR" | "CUENTA_CORRIENTE" | "ESCANEO";

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

function getNivelInfo(totalAperturas: number) {
  if (totalAperturas <= 0) return { recompensaCMR: 2500, recompensaCC: 1250 };
  if (totalAperturas >= 1 && totalAperturas <= 2) return { recompensaCMR: 2500, recompensaCC: 1250 };
  if (totalAperturas >= 3 && totalAperturas <= 7) return { recompensaCMR: 3500, recompensaCC: 2000 };
  return { recompensaCMR: 4500, recompensaCC: 3000 };
}

function getValorActividad(totalAperturasPrevias: number, tipo: TipoActividad) {
  if (tipo === "ESCANEO") return 500;
  const tramo = getNivelInfo(totalAperturasPrevias);
  if (tipo === "CMR") return tramo.recompensaCMR;
  return tramo.recompensaCC;
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
      return NextResponse.json({ error: "Falta el tipo." }, { status: 400 });
    }

    if (tipo !== "ESCANEO" && !rut_cliente) {
      return NextResponse.json(
        { error: "El RUT es obligatorio para aperturas." },
        { status: 400 }
      );
    }

    const hoyChile = getChileDateString();
    const offset = getChileOffset();
    const inicioChile = `${hoyChile}T00:00:00${offset}`;
    const finChile = `${hoyChile}T23:59:59${offset}`;

    if (tipo !== "ESCANEO" && rut_cliente) {
      const { data: duplicados, error: dupError } = await supabaseAdmin
        .from("aperturas")
        .select("id")
        .eq("codigo_vendedor", session.codigo)
        .eq("rut_cliente", rut_cliente)
        .gte("fecha", inicioChile)
        .lte("fecha", finChile);

      if (dupError) {
        return NextResponse.json({ error: dupError.message }, { status: 500 });
      }

      if ((duplicados ?? []).length > 0) {
        return NextResponse.json(
          { error: "Este RUT ya fue registrado hoy por este vendedor." },
          { status: 400 }
        );
      }
    }

    const { count, error: countError } = await supabaseAdmin
      .from("aperturas")
      .select("*", { count: "exact", head: true })
      .eq("codigo_vendedor", session.codigo)
      .in("tipo", ["CMR", "CUENTA_CORRIENTE"]);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const valor = getValorActividad(count ?? 0, tipo);

    const { error } = await supabaseAdmin.from("aperturas").insert([
      {
        codigo_vendedor: session.codigo,
        nombre_vendedor: session.nombre,
        rut_vendedor: session.rut,
        rol_vendedor: session.rol,
        rut_cliente: tipo === "ESCANEO" ? null : rut_cliente,
        tipo,
        valor,
        detalle: detalle || null,
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Error al registrar actividad." },
      { status: 500 }
    );
  }
}