"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type PaginaSuperior = "aperturas" | "seguros";
type Vista = "dashboard" | "mis_registros" | "metas" | "exportar" | "panel_jefe" | "admin";
type TipoActividad = "CMR" | "CUENTA_CORRIENTE" | "ESCANEO";
type TipoSeguro = "COMPRA_PROTEGIDA" | "SEGURO_VIDA";
type Rol = "vendedor" | "jefe" | "administrador";

type User = {
  codigo: string;
  nombre: string;
  rut: string | null;
  rol: Rol;
};

type RegistroApertura = {
  id: number;
  codigo_vendedor: string;
  nombre_vendedor: string | null;
  rut_vendedor: string | null;
  rol_vendedor: Rol | null;
  rut_cliente: string | null;
  fecha: string;
  tipo: TipoActividad;
  valor: number;
  detalle: string | null;
};

type RegistroSeguro = {
  id: number;
  codigo_vendedor: string;
  nombre_vendedor: string | null;
  rut_vendedor: string | null;
  rol_vendedor: Rol | null;
  rut_cliente: string;
  fecha: string;
  tipo: TipoSeguro;
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
  rut: string | null;
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
const META_DIARIA_SEGUROS = 1;

const inputClass =
  "w-full bg-white border border-[#cfe0c4] rounded-2xl px-4 py-4 outline-none text-[#111827] placeholder:text-[#6b7280] text-base";
const selectClass =
  "w-full bg-white border border-[#cfe0c4] rounded-2xl px-4 py-4 outline-none text-[#111827] text-base";

const TIPOS_APERTURA_CONFIG: Record<
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
    color: "text-[#14532d]",
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

const TIPOS_SEGURO_CONFIG: Record<
  TipoSeguro,
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
  COMPRA_PROTEGIDA: {
    label: "Compra Protegida",
    detalle: "Compra Protegida",
    color: "text-[#0f4c81]",
    bg: "bg-[#e8f4ff]",
    border: "border-[#8fc6ff]",
    activeBg: "bg-[#2f80ed]",
    activeText: "text-white",
  },
  SEGURO_VIDA: {
    label: "Seguro de Vida",
    detalle: "Seguro de Vida",
    color: "text-[#155e75]",
    bg: "bg-[#e6f7ff]",
    border: "border-[#7dd3fc]",
    activeBg: "bg-[#0284c7]",
    activeText: "text-white",
  },
};

function cleanRut(value: string) {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

function cleanRutForLink(value: string) {
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

function getMedalBg(index: number, pagina: PaginaSuperior) {
  if (pagina === "seguros") {
    if (index === 0) return "bg-sky-50 border-sky-200";
    if (index === 1) return "bg-cyan-50 border-cyan-200";
    if (index === 2) return "bg-blue-50 border-blue-200";
    return "bg-white border-[#d8e2f2]";
  }

  if (index === 0) return "bg-yellow-50 border-yellow-200";
  if (index === 1) return "bg-slate-50 border-slate-300";
  if (index === 2) return "bg-orange-50 border-orange-200";
  return "bg-white border-[#d8e2d2]";
}

function buildFigitalUrl(rut: string | null) {
  const rutLimpio = cleanRutForLink(rut ?? "");
  return `http://www.bancofalabella.cl/pre-landing?utm_source=falabella&utm_medium=QRregional&utm_content=arauco-maipu-qr-unificado&utm_campaign=apertura-falabella&utm_term=${rutLimpio}&store_id=3741`;
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [paginaSuperior, setPaginaSuperior] = useState<PaginaSuperior>("aperturas");
  const [vistaActiva, setVistaActiva] = useState<Vista>("dashboard");

  const [user, setUser] = useState<User | null>(null);
  const [aperturas, setAperturas] = useState<RegistroApertura[]>([]);
  const [seguros, setSeguros] = useState<RegistroSeguro[]>([]);
  const [rankingAperturas, setRankingAperturas] = useState<RankingItem[]>([]);
  const [rankingSeguros, setRankingSeguros] = useState<RankingItem[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);

  const [codigoLogin, setCodigoLogin] = useState("");
  const [pinLogin, setPinLogin] = useState("");

  const [bootstrapNeeded, setBootstrapNeeded] = useState(false);
  const [bootstrapCodigo, setBootstrapCodigo] = useState("");
  const [bootstrapNombre, setBootstrapNombre] = useState("");
  const [bootstrapRut, setBootstrapRut] = useState("");
  const [bootstrapPin, setBootstrapPin] = useState("");

  const [rutClienteApertura, setRutClienteApertura] = useState("");
  const [tipoAperturaSeleccionado, setTipoAperturaSeleccionado] = useState<TipoActividad>("CMR");

  const [rutClienteSeguro, setRutClienteSeguro] = useState("");
  const [tipoSeguroSeleccionado, setTipoSeguroSeleccionado] = useState<TipoSeguro>("COMPRA_PROTEGIDA");

  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoRut, setNuevoRut] = useState("");
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

    const sessionRes = await fetch("/api/session", {
      method: "GET",
      cache: "no-store",
    });

    let sessionData: any = {};
    try {
      sessionData = await sessionRes.json();
    } catch {
      sessionData = {};
    }

    if (!sessionRes.ok) {
      setError("No se pudo validar la sesión.");
      return false;
    }

    setUser(sessionData.user ?? null);

    const appRes = await fetch("/api/app-data", {
      method: "GET",
      cache: "no-store",
    });

    let appData: any = {};
    try {
      appData = await appRes.json();
    } catch {
      appData = {};
    }

    if (!appRes.ok) {
      setError(appData.error || "Error al cargar la información.");
      setAperturas([]);
      setSeguros([]);
      setRankingAperturas([]);
      setRankingSeguros([]);
      setUsuarios([]);
      return Boolean(sessionData.user);
    }

    setAperturas(appData.aperturas ?? []);
    setSeguros(appData.seguros ?? []);
    setRankingAperturas(appData.rankingAperturas ?? []);
    setRankingSeguros(appData.rankingSeguros ?? []);
    setUsuarios(appData.usuarios ?? []);

    return Boolean(sessionData.user);
  };

  useEffect(() => {
    const init = async () => {
      await cargarBootstrap();
      await cargarApp();
      setLoading(false);
    };
    init();
  }, []);

  const aperturasDelUsuario = useMemo(() => {
    if (!user) return [];
    return aperturas.filter((r) => r.codigo_vendedor === user.codigo);
  }, [aperturas, user]);

  const segurosDelUsuario = useMemo(() => {
    if (!user) return [];
    return seguros.filter((r) => r.codigo_vendedor === user.codigo);
  }, [seguros, user]);

  const aperturasFiltradas = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    if (!term) return aperturasDelUsuario;
    return aperturasDelUsuario.filter(
      (r) =>
        r.codigo_vendedor.toLowerCase().includes(term) ||
        (r.nombre_vendedor ?? "").toLowerCase().includes(term) ||
        (r.rut_cliente ?? "").toLowerCase().includes(term) ||
        TIPOS_APERTURA_CONFIG[r.tipo].label.toLowerCase().includes(term)
    );
  }, [busqueda, aperturasDelUsuario]);

  const segurosFiltrados = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    if (!term) return segurosDelUsuario;
    return segurosDelUsuario.filter(
      (r) =>
        r.codigo_vendedor.toLowerCase().includes(term) ||
        (r.nombre_vendedor ?? "").toLowerCase().includes(term) ||
        r.rut_cliente.toLowerCase().includes(term) ||
        TIPOS_SEGURO_CONFIG[r.tipo].label.toLowerCase().includes(term)
    );
  }, [busqueda, segurosDelUsuario]);

  const aperturasVentaUsuario = useMemo(
    () => aperturasDelUsuario.filter((r) => isApertura(r.tipo)),
    [aperturasDelUsuario]
  );

  const escaneosUsuario = useMemo(
    () => aperturasDelUsuario.filter((r) => r.tipo === "ESCANEO"),
    [aperturasDelUsuario]
  );

  const totalAperturas = aperturasVentaUsuario.length;
  const totalEscaneos = escaneosUsuario.length;
  const totalSeguros = segurosDelUsuario.length;

  const totalDineroAperturas = useMemo(
    () => aperturasDelUsuario.reduce((acc, item) => acc + (item.valor ?? 0), 0),
    [aperturasDelUsuario]
  );

  const totalDineroSeguros = useMemo(
    () => segurosDelUsuario.reduce((acc, item) => acc + (item.valor ?? 0), 0),
    [segurosDelUsuario]
  );

  const totalGeneral = totalDineroAperturas + totalDineroSeguros;

  const aperturasHoy = useMemo(() => {
    const hoy = getChileDateString();
    return aperturasVentaUsuario.filter((r) => getChileDateOnlyFromISO(r.fecha) === hoy).length;
  }, [aperturasVentaUsuario]);

  const escaneosHoy = useMemo(() => {
    const hoy = getChileDateString();
    return escaneosUsuario.filter((r) => getChileDateOnlyFromISO(r.fecha) === hoy).length;
  }, [escaneosUsuario]);

  const segurosHoy = useMemo(() => {
    const hoy = getChileDateString();
    return segurosDelUsuario.filter((r) => getChileDateOnlyFromISO(r.fecha) === hoy).length;
  }, [segurosDelUsuario]);

  const dineroHoyAperturas = useMemo(() => {
    const hoy = getChileDateString();
    return aperturasDelUsuario
      .filter((r) => getChileDateOnlyFromISO(r.fecha) === hoy)
      .reduce((acc, r) => acc + r.valor, 0);
  }, [aperturasDelUsuario]);

  const dineroHoySeguros = useMemo(() => {
    const hoy = getChileDateString();
    return segurosDelUsuario
      .filter((r) => getChileDateOnlyFromISO(r.fecha) === hoy)
      .reduce((acc, r) => acc + r.valor, 0);
  }, [segurosDelUsuario]);

  const totalCMR = aperturasDelUsuario.filter((r) => r.tipo === "CMR").length;
  const totalCuentaCorriente = aperturasDelUsuario.filter((r) => r.tipo === "CUENTA_CORRIENTE").length;
  const totalCompraProtegida = segurosDelUsuario.filter((r) => r.tipo === "COMPRA_PROTEGIDA").length;
  const totalSeguroVida = segurosDelUsuario.filter((r) => r.tipo === "SEGURO_VIDA").length;

  const nivelAperturas = getNivelInfo(totalAperturas);
  const miPosicionAperturas = user
    ? rankingAperturas.findIndex((item) => item.codigo_vendedor === user.codigo) + 1
    : 0;
  const miPosicionSeguros = user
    ? rankingSeguros.findIndex((item) => item.codigo_vendedor === user.codigo) + 1
    : 0;

  const aperturasSemana = useMemo(() => {
    const hoy = new Date();
    const hace7 = new Date();
    hace7.setDate(hoy.getDate() - 6);
    return aperturasVentaUsuario.filter((r) => new Date(r.fecha) >= hace7).length;
  }, [aperturasVentaUsuario]);

  const crearBootstrapAdmin = async () => {
    setError("");
    setMensaje("");

    if (!validateRut(bootstrapRut)) {
      setError("El RUT del administrador no es válido.");
      return;
    }

    const res = await fetch("/api/bootstrap-admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codigo_vendedor: bootstrapCodigo,
        nombre: bootstrapNombre,
        rut: bootstrapRut,
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
    setBootstrapCodigo("");
    setBootstrapNombre("");
    setBootstrapRut("");
    setBootstrapPin("");
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

    setCodigoLogin("");
    setPinLogin("");

    await cargarApp();
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
    setAperturas([]);
    setSeguros([]);
    setRankingAperturas([]);
    setRankingSeguros([]);
    setUsuarios([]);
    setVistaActiva("dashboard");
    setPaginaSuperior("aperturas");
    setMensaje("");
    setError("");
    await cargarBootstrap();
  };

  const handleGuardarApertura = async () => {
    setError("");
    setMensaje("");

    const requiereRut = tipoAperturaSeleccionado !== "ESCANEO";
    const rutFormateado = formatRut(rutClienteApertura);

    if (requiereRut && !rutClienteApertura.trim()) {
      setError("Debes ingresar el RUT del cliente.");
      return;
    }

    if (requiereRut && !validateRut(rutClienteApertura)) {
      setError("El RUT ingresado no es válido.");
      return;
    }

    const res = await fetch("/api/registrar-actividad", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipo: tipoAperturaSeleccionado,
        rut_cliente: requiereRut ? rutFormateado : null,
        detalle: TIPOS_APERTURA_CONFIG[tipoAperturaSeleccionado].detalle,
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

    setRutClienteApertura("");
    setTipoAperturaSeleccionado("CMR");
    setMensaje("Actividad registrada correctamente.");
    await cargarApp();
  };

  const handleGuardarSeguro = async () => {
    setError("");
    setMensaje("");

    if (!rutClienteSeguro.trim()) {
      setError("Debes ingresar el RUT del cliente.");
      return;
    }

    if (!validateRut(rutClienteSeguro)) {
      setError("El RUT ingresado no es válido.");
      return;
    }

    const res = await fetch("/api/registrar-seguro", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipo: tipoSeguroSeleccionado,
        rut_cliente: formatRut(rutClienteSeguro),
        detalle: TIPOS_SEGURO_CONFIG[tipoSeguroSeleccionado].detalle,
      }),
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      setError(data.error || "No se pudo registrar el seguro.");
      return;
    }

    setRutClienteSeguro("");
    setTipoSeguroSeleccionado("COMPRA_PROTEGIDA");
    setMensaje("Seguro registrado correctamente.");
    await cargarApp();
  };

  const crearUsuario = async () => {
    setError("");
    setMensaje("");

    if (!validateRut(nuevoRut)) {
      setError("El RUT del usuario no es válido.");
      return;
    }

    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codigo_vendedor: nuevoCodigo,
        nombre: nuevoNombre,
        rut: nuevoRut,
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
    setNuevoRut("");
    setNuevoPin("");
    setNuevoRol("vendedor");
    setMensaje("Usuario creado correctamente.");
    await cargarApp();
  };

  const exportarAperturas = () => {
    const rows = aperturasDelUsuario.map((registro) => ({
      fecha: new Date(registro.fecha).toLocaleString("es-CL"),
      tipo: TIPOS_APERTURA_CONFIG[registro.tipo].label,
      detalle: registro.detalle ?? "",
      rut_cliente: registro.rut_cliente ?? "",
      valor: registro.valor,
      codigo: registro.codigo_vendedor,
      nombre: registro.nombre_vendedor ?? "",
    }));

    exportRowsToCsv(`aperturas-${user?.codigo ?? "usuario"}.csv`, rows);
  };

  const exportarRankingAperturas = () => {
    const rows = rankingAperturas.map((item, index) => ({
      posicion: index + 1,
      codigo_vendedor: item.codigo_vendedor,
      nombre_vendedor: item.nombre_vendedor,
      aperturas_hoy: item.total,
    }));

    exportRowsToCsv(`ranking-aperturas-${getChileDateString()}.csv`, rows);
  };

  const exportarSeguros = () => {
    const rows = segurosDelUsuario.map((registro) => ({
      fecha: new Date(registro.fecha).toLocaleString("es-CL"),
      tipo: TIPOS_SEGURO_CONFIG[registro.tipo].label,
      detalle: registro.detalle ?? "",
      rut_cliente: registro.rut_cliente,
      valor: registro.valor,
      codigo: registro.codigo_vendedor,
      nombre: registro.nombre_vendedor ?? "",
    }));

    exportRowsToCsv(`seguros-${user?.codigo ?? "usuario"}.csv`, rows);
  };

  const exportarRankingSeguros = () => {
    const rows = rankingSeguros.map((item, index) => ({
      posicion: index + 1,
      codigo_vendedor: item.codigo_vendedor,
      nombre_vendedor: item.nombre_vendedor,
      seguros_hoy: item.total,
    }));

    exportRowsToCsv(`ranking-seguros-${getChileDateString()}.csv`, rows);
  };

  const abrirFigital = () => {
    if (!user?.rut) {
      setError("Tu usuario no tiene RUT registrado para Figital.");
      return;
    }

    window.location.href = buildFigitalUrl(user.rut);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7f3] flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-lg px-8 py-6 border border-[#dfe8d8] text-[#1f2937]">
          Cargando aplicación...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#f3f8ef] via-white to-[#eef7ea] flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white rounded-[32px] shadow-xl p-6 md:p-10 border border-[#dfe8d8]">
          <div className="max-w-xl mx-auto text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/logo-rta.png"
                alt="Logo Registremos Tu Apertura"
                width={180}
                height={180}
                className="w-32 h-32 md:w-44 md:h-44 object-contain"
                priority
              />
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-[#14532d] leading-tight">
              Registremos Tu Apertura
            </h1>

            <p className="text-[#4b5563] text-xl md:text-2xl mt-5">
              Acceso con código y PIN de 4 dígitos
            </p>

            {error && (
              <div className="mt-5 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">
                {error}
              </div>
            )}

            {mensaje && (
              <div className="mt-5 bg-green-50 border border-green-200 text-green-700 rounded-2xl p-4 text-sm">
                {mensaje}
              </div>
            )}

            <div className="mt-8 space-y-5">
              {bootstrapNeeded ? (
                <>
                  <input
                    type="text"
                    value={bootstrapCodigo}
                    onChange={(e) => setBootstrapCodigo(e.target.value)}
                    placeholder="Código vendedor"
                    className={inputClass}
                  />

                  <input
                    type="text"
                    value={bootstrapNombre}
                    onChange={(e) => setBootstrapNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className={inputClass}
                  />

                  <input
                    type="text"
                    value={bootstrapRut}
                    onChange={(e) => setBootstrapRut(formatRut(e.target.value))}
                    placeholder="RUT"
                    className={inputClass}
                  />

                  <input
                    type="password"
                    value={bootstrapPin}
                    onChange={(e) => setBootstrapPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="PIN 4 dígitos"
                    className={inputClass}
                  />

                  <button
                    onClick={crearBootstrapAdmin}
                    className="w-full bg-[#2b8a1f] hover:bg-[#236f19] text-white rounded-2xl py-4 font-semibold text-xl"
                  >
                    Crear administrador
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={codigoLogin}
                    onChange={(e) => setCodigoLogin(e.target.value)}
                    placeholder="Código vendedor"
                    className={inputClass}
                  />

                  <input
                    type="password"
                    value={pinLogin}
                    onChange={(e) => setPinLogin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="PIN 4 dígitos"
                    className={inputClass}
                  />

                  <button
                    onClick={handleLogin}
                    className="w-full bg-[#2b8a1f] hover:bg-[#236f19] text-white rounded-2xl py-4 font-semibold text-xl"
                  >
                    Ingresar
                  </button>
                </>
              )}
            </div>

            <footer className="text-center text-sm text-[#6b7280] pt-8">
              Creada por <span className="font-semibold text-[#166534]">Joyce Garcia</span> · @ijxyce
            </footer>
          </div>
        </div>
      </main>
    );
  }

  const headerPrimaryClass =
    paginaSuperior === "aperturas" ? "bg-[#0b7a33]" : "bg-[#0f6aa6]";

  const headerSecondaryText =
    paginaSuperior === "aperturas" ? "Aperturas y Figital" : "Seguros y activación";

  const errorVisible = error ? (
    <div className="mx-4 md:mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">
      {error}
    </div>
  ) : null;

  const renderTopSummary = () => (
    <div className="grid md:grid-cols-3 gap-4">
      <button
        onClick={() => {
          setPaginaSuperior("aperturas");
          setVistaActiva("dashboard");
        }}
        className={`text-left rounded-[24px] p-5 border shadow-sm ${
          paginaSuperior === "aperturas"
            ? "bg-[#0b7a33] text-white border-transparent"
            : "bg-white border-[#d9e8d6] text-[#1f2937]"
        }`}
      >
        <p className="text-sm opacity-80">Aperturas</p>
        <p className="text-3xl font-bold mt-2">{formatMoney(totalDineroAperturas)}</p>
        <p className="text-sm mt-2">{totalAperturas} aperturas · {totalEscaneos} escaneos</p>
      </button>

      <button
        onClick={() => {
          setPaginaSuperior("seguros");
          setVistaActiva("dashboard");
        }}
        className={`text-left rounded-[24px] p-5 border shadow-sm ${
          paginaSuperior === "seguros"
            ? "bg-[#0f6aa6] text-white border-transparent"
            : "bg-white border-[#d7e8f6] text-[#1f2937]"
        }`}
      >
        <p className="text-sm opacity-80">Seguros</p>
        <p className="text-3xl font-bold mt-2">{formatMoney(totalDineroSeguros)}</p>
        <p className="text-sm mt-2">{totalSeguros} seguros registrados</p>
      </button>

      <div className="text-left rounded-[24px] p-5 border shadow-sm bg-white border-[#e5e7eb] text-[#1f2937]">
        <p className="text-sm text-[#6b7280]">Total general</p>
        <p className="text-3xl font-bold mt-2">{formatMoney(totalGeneral)}</p>
        <p className="text-sm mt-2 text-[#6b7280]">Aperturas + Seguros</p>
      </div>
    </div>
  );

  const renderDashboardAperturas = () => (
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
          <p className="text-2xl md:text-3xl font-bold text-[#0b7a33] mt-3">{nivelAperturas.nombre}</p>
          <p className="text-sm text-[#62725b] mt-2">{nivelAperturas.mensaje}</p>
        </div>

        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-[#e7ece2] col-span-2 xl:col-span-1">
          <p className="text-sm text-[#5c6e56]">Dinero hoy</p>
          <p className="text-3xl md:text-4xl font-bold text-[#0b7a33] mt-3">{formatMoney(dineroHoyAperturas)}</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1.15fr_1fr] gap-6">
        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
          <h2 className="text-2xl md:text-3xl font-bold text-[#111827] mb-5">Registrar apertura</h2>

          <div className="grid md:grid-cols-3 gap-3">
            {(Object.keys(TIPOS_APERTURA_CONFIG) as TipoActividad[]).map((tipo) => {
              const cfg = TIPOS_APERTURA_CONFIG[tipo];
              const active = tipoAperturaSeleccionado === tipo;
              const valorSugerido =
                tipo === "ESCANEO"
                  ? 500
                  : tipo === "CMR"
                  ? nivelAperturas.recompensaCMR
                  : nivelAperturas.recompensaCC;

              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setTipoAperturaSeleccionado(tipo)}
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

          <div className="mt-5">
            <label className="block text-sm font-medium text-[#374151] mb-2">
              RUT del cliente {tipoAperturaSeleccionado === "ESCANEO" ? "(opcional)" : ""}
            </label>
            <input
              type="text"
              value={rutClienteApertura}
              onChange={(e) => setRutClienteApertura(formatRut(e.target.value))}
              placeholder="12.345.678-5"
              className={inputClass}
            />
          </div>

          <button
            onClick={handleGuardarApertura}
            className="w-full mt-5 bg-[#2fa11b] hover:bg-[#278817] text-white rounded-2xl py-4 text-lg md:text-xl font-bold"
          >
            Guardar apertura
          </button>
        </div>

        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Ranking aperturas</h2>
              <p className="text-[#62725b] mt-1">Solo aperturas</p>
            </div>
          </div>

          <div className="space-y-3">
            {rankingAperturas.length > 0 ? (
              rankingAperturas.slice(0, 10).map((item, index) => {
                const max = rankingAperturas[0]?.total || 1;
                const percent = (item.total / max) * 100;
                const isMe = item.codigo_vendedor === user.codigo;

                return (
                  <div
                    key={item.codigo_vendedor}
                    className={`rounded-2xl border px-4 py-4 ${getMedalBg(index, "aperturas")} ${
                      isMe ? "ring-2 ring-[#9ed48d]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg font-bold shadow-sm">
                          {getMedal(index)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#1f2937] truncate">
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
                      <div className="h-full bg-[#0b8f11] rounded-full" style={{ width: `${percent}%` }} />
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
            <p className="text-2xl font-bold text-[#1f2937]">
              {miPosicionAperturas > 0 ? `${getMedal(miPosicionAperturas - 1)} ${miPosicionAperturas}` : "Sin posición aún"}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  const renderDashboardSeguros = () => (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-[#e1edf8]">
          <p className="text-sm text-[#5b7387]">Seguros</p>
          <p className="text-4xl md:text-5xl font-bold text-[#0f6aa6] mt-3">{totalSeguros}</p>
        </div>

        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-[#e1edf8]">
          <p className="text-sm text-[#5b7387]">Seguros hoy</p>
          <p className="text-4xl md:text-5xl font-bold text-[#0f6aa6] mt-3">{segurosHoy}</p>
        </div>

        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-[#e1edf8]">
          <p className="text-sm text-[#5b7387]">Compra Protegida</p>
          <p className="text-4xl md:text-5xl font-bold text-[#0f6aa6] mt-3">{totalCompraProtegida}</p>
        </div>

        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-[#e1edf8]">
          <p className="text-sm text-[#5b7387]">Seguro de Vida</p>
          <p className="text-4xl md:text-5xl font-bold text-[#0f6aa6] mt-3">{totalSeguroVida}</p>
        </div>

        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-[#e1edf8] col-span-2 xl:col-span-1">
          <p className="text-sm text-[#5b7387]">Dinero hoy</p>
          <p className="text-3xl md:text-4xl font-bold text-[#0f6aa6] mt-3">{formatMoney(dineroHoySeguros)}</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1.15fr_1fr] gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e1edf8]">
            <h2 className="text-2xl md:text-3xl font-bold text-[#111827] mb-5">Registrar seguro</h2>

            <div className="grid md:grid-cols-2 gap-3">
              {(Object.keys(TIPOS_SEGURO_CONFIG) as TipoSeguro[]).map((tipo) => {
                const cfg = TIPOS_SEGURO_CONFIG[tipo];
                const active = tipoSeguroSeleccionado === tipo;

                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setTipoSeguroSeleccionado(tipo)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? `${cfg.activeBg} ${cfg.activeText} border-transparent shadow-sm`
                        : `${cfg.bg} ${cfg.border} ${cfg.color}`
                    }`}
                  >
                    <div className="font-bold text-base md:text-lg">{cfg.label}</div>
                    <div className="text-lg md:text-xl font-bold mt-2">+{formatMoney(3000)}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <label className="block text-sm font-medium text-[#374151] mb-2">
                RUT del cliente
              </label>
              <input
                type="text"
                value={rutClienteSeguro}
                onChange={(e) => setRutClienteSeguro(formatRut(e.target.value))}
                placeholder="12.345.678-5"
                className="w-full bg-white border border-[#cfe0ff] rounded-2xl px-4 py-4 outline-none text-[#111827] placeholder:text-[#6b7280] text-base"
              />
            </div>

            <button
              onClick={handleGuardarSeguro}
              className="w-full mt-5 bg-[#0f6aa6] hover:bg-[#0b5b90] text-white rounded-2xl py-4 text-lg md:text-xl font-bold"
            >
              Guardar seguro
            </button>
          </div>

          <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e1edf8]">
            <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Activa tu seguro</h2>
            <p className="text-[#62725b] mt-2">
              Accede directamente al flujo de activación.
            </p>

            <button
              onClick={() => {
                window.location.href = "https://aceptacion.segurosfalabella.com/retail/compra-protegida";
              }}
              className="w-full mt-5 bg-[#e8f4ff] border border-[#8fc6ff] text-[#0f4c81] rounded-2xl py-4 text-lg font-bold"
            >
              Ir a activar tu seguro
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e1edf8]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Ranking seguros</h2>
              <p className="text-[#62725b] mt-1">Compra Protegida + Seguro de Vida</p>
            </div>
          </div>

          <div className="space-y-3">
            {rankingSeguros.length > 0 ? (
              rankingSeguros.slice(0, 10).map((item, index) => {
                const max = rankingSeguros[0]?.total || 1;
                const percent = (item.total / max) * 100;
                const isMe = item.codigo_vendedor === user.codigo;

                return (
                  <div
                    key={item.codigo_vendedor}
                    className={`rounded-2xl border px-4 py-4 ${getMedalBg(index, "seguros")} ${
                      isMe ? "ring-2 ring-[#8fc6ff]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg font-bold shadow-sm">
                          {getMedal(index)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#1f2937] truncate">
                            {item.nombre_vendedor} · {item.codigo_vendedor}
                            {isMe && (
                              <span className="ml-2 bg-[#0f6aa6] text-white text-xs px-2 py-1 rounded-lg">
                                Tú
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-[#62725b]">{item.total} seguros</div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-[#0f6aa6]">{item.total}</div>
                    </div>

                    <div className="mt-3 h-3 bg-[#e7eef7] rounded-full overflow-hidden">
                      <div className="h-full bg-[#2f80ed] rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-[#f7fbff] rounded-2xl p-6 text-center text-[#62725b]">
                Aún no hay seguros registrados hoy.
              </div>
            )}
          </div>

          <div className="mt-4 bg-[#f7fbff] rounded-2xl border border-[#d7e8f6] px-4 py-4">
            <p className="text-sm text-[#62725b]">Tu posición actual</p>
            <p className="text-2xl font-bold text-[#1f2937]">
              {miPosicionSeguros > 0 ? `${getMedal(miPosicionSeguros - 1)} ${miPosicionSeguros}` : "Sin posición aún"}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  const renderMisRegistrosAperturas = () => (
    <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Mis registros de aperturas</h2>
          <p className="text-[#62725b] mt-1">Historial completo de aperturas y escaneos</p>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar..."
          className="bg-white border border-[#d1ddd0] rounded-2xl px-4 py-3 outline-none text-[#111827] placeholder:text-[#6b7280]"
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
            {aperturasFiltradas.length > 0 ? (
              aperturasFiltradas.map((registro) => (
                <tr key={registro.id} className="border-b border-[#ebf0e7]">
                  <td className="py-4 pr-3 text-[#374151]">
                    {new Date(registro.fecha).toLocaleString("es-CL")}
                  </td>
                  <td className="py-4 pr-3 text-[#374151]">{TIPOS_APERTURA_CONFIG[registro.tipo].label}</td>
                  <td className="py-4 pr-3 text-[#374151]">{registro.detalle ?? "-"}</td>
                  <td className="py-4 pr-3 text-[#374151]">{registro.rut_cliente || "—"}</td>
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

  const renderMisRegistrosSeguros = () => (
    <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e1edf8]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Mis registros de seguros</h2>
          <p className="text-[#62725b] mt-1">Historial completo de Compra Protegida y Seguro de Vida</p>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar..."
          className="bg-white border border-[#cfe0ff] rounded-2xl px-4 py-3 outline-none text-[#111827] placeholder:text-[#6b7280]"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm md:text-base">
          <thead>
            <tr className="border-b border-[#dde7f2] text-left">
              <th className="py-3 pr-3 text-[#62725b]">Fecha</th>
              <th className="py-3 pr-3 text-[#62725b]">Tipo</th>
              <th className="py-3 pr-3 text-[#62725b]">Detalle</th>
              <th className="py-3 pr-3 text-[#62725b]">RUT</th>
              <th className="py-3 pr-3 text-[#62725b]">Valor</th>
            </tr>
          </thead>
          <tbody>
            {segurosFiltrados.length > 0 ? (
              segurosFiltrados.map((registro) => (
                <tr key={registro.id} className="border-b border-[#edf4fb]">
                  <td className="py-4 pr-3 text-[#374151]">
                    {new Date(registro.fecha).toLocaleString("es-CL")}
                  </td>
                  <td className="py-4 pr-3 text-[#374151]">{TIPOS_SEGURO_CONFIG[registro.tipo].label}</td>
                  <td className="py-4 pr-3 text-[#374151]">{registro.detalle ?? "-"}</td>
                  <td className="py-4 pr-3 text-[#374151]">{registro.rut_cliente}</td>
                  <td className="py-4 pr-3 font-bold text-[#0f6aa6]">{formatMoney(registro.valor)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#62725b]">
                  Aún no tienes registros de seguros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMetasAperturas = () => {
    const progresoDia = Math.min((aperturasHoy / META_DIARIA_APERTURAS) * 100, 100);
    const progresoSemana = Math.min((aperturasSemana / META_SEMANAL_APERTURAS) * 100, 100);

    return (
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
          <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Metas de aperturas</h2>

          <div className="mt-6 space-y-6">
            <div className="bg-[#fafcf8] rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#62725b]">Meta diaria</p>
                  <p className="text-2xl font-bold text-[#1f2937]">
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
                  <p className="text-2xl font-bold text-[#1f2937]">
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
          <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Resumen</h2>

          <div className="mt-6 grid gap-4">
            <div className="bg-[#fafcf8] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">Nivel actual</p>
              <p className="text-3xl font-bold text-[#1f2937] mt-2">{nivelAperturas.nombre}</p>
              <p className="text-sm text-[#62725b] mt-2">{nivelAperturas.mensaje}</p>
            </div>

            <div className="bg-[#fafcf8] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">CMR</p>
              <p className="text-3xl font-bold text-[#1f2937] mt-2">{totalCMR}</p>
            </div>

            <div className="bg-[#fafcf8] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">Cuenta Corriente</p>
              <p className="text-3xl font-bold text-[#1f2937] mt-2">{totalCuentaCorriente}</p>
            </div>

            <div className="bg-[#fafcf8] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">Escaneos</p>
              <p className="text-3xl font-bold text-[#1f2937] mt-2">{totalEscaneos}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMetasSeguros = () => {
    const progreso = Math.min((segurosHoy / META_DIARIA_SEGUROS) * 100, 100);

    return (
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e1edf8]">
          <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Metas de seguros</h2>

          <div className="mt-6 space-y-6">
            <div className="bg-[#f7fbff] rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#62725b]">Meta diaria</p>
                  <p className="text-2xl font-bold text-[#1f2937]">
                    {segurosHoy} / {META_DIARIA_SEGUROS}
                  </p>
                </div>
                <div className="text-right text-[#0f6aa6] font-bold">
                  {Math.round(progreso)}%
                </div>
              </div>
              <div className="mt-4 h-4 bg-[#e8f0f8] rounded-full overflow-hidden">
                <div className="h-full bg-[#2f80ed]" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e1edf8]">
          <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Resumen</h2>

          <div className="mt-6 grid gap-4">
            <div className="bg-[#f7fbff] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">Seguros totales</p>
              <p className="text-3xl font-bold text-[#1f2937] mt-2">{totalSeguros}</p>
            </div>

            <div className="bg-[#f7fbff] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">Compra Protegida</p>
              <p className="text-3xl font-bold text-[#1f2937] mt-2">{totalCompraProtegida}</p>
            </div>

            <div className="bg-[#f7fbff] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">Seguro de Vida</p>
              <p className="text-3xl font-bold text-[#1f2937] mt-2">{totalSeguroVida}</p>
            </div>

            <div className="bg-[#f7fbff] rounded-2xl p-5">
              <p className="text-sm text-[#62725b]">Dinero seguros</p>
              <p className="text-3xl font-bold text-[#0f6aa6] mt-2">{formatMoney(totalDineroSeguros)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderExportarAperturas = () => (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e7ece2]">
        <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Exportar aperturas</h2>
        <p className="text-[#62725b] mt-1">Se descarga en CSV, compatible con Excel</p>

        <div className="mt-6 space-y-4">
          <button
            onClick={exportarAperturas}
            className="w-full bg-[#2fa11b] hover:bg-[#278817] text-white rounded-2xl py-4 text-lg font-bold"
          >
            Exportar mis aperturas
          </button>

          <button
            onClick={exportarRankingAperturas}
            className="w-full bg-[#fafcf8] border border-[#b7d7a8] text-[#1f2937] rounded-2xl py-4 text-lg font-bold"
          >
            Exportar ranking aperturas
          </button>
        </div>
      </div>
    </div>
  );

  const renderExportarSeguros = () => (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e1edf8]">
        <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Exportar seguros</h2>
        <p className="text-[#62725b] mt-1">Se descarga en CSV, compatible con Excel</p>

        <div className="mt-6 space-y-4">
          <button
            onClick={exportarSeguros}
            className="w-full bg-[#0f6aa6] hover:bg-[#0b5b90] text-white rounded-2xl py-4 text-lg font-bold"
          >
            Exportar mis seguros
          </button>

          <button
            onClick={exportarRankingSeguros}
            className="w-full bg-[#f7fbff] border border-[#8fc6ff] text-[#1f2937] rounded-2xl py-4 text-lg font-bold"
          >
            Exportar ranking seguros
          </button>
        </div>
      </div>
    </div>
  );

  const renderPanelJefeAperturas = () => {
    if (!esJefe) return null;

    const hoy = getChileDateString();

    const resumen = rankingAperturas.map((item) => {
      const registrosVendedorHoy = aperturas.filter(
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
        <h2 className="text-2xl md:text-3xl font-bold text-[#111827] mb-5">Panel jefe aperturas</h2>

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
              {resumen.length > 0 ? (
                resumen.map((item, index) => (
                  <tr key={item.codigo} className="border-b border-[#ebf0e7]">
                    <td className="py-4 pr-3 text-[#374151] font-semibold">{getMedal(index)}</td>
                    <td className="py-4 pr-3 text-[#374151]">{item.nombre}</td>
                    <td className="py-4 pr-3 text-[#374151]">{item.codigo}</td>
                    <td className="py-4 pr-3 text-[#374151]">{item.aperturas}</td>
                    <td className="py-4 pr-3 text-[#374151]">{item.escaneos}</td>
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

  const renderPanelJefeSeguros = () => {
    if (!esJefe) return null;

    const hoy = getChileDateString();

    const resumen = rankingSeguros.map((item) => {
      const registrosVendedorHoy = seguros.filter(
        (r) => r.codigo_vendedor === item.codigo_vendedor && getChileDateOnlyFromISO(r.fecha) === hoy
      );

      return {
        codigo: item.codigo_vendedor,
        nombre: item.nombre_vendedor,
        seguros: registrosVendedorHoy.length,
        totalDinero: registrosVendedorHoy.reduce((acc, r) => acc + r.valor, 0),
      };
    });

    return (
      <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-sm border border-[#e1edf8]">
        <h2 className="text-2xl md:text-3xl font-bold text-[#111827] mb-5">Panel jefe seguros</h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm md:text-base">
            <thead>
              <tr className="border-b border-[#dde7f2] text-left">
                <th className="py-3 pr-3 text-[#62725b]">Posición</th>
                <th className="py-3 pr-3 text-[#62725b]">Nombre</th>
                <th className="py-3 pr-3 text-[#62725b]">Código</th>
                <th className="py-3 pr-3 text-[#62725b]">Seguros</th>
                <th className="py-3 pr-3 text-[#62725b]">Dinero</th>
              </tr>
            </thead>
            <tbody>
              {resumen.length > 0 ? (
                resumen.map((item, index) => (
                  <tr key={item.codigo} className="border-b border-[#edf4fb]">
                    <td className="py-4 pr-3 text-[#374151] font-semibold">{getMedal(index)}</td>
                    <td className="py-4 pr-3 text-[#374151]">{item.nombre}</td>
                    <td className="py-4 pr-3 text-[#374151]">{item.codigo}</td>
                    <td className="py-4 pr-3 text-[#374151]">{item.seguros}</td>
                    <td className="py-4 pr-3 font-bold text-[#0f6aa6]">{formatMoney(item.totalDinero)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#62725b]">
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
          <h2 className="text-2xl md:text-3xl font-bold text-[#111827]">Crear usuario</h2>

          <div className="mt-6 space-y-4">
            <input
              type="text"
              value={nuevoCodigo}
              onChange={(e) => setNuevoCodigo(e.target.value)}
              placeholder="Código vendedor"
              className={inputClass}
            />

            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombre completo"
              className={inputClass}
            />

            <input
              type="text"
              value={nuevoRut}
              onChange={(e) => setNuevoRut(formatRut(e.target.value))}
              placeholder="RUT"
              className={inputClass}
            />

            <input
              type="password"
              value={nuevoPin}
              onChange={(e) => setNuevoPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="PIN 4 dígitos"
              className={inputClass}
            />

            <select
              value={nuevoRol}
              onChange={(e) => setNuevoRol(e.target.value as Rol)}
              className={selectClass}
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
          <h2 className="text-2xl md:text-3xl font-bold text-[#111827] mb-5">Usuarios creados</h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm md:text-base">
              <thead>
                <tr className="border-b border-[#dde7d8] text-left">
                  <th className="py-3 pr-3 text-[#62725b]">Nombre</th>
                  <th className="py-3 pr-3 text-[#62725b]">Código</th>
                  <th className="py-3 pr-3 text-[#62725b]">RUT</th>
                  <th className="py-3 pr-3 text-[#62725b]">Rol</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length > 0 ? (
                  usuarios.map((u) => (
                    <tr key={u.id} className="border-b border-[#ebf0e7]">
                      <td className="py-4 pr-3 text-[#374151]">{u.nombre}</td>
                      <td className="py-4 pr-3 text-[#374151]">{u.codigo_vendedor}</td>
                      <td className="py-4 pr-3 text-[#374151]">{u.rut ?? "—"}</td>
                      <td className="py-4 pr-3 text-[#374151] capitalize">{u.rol}</td>
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

  const navButtonClass = (active: boolean, seguros = false) =>
    `w-full text-left rounded-2xl px-4 py-3 font-semibold ${
      active
        ? seguros
          ? "bg-[#0f6aa6] text-white"
          : "bg-[#0b7a33] text-white"
        : "text-[#40523a]"
    }`;

  return (
    <main className="min-h-screen bg-[#f5f7f3]">
      <div className="min-h-screen lg:flex">
        <aside className="hidden lg:flex w-[280px] bg-white border-r border-[#dde8d8] flex-col p-4">
          <div className={`rounded-2xl p-5 text-white mb-6 text-center ${paginaSuperior === "aperturas" ? "bg-[#0b7a33]" : "bg-[#0f6aa6]"}`}>
            <div className="flex justify-center mb-3">
              <Image
                src="/logo-rta.png"
                alt="Logo RTA"
                width={90}
                height={90}
                className="w-20 h-20 object-contain"
              />
            </div>
            <p className="font-bold text-3xl leading-tight">Registremos</p>
            <p className="font-bold text-3xl leading-tight">Tu Apertura</p>
          </div>

          <nav className="space-y-2">
            <button onClick={() => setVistaActiva("dashboard")} className={navButtonClass(vistaActiva === "dashboard", paginaSuperior === "seguros")}>
              Dashboard
            </button>

            <button onClick={() => setVistaActiva("mis_registros")} className={navButtonClass(vistaActiva === "mis_registros", paginaSuperior === "seguros")}>
              Mis registros
            </button>

            <button onClick={() => setVistaActiva("metas")} className={navButtonClass(vistaActiva === "metas", paginaSuperior === "seguros")}>
              Metas
            </button>

            <button onClick={() => setVistaActiva("exportar")} className={navButtonClass(vistaActiva === "exportar", paginaSuperior === "seguros")}>
              Exportar Excel
            </button>

            {esJefe && (
              <button onClick={() => setVistaActiva("panel_jefe")} className={navButtonClass(vistaActiva === "panel_jefe", paginaSuperior === "seguros")}>
                Panel jefe
              </button>
            )}

            {esAdmin && paginaSuperior === "aperturas" && (
              <button onClick={() => setVistaActiva("admin")} className={navButtonClass(vistaActiva === "admin", false)}>
                Administrador
              </button>
            )}
          </nav>

          <div className="mt-6 bg-[#fafcf8] rounded-3xl border border-[#dfe8d8] p-4 shadow-sm">
            <p className="text-sm text-[#7a8c72]">Usuario</p>
            <p className="text-xl font-bold text-[#1f2937] mt-2">{user.nombre}</p>
            <p className="text-sm text-[#62725b] mt-1">{user.codigo} · {user.rol}</p>
          </div>
        </aside>

        <section className="flex-1 pb-24 lg:pb-10">
          <div className={`${headerPrimaryClass} px-4 md:px-6 py-4 text-white`}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold">Registremos Tu Apertura</h1>
                  <p className="text-white/80 mt-1">{headerSecondaryText}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="bg-white/10 rounded-2xl px-4 py-2 font-semibold">{user.nombre}</div>
                  <div className="bg-white/10 rounded-2xl px-4 py-2 font-semibold">{user.codigo}</div>
                  <div className="bg-white/10 rounded-2xl px-4 py-2 font-semibold">{formatMoney(totalGeneral)}</div>
                  <button
                    onClick={handleLogout}
                    className="bg-white text-[#1f2937] rounded-2xl px-5 py-2 font-semibold"
                  >
                    Salir
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setPaginaSuperior("aperturas");
                    setVistaActiva("dashboard");
                  }}
                  className={`rounded-2xl px-5 py-3 font-semibold ${
                    paginaSuperior === "aperturas" ? "bg-white text-[#14532d]" : "bg-white/10 text-white"
                  }`}
                >
                  Aperturas
                </button>

                <button
                  onClick={() => {
                    setPaginaSuperior("seguros");
                    setVistaActiva("dashboard");
                  }}
                  className={`rounded-2xl px-5 py-3 font-semibold ${
                    paginaSuperior === "seguros" ? "bg-white text-[#0f4c81]" : "bg-white/10 text-white"
                  }`}
                >
                  Seguros
                </button>

                <button
                  onClick={abrirFigital}
                  className="rounded-2xl px-5 py-3 font-semibold bg-white/10 text-white"
                >
                  Figital
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
            {renderTopSummary()}

            {paginaSuperior === "aperturas" && vistaActiva === "dashboard" && renderDashboardAperturas()}
            {paginaSuperior === "aperturas" && vistaActiva === "mis_registros" && renderMisRegistrosAperturas()}
            {paginaSuperior === "aperturas" && vistaActiva === "metas" && renderMetasAperturas()}
            {paginaSuperior === "aperturas" && vistaActiva === "exportar" && renderExportarAperturas()}
            {paginaSuperior === "aperturas" && vistaActiva === "panel_jefe" && renderPanelJefeAperturas()}
            {paginaSuperior === "aperturas" && vistaActiva === "admin" && renderAdmin()}

            {paginaSuperior === "seguros" && vistaActiva === "dashboard" && renderDashboardSeguros()}
            {paginaSuperior === "seguros" && vistaActiva === "mis_registros" && renderMisRegistrosSeguros()}
            {paginaSuperior === "seguros" && vistaActiva === "metas" && renderMetasSeguros()}
            {paginaSuperior === "seguros" && vistaActiva === "exportar" && renderExportarSeguros()}
            {paginaSuperior === "seguros" && vistaActiva === "panel_jefe" && renderPanelJefeSeguros()}
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
              vistaActiva === "dashboard"
                ? paginaSuperior === "seguros"
                  ? "bg-[#0f6aa6] text-white"
                  : "bg-[#0b7a33] text-white"
                : "bg-[#f5f7f3] text-[#40523a]"
            }`}
          >
            Inicio
          </button>

          <button
            onClick={() => setVistaActiva("mis_registros")}
            className={`rounded-xl px-2 py-3 font-semibold ${
              vistaActiva === "mis_registros"
                ? paginaSuperior === "seguros"
                  ? "bg-[#0f6aa6] text-white"
                  : "bg-[#0b7a33] text-white"
                : "bg-[#f5f7f3] text-[#40523a]"
            }`}
          >
            Registros
          </button>

          <button
            onClick={() => setVistaActiva("metas")}
            className={`rounded-xl px-2 py-3 font-semibold ${
              vistaActiva === "metas"
                ? paginaSuperior === "seguros"
                  ? "bg-[#0f6aa6] text-white"
                  : "bg-[#0b7a33] text-white"
                : "bg-[#f5f7f3] text-[#40523a]"
            }`}
          >
            Metas
          </button>

          <button
            onClick={() => {
              if (esAdmin && paginaSuperior === "aperturas") setVistaActiva("admin");
              else if (esJefe) setVistaActiva("panel_jefe");
              else setVistaActiva("exportar");
            }}
            className={`rounded-xl px-2 py-3 font-semibold ${
              vistaActiva === "panel_jefe" || vistaActiva === "exportar" || vistaActiva === "admin"
                ? paginaSuperior === "seguros"
                  ? "bg-[#0f6aa6] text-white"
                  : "bg-[#0b7a33] text-white"
                : "bg-[#f5f7f3] text-[#40523a]"
            }`}
          >
            {esAdmin && paginaSuperior === "aperturas" ? "Admin" : esJefe ? "Jefe" : "Exportar"}
          </button>
        </div>
      </div>
    </main>
  );
}