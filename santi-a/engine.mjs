export const catalog = [
  {
    id: "bibliotecas",
    aliases: ["biblioteca", "bibliotecas"],
    layer: "PTO_BIB_2025_001_BIBLIOTECAS_2025",
    source: "2. BIBLIOTECA DIGITAL",
    queryable: true,
  },
  {
    id: "reciclaje",
    aliases: ["reciclaje", "punto limpio", "puntos limpios"],
    layer: "PTO_SINADER_2025_001_RECICLAJE",
    source: "2. BIBLIOTECA DIGITAL",
    queryable: true,
  },
  {
    id: "museos",
    aliases: ["museo", "museos"],
    layer: "Museo_Barrio.xlsx",
    source: "2. BIBLIOTECA DIGITAL",
    sourceId: "1mhJwQULMGDUydgJt9w6FCT6wC3pqAO-9",
    queryable: true,
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
  if (/(que|qué).*existe.*(poligono|area|sector)|dentro.*(poligono|area)|en este poligono/.test(normalized)) {
    return "polygon_inventory";
  }
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

// Recibe el resultado espacial calculado por el visor/API para TODAS las capas
// catalogadas. La visibilidad actual del mapa no participa en la consulta.
export function answerPolygon(intersections = {}, options = {}) {
  const { visibleLayers = [] } = options;
  const visibleSet = new Set(visibleLayers);

  const results = catalog
    .filter((entry) => entry.queryable !== false)
    .map((entry) => {
      const data = intersections[entry.id] ?? {};
      const count = Number(data.count ?? 0);
      return {
        id: entry.id,
        layer: entry.layer,
        source: entry.source,
        count,
        mapVisibleBeforeQuery: visibleSet.has(entry.layer),
        details: data.details ?? null,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  const totalFeatures = results.reduce((sum, row) => sum + row.count, 0);

  return {
    ok: true,
    intent: "polygon_inventory",
    summary: results.length
      ? `En el polígono se detectaron ${results.length} coberturas con ${totalFeatures} registros en total.`
      : "No se detectaron registros de las coberturas catalogadas dentro del polígono.",
    results,
    queriedLayerCount: catalog.filter((entry) => entry.queryable !== false).length,
    ignoredMapVisibility: true,
    mapActions: results.map((row) => ({
      type: "offer_layer",
      layer: row.layer,
      initiallyVisible: row.mapVisibleBeforeQuery,
      count: row.count,
    })),
  };
}

export function answer(query, stats, context = {}) {
  const intent = detectIntent(query);

  if (intent === "polygon_inventory") {
    if (!context.polygonIntersections) {
      return {
        ok: false,
        intent,
        message: "La consulta requiere un polígono dibujado en el visor.",
        mapActions: [{ type: "start_polygon_draw" }],
      };
    }
    return answerPolygon(context.polygonIntersections, {
      visibleLayers: context.visibleLayers ?? [],
    });
  }

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
    const territoryText = top.territorio
      ? `, territorio ${top.territorio}`
      : ", territorio pendiente de cruce con cartografía oficial";

    return {
      ok: true,
      layer: layer.layer,
      source: layer.source,
      summary: `La mayor concentración de ${layer.id} se encuentra en ${top.barrio}${territoryText}: ${top.count} registros (${percentage}% del total analizado).`,
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
