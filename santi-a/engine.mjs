export const catalog = [
  {
    id: "bibliotecas",
    aliases: ["biblioteca", "bibliotecas"],
    layer: "PTO_BIB_2025_001_BIBLIOTECAS_2025",
    source: "2. BIBLIOTECA DIGITAL",
  },
  {
    id: "reciclaje",
    aliases: ["reciclaje", "punto limpio", "puntos limpios"],
    layer: "PTO_SINADER_2025_001_RECICLAJE",
    source: "2. BIBLIOTECA DIGITAL",
  },
  {
    id: "museos",
    aliases: ["museo", "museos"],
    layer: "PTO_MUSEOS",
    source: "2. BIBLIOTECA DIGITAL",
  },
];

export function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectIntent(query) {
  const normalized = normalize(query);
  if (/donde.*(mayor|mas|concentracion)/.test(normalized)) return "max_concentration";
  if (/donde.*(menor|menos)/.test(normalized)) return "min_concentration";
  if (/cuantos|cantidad/.test(normalized)) return "count";
  if (/muestra|mostrar|ver/.test(normalized)) return "show";
  return "unknown";
}

export function detectLayer(query) {
  const normalized = normalize(query);
  return (
    catalog.find((entry) =>
      entry.aliases.some((alias) => normalized.includes(normalize(alias))),
    ) ?? null
  );
}

export function answer(query, stats) {
  const intent = detectIntent(query);
  const layer = detectLayer(query);

  if (!layer) {
    return {
      ok: false,
      message: "No identifiqué una cobertura territorial asociada a la consulta.",
    };
  }

  if (intent === "max_concentration") {
    const rows = stats[layer.id] ?? [];
    if (!rows.length) {
      return {
        ok: false,
        message: `La cobertura ${layer.layer} está catalogada, pero aún no dispone de estadísticas territoriales.`,
      };
    }

    const top = [...rows].sort((a, b) => b.count - a.count)[0];
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const percentage = total ? ((top.count / total) * 100).toFixed(1) : "0.0";

    return {
      ok: true,
      layer: layer.layer,
      source: layer.source,
      summary: `La mayor concentración de ${layer.id} se encuentra en ${top.barrio}, territorio ${top.territorio}: ${top.count} registros (${percentage}% del total analizado).`,
      stats: { ...top, total },
      mapActions: [
        { type: "activate_layer", layer: layer.layer },
        { type: "zoom_to", scale: "barrio", value: top.barrio },
        {
          type: "highlight",
          layer: layer.layer,
          filter: { barrio: top.barrio },
        },
      ],
    };
  }

  return {
    ok: true,
    layer: layer.layer,
    source: layer.source,
    summary: `Consulta reconocida para ${layer.id}. El prototipo aún no implementa la operación ${intent}.`,
    mapActions: [{ type: "activate_layer", layer: layer.layer }],
  };
}
