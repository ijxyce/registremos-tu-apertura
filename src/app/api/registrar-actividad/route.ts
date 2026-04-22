import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "../../../lib/session";
import { supabaseAdmin } from "../../../lib/supabase-admin";

type TipoActividad = "CMR" | "CUENTA_CORRIENTE" | "ESCANEO";

function getValor(tipo: TipoActividad) {
  if (tipo === "ESCANEO") return 500;
  if (tipo === "CMR") return 2500; // base, luego puedes escalar por nivel si quieres
  if (tipo === "CUENTA_CORRIENTE") return 1250;
  return 0;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("rta_session")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 }
      );
    }

    const session = await verifySessionToken(token);

    const { tipo, rut_cliente, detalle } = await req.json();

    if (!tipo) {
      return NextResponse.json(
        { error: "Falta tipo de actividad." },
        { status: 400 }
      );
    }

    const valor = getValor(tipo);

    const { error } = await supabaseAdmin.from("aperturas").insert([
      {
        codigo_vendedor: session.codigo,
        nombre_vendedor: session.nombre,
        rol_vendedor: session.rol,
        rut_cliente,
        tipo,
        valor,
        detalle,
        fecha: new Date().toISOString(),
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
      { error: "Error al registrar actividad." },
      { status: 500 }
    );
  }
}