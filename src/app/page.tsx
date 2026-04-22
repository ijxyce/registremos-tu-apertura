"use client";

import { useEffect, useMemo, useState } from "react";

type Vista = "dashboard" | "mis_registros" | "metas" | "exportar" | "panel_jefe" | "admin";
type TipoActividad = "CMR" | "CUENTA_CORRIENTE" | "ESCANEO";
type Rol = "vendedor" | "jefe" | "administrador";

type User = {
  codigo: string;
  nombre: string;
  rol: Rol;
};

type Registro = {
  id: number;
  codigo_vendedor: string;
  nombre_vendedor: string | null;
  rol_vendedor: Rol | null;
  rut_cliente: string | null;
  fecha: string;
  tipo: TipoActividad;
  valor: number;
  detalle: string | null;
};

type RankingItem = {
  codigo_vendedor: string;
  nombre_vendedor: string;
  total: number;
};

type UsuarioAdmin = {
  id: string;
  codigo_vendedor: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
};

type NivelInfo = {
  nombre: string;
  recompensaCMR: number;
  recompensaCC: number;
  siguienteNivel: string | null;
  faltan: number;
  progreso: number;
  mensaje: string;
};

const META_DIARIA_APERTURAS = 8;
const META_SEMANAL_APERTURAS = 30;

const TIPOS_CONFIG: Record<
  TipoActividad,
  {
    label: string;
    detalle: string;
    color: string;
    bg: string;
    border: string;
    activeBg: string;
    activeText: string;
  }
> = {
  CMR: {
    label: "Apertura CMR",
    detalle: "Apertura CMR",
    color: "text-[#1f7a1f]",
    bg: "bg-[#edf8e8]",
    border: "border-[#9ed48d]",
    activeBg: "bg-[#2fa11b]",
    activeText: "text-white",
  },
  CUENTA_CORRIENTE: {
    label: "Cuenta Corriente",
    detalle: "Apertura cuenta corriente",
    color: "text-[#166534]",
    bg: "bg-[#ebfbf1]",
    border: "border-[#9ed4b2]",
    activeBg: "bg-[#166534]",
    activeText: "text-white",
  },
  ESCANEO: {
    label: "Escaneo",
    detalle: "Escaneo sin resultado",
    color: "text-[#374151]",
    bg: "bg-[#f3f4f6]",
    border: "border-[#d1d5db]",
    activeBg: "bg-[#4b5563]",
    activeText: "text-white",
  },
};

function cleanRut(value: string) {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

function formatRut(value: string) {
  const cleaned = cleanRut(value);
  if (cleaned.length <= 1) return cleaned;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

function validateRut(rut: string) {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  let expected = "";

  if (remainder === 11) expected = "0";
  else if (remainder === 10) expected = "K";
  else expected = String(remainder);

  return expected === dv;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function getChileDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getChileDateOnlyFromISO(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function isApertura(tipo: TipoActividad) {
  return tipo === "CMR" || tipo === "CUENTA_CORRIENTE";
}

function getNivelInfo(totalAperturas: number): NivelInfo {
  if (totalAperturas <= 0) {
    return {
      nombre: "Inicio",
      recompensaCMR: 2500,
      recompensaCC: 1250,
      siguienteNivel: "Avanzado",
      faltan: 3,
      progreso: 0,
      mensaje: "Te faltan 3 aperturas para subir a Avanzado.",
    };
  }

  if (totalAperturas >= 1 && totalAperturas <= 2) {
    const faltan = 3 - totalAperturas;
    return {
      nombre: "Aprendiz",
      recompensaCMR: 2500,
      recompensaCC: 1250,
      siguienteNivel: "Avanzado",
      faltan,
      progreso: (totalAperturas / 3) * 100,
      mensaje:
        faltan === 1
          ? "Te falta 1 apertura para subir a Avanzado."
          : `Te faltan ${faltan} aperturas para subir a Avanzado.`,
    };
  }

  if (totalAperturas >= 3 && totalAperturas <= 7) {
    const faltan = 8 - totalAperturas;
    return {
      nombre: "Avanzado",
      recompensaCMR: 3500,
      recompensaCC: 2000,
      siguienteNivel: "Maestro",
      faltan,
      progreso: ((totalAperturas - 3) / 5) * 100,
      mensaje:
        faltan === 1
          ? "Te falta 1 apertura para subir a Maestro."
          : `Te faltan ${faltan} aperturas para subir a Maestro.`,
    };
  }

  return {
    nombre: "Maestro",
    recompensaCMR: 4500,
    recompensaCC: 3000,
    siguienteNivel: null,
    faltan: 0,
    progreso: 100,
    mensaje: "Ya estás en el nivel más alto.",
  };
}

function exportRowsToCsv(filename: string, rows: Record<string, string | number | null>[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const escapeValue = (value: string | number | null) => {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getMedal(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}

function getMedalBg(index: number) {
  if (index === 0) return "bg-yellow-50 border-yellow-200";
  if (index === 1) return "bg-slate-50 border-slate-300";
  if (index === 2) return "bg-orange-50 border-orange-200";
  return "bg-white border-[#d8e2d2]";
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [vistaActiva, setVistaActiva] = useState<Vista>("dashboard");

  const [codigoLogin, setCodigoLogin] = useState("");
  const [pinLogin, setPinLogin] = useState("");

  const [bootstrapNeeded, setBootstrapNeeded] = useState(false);
  const [bootstrapCodigo, setBootstrapCodigo] = useState("");
  const [bootstrapNombre, setBootstrapNombre] = useState("");
  const [bootstrapPin, setBootstrapPin] = useState("");

  const [rutCliente, setRutCliente] = useState("");
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoActividad>("CMR");

  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPin, setNuevoPin] = useState("");
  const [nuevoRol, setNuevoRol] = useState<Rol>("vendedor");

  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const esJefe = user?.rol === "jefe" || user?.rol === "administrador";
  const esAdmin = user?.rol === "administrador";

  const cargarBootstrap = async () => {
    const res = await fetch("/api/bootstrap-admin", { cache: "no-store" });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      setError(data.error || "No se pudo validar el administrador inicial.");
      return;
    }

    setBootstrapNeeded(Boolean(data.needsBootstrap));
  };

  const cargarApp = async () => {
    setError("");

    const res = await fetch("/api/app-data", {
      method: "GET",
      cache: "no-store",
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      setError(data.error || "Error al cargar la app.");
      return false;
    }

    setUser(data.user ?? null);
    setRegistros(data.registros ?? []);
    setRanking(data.ranking ?? []);
    setUsuarios(data.usuarios ?? []);

    return true;
  };

  useEffect(() => {
    cargarBootstrap();
    cargarApp();
  }, []);

  const registrosDelUsuario = useMemo(() => {
    if (!user) return [];
    return registros.filter((r) => r.codigo_vendedor === user.codigo);
  }, [registros, user]);

  const registrosFiltrados = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    if (!term) return registrosDelUsuario;

    return registrosDelUsuario.filter(
      (r) =>
        r.codigo_vendedor.toLowerCase().includes(term) ||
        (r.nombre_vendedor ?? "").toLowerCase().includes(term) ||
        (r.rut_cliente ?? "").toLowerCase().includes(term) ||
        TIPOS_CONFIG[r.tipo].label.toLowerCase().includes(term)
    );
  }, [busqueda, registrosDelUsuario]);

  const aperturasDelUsuario = useMemo(
    () => registrosDelUsuario.filter((r) => isApertura(r.tipo)),
    [registrosDelUsuario]
  );

  const escaneosDelUsuario = useMemo(
    () => registrosDelUsuario.filter((r) => r.tipo === "ESCANEO"),
    [registrosDelUsuario]
  );

  const totalAperturas = aperturasDelUsuario.length;
  const totalEscaneos = escaneosDelUsuario.length;
  const totalCMR = registrosDelUsuario.filter((r) => r.tipo === "CMR").length;
  const totalCuentaCorriente = registrosDelUsuario.filter((r) => r.tipo === "CUENTA_CORRIENTE").length;

  const aperturasHoy = useMemo(() => {
    const hoy = getChileDateString();
    return aperturasDelUsuario.filter((r) => getChileDateOnlyFromISO(r.fecha) === hoy).length;
  }, [aperturasDelUsuario]);

  const escaneosHoy = useMemo(() => {
    const hoy = getChileDateString();
    return escaneosDelUsuario.filter((r) => getChileDateOnlyFromISO(r.fecha) === hoy).length;
  }, [escaneosDelUsuario]);

  const totalDinero = useMemo(() => {
    return registrosDelUsuario.reduce((acc, item) => acc + (item.valor ?? 0), 0);
  }, [registrosDelUsuario]);

  const dineroHoy = useMemo(() => {
    const hoy = getChileDateString();
    return registrosDelUsuario
      .filter((r) => getChileDateOnlyFromISO(r.fecha) === hoy)
      .reduce((acc, r) => acc + r.valor, 0);
  }, [registrosDelUsuario]);

  const nivel = getNivelInfo(totalAperturas);
  const miPosicionRanking = user
    ? ranking.findIndex((item) => item.codigo_vendedor === user.codigo) + 1
    : 0;

  const aperturasSemana = useMemo(() => {
    const hoy = new Date();
    const hace7 = new Date();
    hace7.setDate(hoy.getDate() - 6);
    return aperturasDelUsuario.filter((r) => new Date(r.fecha) >= hace7).length;
  }, [aperturasDelUsuario]);

  const crearBootstrapAdmin = async () => {
    setError("");
    setMensaje("");

    const res = await fetch("/api/bootstrap-admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codigo_vendedor: bootstrapCodigo,
        nombre: bootstrapNombre,
        pin: bootstrapPin,
      }),
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      setError(data.error || "No se pudo crear el administrador inicial.");
      return;
    }

    setMensaje("Administrador inicial creado correctamente.");
    setBootstrapNeeded(false);
  };

  const handleLogin = async () => {
    setError("");
    setMensaje("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codigo: codigoLogin,
        pin: pinLogin,
      }),
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      setError(data.error || "No se pudo iniciar sesión.");
      return;
    }

    const ok = await cargarApp();

    if (!ok) {
      setError("La sesión se creó, pero no se pudo cargar la app.");
      return;
    }

    setCodigoLogin("");
    setPinLogin("");
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
    setRegistros([]);
    setRanking([]);
    setUsuarios([]);
    setVistaActiva("dashboard");
    setMensaje("");
    setError("");
    await cargarBootstrap();
  };

  const handleGuardar = async () => {
    setError("");
    setMensaje("");

    const requiereRut = tipoSeleccionado !== "ESCANEO";
    const rutFormateado = formatRut(rutCliente);

    if (requiereRut && !rutCliente.trim()) {
      setError("Debes ingresar el RUT del cliente.");
      return;
    }

    if (requiereRut && !validateRut(rutCliente)) {
      setError("El RUT ingresado no es válido.");
      return;
    }

    const res = await fetch("/api/registrar-actividad", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipo: tipoSeleccionado,
        rut_cliente: requiereRut ? rutFormateado : null,
        detalle: TIPOS_CONFIG[tipoSeleccionado].detalle,
      }),
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      setError(data.error || "No se pudo registrar la actividad.");
      return;
    }

    setRutCliente("");
    setTipoSeleccionado("CMR");
    setMensaje("Actividad registrada correctamente.");
    await cargarApp();
  };

  const crearUsuario = async () => {
    setError("");
    setMensaje("");

    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codigo_vendedor: nuevoCodigo,
        nombre: nuevoNombre,
        pin: nuevoPin,
        rol: nuevoRol,
      }),
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      setError(data.error || "No se pudo crear el usuario.");
      return;
    }

    setNuevoCodigo("");
    setNuevoNombre("");
    setNuevoPin("");
    setNuevoRol("vendedor");
    setMensaje("Usuario creado correctamente.");
    await cargarApp();
  };

  const exportarMisRegistros = () => {
    const rows = registrosDelUsuario.map((registro) => ({
      fecha: new Date(registro.fecha).toLocaleString("es-CL"),
      tipo: TIPOS_CONFIG[registro.tipo].label,
      detalle: registro.detalle ?? "",
      rut: registro.rut_cliente ?? "",
      valor: registro.valor,
      codigo: registro.codigo_vendedor,
      nombre: registro.nombre_vendedor ?? "",
    }));

    exportRowsToCsv(`mis-registros-${user?.codigo ?? "usuario"}.csv`, rows);
  };

  const exportarRanking = () => {
    const rows = ranking.map((item, index) => ({
      posicion: index + 1,
      codigo_vendedor: item.codigo_vendedor,
      nombre_vendedor: item.nombre_vendedor,
      aperturas_hoy: item.total,
    }));

    exportRowsToCsv(`ranking-diario-${getChileDateString()}.csv`, rows);
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#f3f8ef] via-white to-[#eef7ea] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[28px] shadow-xl p-6 border border-[#dfe8d8]">
          <div className="text-center mb-6">
            <p className="text-xs uppercase tracking-[0.25em] text-[#7a8c72]">
              Sistema comercial
            </p>
            <h1 className="text-3xl font-bold text-[#2d5d22] mt-3">
              Registremos Tu Apertura
            </h1>
            <p className="text-[#687761] mt-3">
              Acceso con código y PIN de 4 dígitos
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-3 text-sm">
              {error}
            </div>
          )}

          {mensaje && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl p-3 text-sm">
              {mensaje}
            </div>
          )}

          {bootstrapNeeded ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[#2d5d22]">
                Crear administrador inicial
              </p>

              <input
                type="text"
                value={bootstrapCodigo}
                onChange={(e) => setBootstrapCodigo(e.target.value)}
                placeholder="Código vendedor"
                className="w-full border border-[#cfe0c4] rounded-2xl px-4 py-3 outline-none"
              />

              <input
                type="text"
                value={bootstrapNombre}
                onChange={(e) => setBootstrapNombre(e.target.value)}
                placeholder="Nombre completo"
                className="w-full border border-[#cfe0c4] rounded-2xl px-4 py-3 outline-none"
              />

              <input
                type="password"
                value={bootstrapPin}
                onChange={(e) => setBootstrapPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="PIN 4 dígitos"
                className="w-full border border-[#cfe0c4] rounded-2xl px-4 py-3 outline-none"
              />

              <button
                onClick={crearBootstrapAdmin}
                className="w-full bg-[#2b8a1f] hover:bg-[#236f19] text-white rounded-2xl py-4 font-semibold text-lg"
              >
                Crear administrador
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="text"
                value={codigoLogin}
                onChange={(e) => setCodigoLogin(e.target.value)}
                placeholder="Código vendedor"
                className="w-full border border-[#cfe0c4] rounded-2xl px-4 py-3 outline-none"
              />

              <input
                type="password"
                value={pinLogin}
                onChange={(e) => setPinLogin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="PIN 4 dígitos"
                className="w-full border border-[#cfe0c4] rounded-2xl px-4 py-3 outline-none"
              />

              <button
                onClick={handleLogin}
                className="w-full bg-[#2b8a1f] hover:bg-[#236f19] text-white rounded-2xl py-4 font-semibold text-lg"
              >
                Ingresar
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  const errorVisible = error ? (
    <div className="mx-4 md:mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">
      {error}
    </div>
  ) : null;

  const renderDashboard = () => (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-[#e7ece2]">
          <p className="text-sm text-[#5c6e56]">Aperturas</p>
          <p className="text-4xl md:text-5xl font-bold text-[#0b7a33] mt-3">{totalAperturas}</p>
        </div>

        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-[#e7ece2]">
          <p className="text-sm text-[#5c6e56]">Aperturas hoy</p>
          <p className="text-4xl md:text-5xl font-bold text-[#0b7a33] mt-3">{aperturasHoy}</p>
        </div>

        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-[#e7ece2]">
          <p className="text-sm text-[#5c6e56]">Escaneos hoy</p>
          <p className="text-4xl md:text-5xl font-bold text-[#0b7a33] mt-3">{escaneosHoy}</p>
        </div>

        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-[#e7ece2]">
          <p className="text-sm text-[#5c6e56]">Mi nivel</p>
          <p className="text-2xl md:text-3xl font-bold text-[#0b7a33] mt-3">{nivel.nombre}</p>
          <p className="text-sm text-[#62725b] mt-2">{nivel.mensaje}</p>
        </div>

        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-[#e7ece2] col-span-2 xl:col-span-1">
          <p className="text-sm text-[#5c6e56]">Dinero total</p>
          <p className="text-3xl md:text-4xl font-bold text-[#0b7a33] mt-3">{formatMoney(totalDinero)}</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1.15fr_1fr] gap-6">
        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
          <h2 className="text-2xl md:text-3xl font-bold text-[#222] mb-5">Registrar actividad</h2>

          <div>
            <p className="text-sm font-medium text-[#566555] mb-3">Selecciona el tipo</p>
            <div className="grid md:grid-cols-3 gap-3">
              {(Object.keys(TIPOS_CONFIG) as TipoActividad[]).map((tipo) => {
                const cfg = TIPOS_CONFIG[tipo];
                const active = tipoSeleccionado === tipo;
                const valorSugerido =
                  tipo === "ESCANEO"
                    ? 500
                    : tipo === "CMR"
                    ? nivel.recompensaCMR
                    : nivel.recompensaCC;

                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setTipoSeleccionado(tipo)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? `${cfg.activeBg} ${cfg.activeText} border-transparent shadow-sm`
                        : `${cfg.bg} ${cfg.border} ${cfg.color}`
                    }`}
                  >
                    <div className="font-bold text-base md:text-lg">{cfg.label}</div>
                    <div className="text-lg md:text-xl font-bold mt-2">
                      +{formatMoney(valorSugerido)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-[#566555] mb-2">
              RUT del cliente {tipoSeleccionado === "ESCANEO" ? "(opcional)" : ""}
            </label>
            <input
              type="text"
              value={rutCliente}
              onChange={(e) => setRutCliente(formatRut(e.target.value))}
              placeholder="12.345.678-5"
              className="w-full bg-[#fafcf8] border border-[#d1ddd0] rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-[#39b11c]"
            />
          </div>

          <button
            onClick={handleGuardar}
            className="w-full mt-5 bg-[#2fa11b] hover:bg-[#278817] text-white rounded-2xl py-4 text-lg md:text-xl font-bold"
          >
            Guardar actividad
          </button>

          {mensaje && (
            <div className="mt-4 bg-[#edf8e8] border border-green-200 text-green-700 rounded-2xl p-4">
              {mensaje}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-[#222]">Ranking diario</h2>
              <p className="text-[#62725b] mt-1">Solo aperturas</p>
            </div>
          </div>

          <div className="space-y-3">
            {ranking.length > 0 ? (
              ranking.slice(0, 10).map((item, index) => {
                const max = ranking[0]?.total || 1;
                const percent = (item.total / max) * 100;
                const isMe = item.codigo_vendedor === user.codigo;

                return (
                  <div
                    key={item.codigo_vendedor}
                    className={`rounded-2xl border px-4 py-4 ${getMedalBg(index)} ${
                      isMe ? "ring-2 ring-[#9ed48d]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg font-bold shadow-sm">
                          {getMedal(index)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#2f4f24] truncate">
                            {item.nombre_vendedor} · {item.codigo_vendedor}
                            {isMe && (
                              <span className="ml-2 bg-[#0b7a33] text-white text-xs px-2 py-1 rounded-lg">
                                Tú
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-[#62725b]">{item.total} aperturas</div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-[#0b7a33]">{item.total}</div>
                    </div>

                    <div className="mt-3 h-3 bg-[#e7ece2] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0b8f11] rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-[#fafcf8] rounded-2xl p-6 text-center text-[#62725b]">
                Aún no hay aperturas registradas hoy.
              </div>
            )}
          </div>

          <div className="mt-4 bg-[#fafcf8] rounded-2xl border border-[#d8e2d2] px-4 py-4">
            <p className="text-sm text-[#62725b]">Tu posición actual</p>
            <p className="text-2xl font-bold text-[#2f4f24]">
              {miPosicionRanking > 0 ? `${getMedal(miPosicionRanking - 1)} ${miPosicionRanking}` : "Sin posición aún"}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  const renderMisRegistros = () => (
    <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#222]">Mis registros</h2>
          <p className="text-[#62725b] mt-1">Historial completo de tus actividades</p>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar..."
          className="bg-[#fafcf8] border border-[#d1ddd0] rounded-2xl px-4 py-3 outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm md:text-base">
          <thead>
            <tr className="border-b border-[#dde7d8] text-left">
              <th className="py-3 pr-3 text-[#62725b]">Fecha</th>
              <th className="py-3 pr-3 text-[#62725b]">Tipo</th>
              <th className="py-3 pr-3 text-[#62725b]">Detalle</th>
              <th className="py-3 pr-3 text-[#62725b]">RUT</th>
              <th className="py-3 pr-3 text-[#62725b]">Valor</th>
            </tr>
          </thead>
          <tbody>
            {registrosFiltrados.length > 0 ? (
              registrosFiltrados.map((registro) => (
                <tr key={registro.id} className="border-b border-[#ebf0e7]">
                  <td className="py-4 pr-3 text-[#40523a]">
                    {new Date(registro.fecha).toLocaleString("es-CL")}
                  </td>
                  <td className="py-4 pr-3 text-[#40523a]">{TIPOS_CONFIG[registro.tipo].label}</td>
                  <td className="py-4 pr-3 text-[#40523a]">{registro.detalle ?? "-"}</td>
                  <td className="py-4 pr-3 text-[#40523a]">{registro.rut_cliente || "—"}</td>
                  <td className="py-4 pr-3 font-bold text-[#1f7a1f]">{formatMoney(registro.valor)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#62725b]">
                  Aún no tienes registros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMetas = () => {
    const progresoDia = Math.min((aperturasHoy / META_DIARIA_APERTURAS) * 100, 100);
    const progresoSemana = Math.min((aperturasSemana / META_SEMANAL_APERTURAS) * 100, 100);

    return (
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
          <h2 className="text-2xl md:text-3xl font-bold text-[#222]">Metas</h2>
          <p className="text-[#62725b] mt-1">Las metas consideran solo aperturas</p>

          <div className="mt-6 space-y-6">
            <div className="bg-[#fafcf8] rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#62725b]">Meta diaria</p>
                  <p className="text-2xl font-bold text-[#2f4f24]">
                    {aperturasHoy} / {META_DIARIA_APERTURAS}
                  </p>
                </div>
                <div className="text-right text-[#0b7a33] font-bold">
                  {Math.round(progresoDia)}%
                </div>
              </div>
              <div className="mt-4 h-4 bg-[#e8eee3] rounded-full overflow-hidden">
                <div className="h-full bg-[#2fa11b]" style={{ width: `${progresoDia}%` }} />
              </div>
            </div>

            <div className="bg-[#fafcf8] rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#62725b]">Meta semanal</p>
                  <p className="text-2xl font-bold text-[#2f4f24]">
                    {aperturasSemana} / {META_SEMANAL_APERTURAS}
                  </p>
                </div>
                <div className="text-right text-[#0b7a33] font-bold">
                  {Math.round(progresoSemana)}%
                </div>
              </div>
              <div className="mt-4 h-4 bg-[#e8eee3] rounded-full overflow-hidden">
                <div className="h-full bg-[#2fa11b]" style={{ width: `${progresoSemana}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
          <h2 className="text-2xl md:text-3xl font-bold text-[#222]">Resumen</h2>

          <div className="mt-6 grid gap-4">
            <div className="bg-[#fafcf8] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">Nivel actual</p>
              <p className="text-3xl font-bold text-[#2f4f24] mt-2">{nivel.nombre}</p>
            </div>

            <div className="bg-[#fafcf8] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">CMR</p>
              <p className="text-3xl font-bold text-[#2f4f24] mt-2">{totalCMR}</p>
            </div>

            <div className="bg-[#fafcf8] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">Cuenta Corriente</p>
              <p className="text-3xl font-bold text-[#2f4f24] mt-2">{totalCuentaCorriente}</p>
            </div>

            <div className="bg-[#fafcf8] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">Escaneos</p>
              <p className="text-3xl font-bold text-[#2f4f24] mt-2">{totalEscaneos}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderExportar = () => (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
        <h2 className="text-2xl md:text-3xl font-bold text-[#222]">Exportar Excel</h2>
        <p className="text-[#62725b] mt-1">Se descarga en CSV, compatible con Excel</p>

        <div className="mt-6 space-y-4">
          <button
            onClick={exportarMisRegistros}
            className="w-full bg-[#2fa11b] hover:bg-[#278817] text-white rounded-2xl py-4 text-lg font-bold"
          >
            Exportar mis registros
          </button>

          <button
            onClick={exportarRanking}
            className="w-full bg-[#fafcf8] border border-[#b7d7a8] text-[#2f4f24] rounded-2xl py-4 text-lg font-bold"
          >
            Exportar ranking diario
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
        <h2 className="text-2xl md:text-3xl font-bold text-[#222]">Resumen exportable</h2>

        <div className="mt-6 space-y-4">
          <div className="bg-[#fafcf8] rounded-2xl p-4">
            <p className="text-sm text-[#62725b]">Aperturas totales</p>
            <p className="text-2xl font-bold text-[#2f4f24]">{totalAperturas}</p>
          </div>

          <div className="bg-[#fafcf8] rounded-2xl p-4">
            <p className="text-sm text-[#62725b]">Escaneos totales</p>
            <p className="text-2xl font-bold text-[#2f4f24]">{totalEscaneos}</p>
          </div>

          <div className="bg-[#fafcf8] rounded-2xl p-4">
            <p className="text-sm text-[#62725b]">Dinero acumulado</p>
            <p className="text-2xl font-bold text-[#0b7a33]">{formatMoney(totalDinero)}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPanelJefe = () => {
    if (!esJefe) return null;

    const hoy = getChileDateString();

    const resumenJefatura = ranking.map((item) => {
      const registrosVendedorHoy = registros.filter(
        (r) => r.codigo_vendedor === item.codigo_vendedor && getChileDateOnlyFromISO(r.fecha) === hoy
      );

      return {
        codigo: item.codigo_vendedor,
        nombre: item.nombre_vendedor,
        aperturas: registrosVendedorHoy.filter((r) => isApertura(r.tipo)).length,
        escaneos: registrosVendedorHoy.filter((r) => r.tipo === "ESCANEO").length,
        totalDinero: registrosVendedorHoy.reduce((acc, r) => acc + r.valor, 0),
      };
    });

    return (
      <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
        <h2 className="text-2xl md:text-3xl font-bold text-[#222] mb-5">Panel jefe</h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm md:text-base">
            <thead>
              <tr className="border-b border-[#dde7d8] text-left">
                <th className="py-3 pr-3 text-[#62725b]">Posición</th>
                <th className="py-3 pr-3 text-[#62725b]">Nombre</th>
                <th className="py-3 pr-3 text-[#62725b]">Código</th>
                <th className="py-3 pr-3 text-[#62725b]">Aperturas</th>
                <th className="py-3 pr-3 text-[#62725b]">Escaneos</th>
                <th className="py-3 pr-3 text-[#62725b]">Dinero</th>
              </tr>
            </thead>
            <tbody>
              {resumenJefatura.length > 0 ? (
                resumenJefatura.map((item, index) => (
                  <tr key={item.codigo} className="border-b border-[#ebf0e7]">
                    <td className="py-4 pr-3 text-[#40523a] font-semibold">{getMedal(index)}</td>
                    <td className="py-4 pr-3 text-[#40523a]">{item.nombre}</td>
                    <td className="py-4 pr-3 text-[#40523a]">{item.codigo}</td>
                    <td className="py-4 pr-3 text-[#40523a]">{item.aperturas}</td>
                    <td className="py-4 pr-3 text-[#40523a]">{item.escaneos}</td>
                    <td className="py-4 pr-3 font-bold text-[#1f7a1f]">{formatMoney(item.totalDinero)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#62725b]">
                    Aún no hay datos para hoy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAdmin = () => {
    if (!esAdmin) return null;

    return (
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
          <h2 className="text-2xl md:text-3xl font-bold text-[#222]">Crear usuario</h2>

          <div className="mt-6 space-y-4">
            <input
              type="text"
              value={nuevoCodigo}
              onChange={(e) => setNuevoCodigo(e.target.value)}
              placeholder="Código vendedor"
              className="w-full bg-[#fafcf8] border border-[#d1ddd0] rounded-2xl px-4 py-3 outline-none"
            />

            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombre completo"
              className="w-full bg-[#fafcf8] border border-[#d1ddd0] rounded-2xl px-4 py-3 outline-none"
            />

            <input
              type="password"
              value={nuevoPin}
              onChange={(e) => setNuevoPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="PIN 4 dígitos"
              className="w-full bg-[#fafcf8] border border-[#d1ddd0] rounded-2xl px-4 py-3 outline-none"
            />

            <select
              value={nuevoRol}
              onChange={(e) => setNuevoRol(e.target.value as Rol)}
              className="w-full bg-[#fafcf8] border border-[#d1ddd0] rounded-2xl px-4 py-3 outline-none"
            >
              <option value="vendedor">Vendedor</option>
              <option value="jefe">Jefe</option>
              <option value="administrador">Administrador</option>
            </select>

            <button
              onClick={crearUsuario}
              className="w-full bg-[#2fa11b] hover:bg-[#278817] text-white rounded-2xl py-4 text-lg font-bold"
            >
              Crear usuario
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
          <h2 className="text-2xl md:text-3xl font-bold text-[#222] mb-5">Usuarios creados</h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm md:text-base">
              <thead>
                <tr className="border-b border-[#dde7d8] text-left">
                  <th className="py-3 pr-3 text-[#62725b]">Nombre</th>
                  <th className="py-3 pr-3 text-[#62725b]">Código</th>
                  <th className="py-3 pr-3 text-[#62725b]">Rol</th>
                  <th className="py-3 pr-3 text-[#62725b]">Activo</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length > 0 ? (
                  usuarios.map((u) => (
                    <tr key={u.id} className="border-b border-[#ebf0e7]">
                      <td className="py-4 pr-3 text-[#40523a]">{u.nombre}</td>
                      <td className="py-4 pr-3 text-[#40523a]">{u.codigo_vendedor}</td>
                      <td className="py-4 pr-3 text-[#40523a] capitalize">{u.rol}</td>
                      <td className="py-4 pr-3 text-[#40523a]">{u.activo ? "Sí" : "No"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#62725b]">
                      Aún no hay usuarios creados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#f5f7f3]">
      <div className="min-h-screen lg:flex">
        <aside className="hidden lg:flex w-[260px] bg-white border-r border-[#dde8d8] flex-col p-4">
          <div className="bg-[#0b7a33] rounded-2xl p-5 text-white mb-6">
            <p className="text-sm uppercase tracking-[0.2em] text-white/70">Sistema</p>
            <p className="font-bold text-3xl leading-tight mt-2">Registremos</p>
            <p className="font-bold text-3xl leading-tight">Tu Apertura</p>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setVistaActiva("dashboard")}
              className={`w-full text-left rounded-2xl px-4 py-3 font-semibold ${
                vistaActiva === "dashboard" ? "bg-[#0b7a33] text-white" : "text-[#40523a]"
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => setVistaActiva("mis_registros")}
              className={`w-full text-left rounded-2xl px-4 py-3 font-semibold ${
                vistaActiva === "mis_registros" ? "bg-[#0b7a33] text-white" : "text-[#40523a]"
              }`}
            >
              Mis registros
            </button>

            <button
              onClick={() => setVistaActiva("metas")}
              className={`w-full text-left rounded-2xl px-4 py-3 font-semibold ${
                vistaActiva === "metas" ? "bg-[#0b7a33] text-white" : "text-[#40523a]"
              }`}
            >
              Metas
            </button>

            <button
              onClick={() => setVistaActiva("exportar")}
              className={`w-full text-left rounded-2xl px-4 py-3 font-semibold ${
                vistaActiva === "exportar" ? "bg-[#0b7a33] text-white" : "text-[#40523a]"
              }`}
            >
              Exportar Excel
            </button>

            {esJefe && (
              <button
                onClick={() => setVistaActiva("panel_jefe")}
                className={`w-full text-left rounded-2xl px-4 py-3 font-semibold ${
                  vistaActiva === "panel_jefe" ? "bg-[#0b7a33] text-white" : "text-[#40523a]"
                }`}
              >
                Panel jefe
              </button>
            )}

            {esAdmin && (
              <button
                onClick={() => setVistaActiva("admin")}
                className={`w-full text-left rounded-2xl px-4 py-3 font-semibold ${
                  vistaActiva === "admin" ? "bg-[#0b7a33] text-white" : "text-[#40523a]"
                }`}
              >
                Administrador
              </button>
            )}
          </nav>

          <div className="mt-6 bg-[#fafcf8] rounded-3xl border border-[#dfe8d8] p-4 shadow-sm">
            <p className="text-sm text-[#7a8c72]">Usuario</p>
            <p className="text-xl font-bold text-[#2f4f24] mt-2">{user.nombre}</p>
            <p className="text-sm text-[#62725b] mt-1">
              {user.codigo} · {user.rol}
            </p>
          </div>
        </aside>

        <section className="flex-1 pb-24 lg:pb-10">
          <div className="bg-[#0b7a33] px-4 md:px-6 py-4 text-white">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">Registremos Tu Apertura</h1>
                <p className="text-white/80 mt-1">Acceso por código y PIN</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-white/10 rounded-2xl px-4 py-2 font-semibold">{user.nombre}</div>
                <div className="bg-white/10 rounded-2xl px-4 py-2 font-semibold">{user.codigo}</div>
                <div className="bg-white/10 rounded-2xl px-4 py-2 font-semibold">{formatMoney(dineroHoy)}</div>
                <button
                  onClick={handleLogout}
                  className="bg-white text-[#2f4f24] rounded-2xl px-5 py-2 font-semibold"
                >
                  Salir
                </button>
              </div>
            </div>
          </div>

          {errorVisible}

          {mensaje && (
            <div className="mx-4 md:mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl p-4">
              {mensaje}
            </div>
          )}

          <div className="p-4 md:p-6 space-y-6">
            {vistaActiva === "dashboard" && renderDashboard()}
            {vistaActiva === "mis_registros" && renderMisRegistros()}
            {vistaActiva === "metas" && renderMetas()}
            {vistaActiva === "exportar" && renderExportar()}
            {vistaActiva === "panel_jefe" && renderPanelJefe()}
            {vistaActiva === "admin" && renderAdmin()}
          </div>

          <footer className="text-center text-xs text-[#7a8c72] pb-6 px-4">
            Creada por <span className="font-semibold">Joyce Garcia</span> · @ijxyce
          </footer>
        </section>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#dfe8d8] px-2 py-2">
        <div className="grid grid-cols-4 gap-2 text-xs">
          <button
            onClick={() => setVistaActiva("dashboard")}
            className={`rounded-xl px-2 py-3 font-semibold ${
              vistaActiva === "dashboard" ? "bg-[#0b7a33] text-white" : "bg-[#f5f7f3] text-[#40523a]"
            }`}
          >
            Inicio
          </button>

          <button
            onClick={() => setVistaActiva("mis_registros")}
            className={`rounded-xl px-2 py-3 font-semibold ${
              vistaActiva === "mis_registros" ? "bg-[#0b7a33] text-white" : "bg-[#f5f7f3] text-[#40523a]"
            }`}
          >
            Registros
          </button>

          <button
            onClick={() => setVistaActiva("metas")}
            className={`rounded-xl px-2 py-3 font-semibold ${
              vistaActiva === "metas" ? "bg-[#0b7a33] text-white" : "bg-[#f5f7f3] text-[#40523a]"
            }`}
          >
            Metas
          </button>

          <button
            onClick={() => {
              if (esAdmin) setVistaActiva("admin");
              else if (esJefe) setVistaActiva("panel_jefe");
              else setVistaActiva("exportar");
            }}
            className={`rounded-xl px-2 py-3 font-semibold ${
              vistaActiva === "panel_jefe" || vistaActiva === "exportar" || vistaActiva === "admin"
                ? "bg-[#0b7a33] text-white"
                : "bg-[#f5f7f3] text-[#40523a]"
            }`}
          >
            {esAdmin ? "Admin" : esJefe ? "Jefe" : "Exportar"}
          </button>
        </div>
      </div>
    </main>
  );
}