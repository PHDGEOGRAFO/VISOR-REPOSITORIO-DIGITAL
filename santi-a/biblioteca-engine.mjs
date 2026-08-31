import bibliotecaCatalog from "./catalog-biblioteca-digital.json" with { type: "json" };

export function geometryFamily(value = "") {
  const normalized = String(value).toLowerCase();
  if (normalized.includes("punto")) return "point";
  if (normalized.includes("línea") || normalized.includes("linea")) return "line";
  if (normalized.includes("polígono") || normalized.includes("poligono")) return "polygon";
  return "unknown";
}

export function getQueryableBibliotecaCatalog() {
  return bibliotecaCatalog.filter(
    (entry) =>
      entry.queryable === true &&
      entry.sourceUnit === "2. BIBLIOTECA DIGITAL" &&
      entry.reviewStatus === "VALIDADA" &&
      entry.repositoryStatus === "PUBLICADA",
  );
}

export function getBibliotecaLayer(idOrLayer) {
  const needle = String(idOrLayer ?? "").toLowerCase();
  return (
    getQueryableBibliotecaCatalog().find(
      (entry) =>
        entry.id.toLowerCase() === needle ||
        entry.layer.toLowerCase() === needle,
    ) ?? null
  );
}

export function answerBibliotecaPolygon(intersections = {}, options = {}) {
  const visibleSet = new Set(options.visibleLayers ?? []);
  const catalog = getQueryableBibliotecaCatalog();

  const results = catalog
    .map((entry) => {
      const spatial = intersections[entry.id] ?? {};
      const count = Number(spatial.count ?? 0);
      return {
        id: entry.id,
        layer: entry.layer,
        sourceUnit: entry.sourceUnit,
        geometry: entry.geometry,
        geometryFamily: geometryFamily(entry.geometry),
        count,
        details: spatial.details ?? null,
        mapVisibleBeforeQuery: visibleSet.has(entry.layer),
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    ok: true,
    sourceUnit: "2. BIBLIOTECA DIGITAL",
    queriedLayerCount: catalog.length,
    ignoredMapVisibility: true,
    resultLayerCount: results.length,
    results,
    mapActions: results.map((entry) => ({
      type: "offer_layer",
      layer: entry.layer,
      initiallyVisible: entry.mapVisibleBeforeQuery,
      count: entry.count,
    })),
  };
}
