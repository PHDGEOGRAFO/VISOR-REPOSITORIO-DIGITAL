"use client";

import { useEffect, useMemo, useState } from "react";
import InteractiveMap, {
  DrawPolygon,
  GeoCollection,
  GeoFeature,
  LayerStyle,
  VizMode,
} from "./InteractiveMap";
import { analyzePolygon, featuresInPolygon, runSanti } from "./santi";

type Geometry = "Punto" | "Línea" | "Polígono";
type Theme = "BASE" | "AMB" | "URB" | "MOV" | "SEG" | "SAL" | "ECO" | "SOC";

type Layer = {
  id: string;
  name: string;
  theme: Theme;
  geometry: Geometry;
  url: string;
  color: string;
  description: string;
  source: string;
  activeDefault?: boolean;
  populationJoin?: boolean;
  mapTool?: boolean;
};

type IndexItem = {
  id: string;
  tema: string;
  nombre: string;
  geometria: string;
  escala: string;
  contenedor: string;
  tipoContenedor: string;
  subcapa: string;
  campoClave?: string;
  estado: string;
  verEnMapa: boolean;
  download: string;
};

const BASE_PATH = "/VISOR-REPOSITORIO-DIGITAL";
const empty: GeoCollection = { type: "FeatureCollection", features: [] };

const groups: [Theme, string][] = [
  ["BASE", "Base territorial"],
  ["AMB", "Ambiental"],
  ["URB", "Urbana / territorio y suelo"],
  ["MOV", "Movilidad y transporte"],
  ["SEG", "Seguridad y emergencias"],
  ["SAL", "Salud"],
  ["ECO", "Económica / actividad comercial"],
  ["SOC", "Social / sociocultural"],
];

const thematicGroups = groups.filter(([code]) => code !== "BASE");

const layers: Layer[] = [
  {
    id: "comuna",
    name: "Límite comunal",
    theme: "BASE",
    geometry: "Polígono",
    url: `${BASE_PATH}/data/comuna.geojson`,
    color: "#073879",
    description: "Límite oficial de la comuna de Santiago.",
    source: "Municipalidad de Santiago",
    activeDefault: true,
  },
  {
    id: "territorio",
    name: "Territorios",
    theme: "BASE",
    geometry: "Polígono",
    url: `${BASE_PATH}/data/territorios.geojson`,
    color: "#2877a6",
    description: "Territorios de planificación de la comuna.",
    source: "Municipalidad de Santiago",
  },
  {
    id: "barrio",
    name: "Barrios",
    theme: "BASE",
    geometry: "Polígono",
    url: `${BASE_PATH}/data/barrios.geojson`,
    color: "#4a87b8",
    description: "Barrios oficiales cargados en el repositorio territorial.",
    source: "Municipalidad de Santiago",
  },
  {
    id: "manzana",
    name: "Manzanas · Censo 2024",
    theme: "BASE",
    geometry: "Polígono",
    url: `${BASE_PATH}/data/manzanas.geojson`,
    color: "#71808a",
    description: "Base censal de manzanas. COD_MZN es la llave y n_per la población para cálculos.",
    source: "Censo 2024 / Municipalidad de Santiago",
    populationJoin: true,
  },
  {
    id: "lineas-prc",
    name: "Líneas Oficiales PRC",
    theme: "URB",
    geometry: "Línea",
    url: `${BASE_PATH}/data/prc_expropiacion_lineas.geojson`,
    color: "#d5523f",
    description: "Líneas oficiales / expropiación PRC. Se publican exclusivamente como líneas, sin polígonos ni rellenos.",
    source: "PRC Santiago",
    mapTool: true,
  },
  {
    id: "grifos",
    name: "Grifos",
    theme: "SEG",
    geometry: "Punto",
    url: `${BASE_PATH}/data/grifos.geojson`,
    color: "#d5523f",
    description: "Variable temática de seguridad y emergencias. No se activa de forma predeterminada.",
    source: "Repositorio Territorial Digital",
  },
  {
    id: "bibliotecas",
    name: "Bibliotecas 2025",
    theme: "SOC",
    geometry: "Punto",
    url: `${BASE_PATH}/data/PTO_BIB_2025_001_BIBLIOTECAS_2025.geojson`,
    color: "#2877a6",
    description: "Variable temática social / sociocultural. No se activa de forma predeterminada.",
    source: "Biblioteca Digital",
  },
];

const styles: Record<string, LayerStyle> = {
  comuna: { color: "#073879", fill: "#dce8f2", width: 2.4, opacity: 0.04 },
  territorio: { color: "#2877a6", fill: "#dce8f2", width: 1.5, opacity: 0.025 },
  barrio: { color: "#4a87b8", fill: "#e7eef4", width: 1, opacity: 0.018 },
  manzana: { color: "#7b878e", fill: "#e9edef", width: 0.42, opacity: 0.018 },
  "lineas-prc": { color: "#d5523f", width: 1.15, opacity: 0.92 },
  grifos: { color: "#d5523f", pointRadius: 4 },
  bibliotecas: { color: "#2877a6", pointRadius: 6 },
};

const pointLayers = layers.filter((layer) => layer.geometry === "Punto" && !layer.mapTool);

function distanceMeters(a: number[], b: number[]) {
  const r = 6371008.8;
  const p1 = (a[1] * Math.PI) / 180;
  const p2 = (b[1] * Math.PI) / 180;
  const dp = ((b[1] - a[1]) * Math.PI) / 180;
  const dl = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function uniqueNames(fc: GeoCollection | undefined, keys: string[]) {
  return [...new Set((fc?.features ?? [])
    .map((feature) => keys.map((key) => feature.properties?.[key]).find((value) => value != null && String(value).trim()))
    .filter(Boolean)
    .map(String))].sort();
}

export default function Home() {
  const [data, setData] = useState<Record<string, GeoCollection>>({});
  const [streets, setStreets] = useState<GeoCollection>(empty);
  const [active, setActive] = useState<string[]>(layers.filter((layer) => layer.activeDefault).map((layer) => layer.id));
  const [selected, setSelected] = useState("manzana");
  const [feature, setFeature] = useState<{ f: GeoFeature; layerId: string } | null>(null);
  const [query, setQuery] = useState("");
  const [population, setPopulation] = useState<Record<string, number | null>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [viz, setViz] = useState<VizMode>("simple");
  const [polygon, setPolygon] = useState<DrawPolygon | null>(null);
  const [spatialSelection, setSpatialSelection] = useState<GeoFeature[] | null>(null);
  const [analysis, setAnalysis] = useState("Cantidad de registros");
  const [radius, setRadius] = useState(500);
  const [isoMode, setIsoMode] = useState("A pie");
  const [isoMinutes, setIsoMinutes] = useState(10);
  const [santiQuery, setSantiQuery] = useState("");
  const [santiReply, setSantiReply] = useState(
    "Soy SANTI, asistente territorial. Puedes preguntarme: «¿cuántos barrios hay?», «¿cuáles son los territorios?», «activar líneas oficiales», «isócrona 10 minutos» o «¿qué existe en este polígono?»."
  );
  const [indexOpen, setIndexOpen] = useState(false);
  const [indexItems, setIndexItems] = useState<IndexItem[]>([]);
  const [indexQuery, setIndexQuery] = useState("");
  const [indexTheme, setIndexTheme] = useState("TODOS");
  const [modal, setModal] = useState<"table" | "meta" | "report" | "help" | null>(null);

  useEffect(() => {
    fetch(`${BASE_PATH}/data/manzanas_poblacion_2024.json`)
      .then((response) => (response.ok ? response.json() : {}))
      .then(setPopulation)
      .catch(() => setPopulation({}));
  }, []);

  useEffect(() => {
    fetch(`${BASE_PATH}/catalog/index_coberturas.json`)
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((json) => setIndexItems(json.items || []))
      .catch(() => setIndexItems([]));
  }, []);

  useEffect(() => {
    layers.forEach((layer) => {
      if (data[layer.id] && !(layer.populationJoin && Object.keys(population).length)) return;
      if (status[layer.id] === "cargando") return;

      setStatus((current) => ({ ...current, [layer.id]: "cargando" }));
      fetch(layer.url)
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json();
        })
        .then((fc: GeoCollection) => {
          let clean = fc;

          if (layer.id === "lineas-prc") {
            clean = {
              ...fc,
              features: fc.features.filter(
                (item) => item.geometry.type === "LineString" || item.geometry.type === "MultiLineString"
              ),
            };
          }

          if (layer.populationJoin) {
            clean = {
              ...clean,
              features: clean.features.map((item) => {
                const properties = { ...item.properties };
                const cod = String(properties.COD_MZN ?? properties.cod_mzn ?? "");
                properties.COD_MZN = cod;
                properties.n_per = population[cod] ?? properties.n_per ?? properties.POBLACION ?? null;
                return { ...item, properties };
              }),
            };
          }

          setData((current) => ({ ...current, [layer.id]: clean }));
          setStatus((current) => ({ ...current, [layer.id]: "ok" }));
        })
        .catch(() => setStatus((current) => ({ ...current, [layer.id]: "error" })));
    });
  }, [population]);

  useEffect(() => {
    if (analysis !== "Isócronas" || streets.features.length) return;
    fetch(`${BASE_PATH}/data/calles_santiago.geojson`)
      .then((response) => (response.ok ? response.json() : empty))
      .then(setStreets)
      .catch(() => setStreets(empty));
  }, [analysis, streets.features.length]);

  const selectedLayer = layers.find((layer) => layer.id === selected) ?? layers[0];
  const selectedData = data[selected] ?? empty;
  const sourceFeatures = spatialSelection ?? selectedData.features;
  const nperValues = sourceFeatures.map((item) => Number(item.properties.n_per)).filter(Number.isFinite);
  const nperSum = nperValues.reduce((sum, value) => sum + value, 0);
  const pointCount = selectedData.features.filter((item) => item.geometry.type === "Point").length;
  const manzanaPopulationSum = (data.manzana?.features ?? []).reduce(
    (sum, item) => sum + (Number(item.properties.n_per) || 0),
    0
  );

  const polygonResults = useMemo(
    () => polygon ? analyzePolygon(polygon, data, layers.map((layer) => ({ id: layer.id, name: layer.name }))) : null,
    [polygon, data]
  );

  const nearestDistance = useMemo(() => {
    if (!feature || feature.layerId !== selected || feature.f.geometry.type !== "Point") return null;
    const origin = feature.f.geometry.coordinates as number[];
    const distances = selectedData.features
      .filter((item) => item !== feature.f && item.geometry.type === "Point")
      .map((item) => distanceMeters(origin, item.geometry.coordinates as number[]));
    return distances.length ? Math.min(...distances) : null;
  }, [feature, selected, selectedData]);

  const analysisResult =
    analysis === "Suma n_per"
      ? `${nperSum.toLocaleString("es-CL")} personas`
      : analysis === "Promedio n_per"
        ? `${(nperValues.length ? nperSum / nperValues.length : 0).toLocaleString("es-CL", { maximumFractionDigits: 1 })} promedio`
        : analysis === "Densidad"
          ? `${(pointCount / 23.18).toFixed(1)} puntos/km²`
          : analysis === "Proximidad"
            ? nearestDistance != null
              ? `${Math.round(nearestDistance).toLocaleString("es-CL")} m al punto más cercano`
              : `Seleccione un punto · buffer ${radius} m`
            : analysis === "Isócronas"
              ? `${isoMode} · ${isoMinutes} min${streets.features.length ? " · red cargada" : " · cargando red…"}`
              : `${sourceFeatures.length.toLocaleString("es-CL")} registros`;

  const thematicLayers = layers.filter((layer) => layer.theme !== "BASE" && !layer.mapTool);
  const filtered = thematicLayers.filter((layer) =>
    `${layer.name} ${groups.find((group) => group[0] === layer.theme)?.[1]}`.toLowerCase().includes(query.toLowerCase())
  );

  const indexFiltered = useMemo(
    () => indexItems.filter((item) =>
      (indexTheme === "TODOS" || item.tema === indexTheme) &&
      `${item.nombre} ${item.contenedor} ${item.subcapa} ${item.geometria} ${item.escala}`.toLowerCase().includes(indexQuery.toLowerCase())
    ),
    [indexItems, indexTheme, indexQuery]
  );

  const toggle = (id: string) => setActive((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const ensureActive = (id: string) => setActive((current) => current.includes(id) ? current : [...current, id]);
  const setMode = (mode: VizMode) => {
    setViz(mode);
    if (mode !== "draw") {
      setPolygon(null);
      setSpatialSelection(null);
    }
  };

  const choosePointLayer = (id: string) => {
    if (!id) return;
    setSelected(id);
    ensureActive(id);
    setFeature(null);
    setSpatialSelection(null);
  };

  const handlePolygon = (nextPolygon: DrawPolygon | null) => {
    setPolygon(nextPolygon);
    setSpatialSelection(nextPolygon ? featuresInPolygon(data[selected], nextPolygon) : null);
    if (nextPolygon) setSantiReply("Polígono recibido. SANTI puede consultar todas las coberturas, aunque estén apagadas.");
  };

  const counts = {
    comuna: data.comuna?.features.length ?? 0,
    territorio: data.territorio?.features.length ?? 0,
    barrio: data.barrio?.features.length ?? 0,
    manzana: data.manzana?.features.length ?? 0,
    grifos: data.grifos?.features.length ?? 0,
    bibliotecas: data.bibliotecas?.features.length ?? 0,
  };

  const askSanti = () => {
    const result = runSanti(santiQuery, {
      active,
      selectedId: selected,
      selectedCount: selectedData.features.length,
      counts,
      manzanaPopulationSum,
      polygonResults,
      barrioNames: uniqueNames(data.barrio, ["NOM_BARRIO", "BARRIO", "NOMBRE"]),
      territorioNames: uniqueNames(data.territorio, ["NOM_TERR", "TERRITORIO", "NOMBRE"]),
    });

    result.actions.forEach((action) => {
      if (action.type === "activate_layer") {
        ensureActive(action.layerId);
        setSelected(action.layerId);
        if (polygon) setSpatialSelection(featuresInPolygon(data[action.layerId], polygon));
      }
      if (action.type === "set_viz") setMode(action.mode);
      if (action.type === "set_analysis") setAnalysis(action.analysis);
    });

    setSantiReply(result.summary);
  };

  const openFromIndex = (id: string) => {
    if (!layers.some((layer) => layer.id === id)) return;
    ensureActive(id);
    setSelected(id);
    setIndexOpen(false);
  };

  const printPdf = () => window.print();
  const props = feature?.f.properties || {};
  const lineasOn = active.includes("lineas-prc");
  const tableFields = useMemo(() => {
    const first = selectedData.features[0];
    return first ? Object.keys(first.properties).slice(0, 10) : [];
  }, [selectedData]);

  return (
    <main>
      <header className="institutionalHeader">
        <div className="municipalBrand">
          <img src={`${BASE_PATH}/logo-munistgo.png`} alt="STGO Ilustre Municipalidad" />
          <div>
            <strong>Secretaría Comunal de Planificación</strong>
            <small>Subdirección de Planificación y Sustentabilidad</small>
            <small>Oficina de Planificación</small>
          </div>
        </div>
        <div className="brand">
          <h1>Visor Territorial</h1>
          <p className="officeLabel">Repositorio Territorial Digital · Municipalidad de Santiago</p>
        </div>
        <nav className="topActions">
          <button onClick={() => setIndexOpen(true)}>Índice de Coberturas</button>
          <button onClick={() => setModal("help")}>Ayuda</button>
          <button onClick={printPdf}>PDF</button>
        </nav>
        <div className="scope"><span>CAPAS ACTIVAS</span><b>{active.length}</b></div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="catalogHelp">
            <b>Dimensiones temáticas</b>
            <p>AMB · URB · MOV · SEG · SAL · ECO · SOC. Grifos y Bibliotecas son variables y permanecen apagadas hasta que el usuario las active.</p>
          </div>
          <label className="search">
            <b>⌕</b>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cobertura temática…" />
          </label>
          <div className="layers">
            {thematicGroups.map(([code, label]) => {
              const groupLayers = filtered.filter((layer) => layer.theme === code);
              return (
                <section key={code} className="themeSection">
                  <h4><span className="themeCode">{code}</span> {label}<span>{groupLayers.length}</span></h4>
                  {groupLayers.length ? groupLayers.map((layer) => (
                    <article key={layer.id} className={selected === layer.id ? "selected" : ""} onClick={() => setSelected(layer.id)}>
                      <button className={`switch ${active.includes(layer.id) ? "on" : ""}`} onClick={(event) => { event.stopPropagation(); toggle(layer.id); }}><span /></button>
                      <em style={{ background: layer.color }}>{layer.geometry === "Punto" ? "•" : "▰"}</em>
                      <div><h3>{layer.name}</h3><p>{layer.geometry} · {status[layer.id] === "cargando" ? "cargando…" : status[layer.id] === "error" ? "error" : "disponible"}</p></div>
                    </article>
                  )) : <small className="emptyGroup">Sin capas publicadas</small>}
                </section>
              );
            })}
          </div>
        </aside>

        <section className="map">
          <InteractiveMap
            data={data}
            active={active}
            styles={styles}
            selectedLayerId={selected}
            viz={viz}
            onPolygon={handlePolygon}
            streets={streets}
            analysis={analysis}
            selectedFeature={feature?.f ?? null}
            isoMode={isoMode}
            isoMinutes={isoMinutes}
            radius={radius}
            onFeature={(item, layerId) => {
              setFeature({ f: item, layerId });
              setSelected(layerId);
              setSpatialSelection(polygon ? featuresInPolygon(data[layerId], polygon) : null);
            }}
          />

          <div className="layerControl">
            <b>Base territorial</b>
            {layers.filter((layer) => layer.theme === "BASE").map((layer) => (
              <label key={layer.id}>
                <input type="checkbox" checked={active.includes(layer.id)} onChange={() => toggle(layer.id)} />
                <i className={`key-${layer.id}`} />{layer.name}
              </label>
            ))}
            <small>Los límites se controlan solo aquí. No incluye Grifos ni Bibliotecas.</small>
          </div>

          <div className="analysisTools">
            <b>Herramientas del mapa</b>
            <label className="pointChooser">Capa de puntos
              <select value={selectedLayer.geometry === "Punto" ? selected : ""} onChange={(event) => choosePointLayer(event.target.value)}>
                <option value="">Seleccione para Clúster / Calor</option>
                {pointLayers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
              </select>
            </label>
            <div className="toolButtons">
              <button className={viz === "simple" ? "on" : ""} onClick={() => setMode("simple")}>Puntos</button>
              <button className={viz === "cluster" ? "on" : ""} onClick={() => setMode("cluster")}>Clúster</button>
              <button className={viz === "heat" ? "on" : ""} onClick={() => setMode("heat")}>Calor</button>
              <button className={viz === "draw" ? "on" : ""} onClick={() => setMode("draw")}>Polígono</button>
              <button className={lineasOn ? "on prc" : "prc"} onClick={() => toggle("lineas-prc")}>Líneas oficiales</button>
            </div>
            <label>Tipo de análisis
              <select value={analysis} onChange={(event) => setAnalysis(event.target.value)}>
                <option>Cantidad de registros</option>
                <option>Densidad</option>
                <option>Proximidad</option>
                <option>Isócronas</option>
                <option>Suma n_per</option>
                <option>Promedio n_per</option>
              </select>
            </label>
            {analysis === "Proximidad" && (
              <label>Distancia máxima
                <select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>
                  <option value={100}>100 m</option><option value={250}>250 m</option><option value={500}>500 m</option><option value={1000}>1.000 m</option>
                </select>
              </label>
            )}
            {analysis === "Isócronas" && (
              <div className="isoControls">
                <label>Modo<select value={isoMode} onChange={(event) => setIsoMode(event.target.value)}><option>A pie</option><option>Bicicleta</option><option>Vehículo</option></select></label>
                <label>Tiempo<select value={isoMinutes} onChange={(event) => setIsoMinutes(Number(event.target.value))}><option value={5}>5 minutos</option><option value={10}>10 minutos</option><option value={15}>15 minutos</option><option value={20}>20 minutos</option></select></label>
              </div>
            )}
            <p className="analysisResult"><strong>{analysisResult}</strong></p>
            <div className="legacyTools">
              <button onClick={() => setModal("table")}>Tabla</button>
              <button onClick={() => setModal("meta")}>Metadatos</button>
              <button onClick={() => setModal("report")}>Reporte</button>
            </div>
          </div>
        </section>

        <aside className="inspector">
          <section className="santiPanel">
            <div className="santiHead"><b>SANTI</b><span>Asistente territorial · beta</span></div>
            <p className="santiDescription">Consulta coberturas, conteos y nombres territoriales; activa herramientas y ejecuta consultas espaciales sobre el mapa.</p>
            <p>{santiReply}</p>
            <div className="santiAsk">
              <input value={santiQuery} onChange={(event) => setSantiQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") askSanti(); }} placeholder="Ej.: ¿cuántos barrios hay?" />
              <button onClick={askSanti}>Consultar</button>
            </div>
          </section>

          <p className="kicker">CAPA SELECCIONADA</p>
          <div className="title">
            <em style={{ background: selectedLayer.color }}>{selectedLayer.geometry === "Punto" ? "•" : selectedLayer.geometry === "Línea" ? "╱" : "▰"}</em>
            <div><h2>{selectedLayer.name}</h2><p>{groups.find((group) => group[0] === selectedLayer.theme)?.[1]} · {selectedLayer.geometry}</p></div>
          </div>
          <p>{selectedLayer.description}</p>
          <div className="summary">
            <div><b>{selectedData.features.length.toLocaleString("es-CL")}</b> registros cargados</div>
            {spatialSelection && <div><b>{spatialSelection.length.toLocaleString("es-CL")}</b> intersectados por polígono</div>}
            {polygonResults && <div><b>{polygonResults.length}</b> capas intersectadas por SANTI</div>}
          </div>
          {feature && (
            <div className="featureDetails">
              <p className="kicker">ELEMENTO CONSULTADO</p>
              {Object.entries(props).slice(0, 12).map(([key, value]) => <p key={key}><strong>{key}</strong><span>{String(value ?? "Sin dato")}</span></p>)}
            </div>
          )}
        </aside>
      </div>

      {indexOpen && (
        <div className="indexBackdrop" onClick={() => setIndexOpen(false)}>
          <section className="coverageIndex" onClick={(event) => event.stopPropagation()}>
            <header><div><p>Repositorio Territorial Digital</p><h2>Índice de Coberturas</h2><span>Las subcapas se identifican individualmente, incluso cuando provienen de GDB o GeoPackage.</span></div><button onClick={() => setIndexOpen(false)}>×</button></header>
            <div className="indexFilters">
              <input value={indexQuery} onChange={(event) => setIndexQuery(event.target.value)} placeholder="Buscar cobertura, contenedor o subcapa…" />
              <select value={indexTheme} onChange={(event) => setIndexTheme(event.target.value)}><option value="TODOS">Todas las categorías</option>{["BASE", "AMB", "URB", "MOV", "SEG", "SAL", "ECO", "SOC"].map((theme) => <option key={theme}>{theme}</option>)}</select>
              <b>{indexFiltered.length} coberturas</b>
            </div>
            <div className="indexTableWrap"><table><thead><tr><th>Tema</th><th>Cobertura</th><th>Geometría</th><th>Escala</th><th>Contenedor</th><th>Subcapa</th><th>Campo clave</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{indexFiltered.map((item) => <tr key={item.id}><td><span className={`tag tag-${item.tema}`}>{item.tema}</span></td><td><strong>{item.nombre}</strong></td><td>{item.geometria}</td><td>{item.escala}</td><td><strong>{item.contenedor}</strong><small>{item.tipoContenedor}</small></td><td><code>{item.subcapa}</code></td><td>{item.campoClave || "—"}</td><td><span className="statusOk">{item.estado}</span></td><td><div className="indexActions">{item.verEnMapa && layers.some((layer) => layer.id === item.id) && <button onClick={() => openFromIndex(item.id)}>Ver</button>}{item.download && <a href={`${BASE_PATH}${item.download}`} download>Descargar</a>}</div></td></tr>)}</tbody></table></div>
            <footer><b>Descarga individual:</b> cada cobertura publicada puede descargarse por separado, sin exigir la descarga completa de su GDB o GeoPackage de origen.</footer>
          </section>
        </div>
      )}

      {modal && (
        <div className="indexBackdrop" onClick={() => setModal(null)}>
          <section className="utilityModal" onClick={(event) => event.stopPropagation()}>
            <header><h2>{modal === "table" ? `Tabla de atributos · ${selectedLayer.name}` : modal === "meta" ? "Metadatos de cobertura" : modal === "report" ? "Reporte territorial" : "Ayuda del visor"}</h2><button onClick={() => setModal(null)}>×</button></header>
            <div className="utilityBody">
              {modal === "table" && <div className="attrTable"><table><thead><tr>{tableFields.map((field) => <th key={field}>{field}</th>)}</tr></thead><tbody>{selectedData.features.slice(0, 200).map((item, index) => <tr key={index}>{tableFields.map((field) => <td key={field}>{String(item.properties[field] ?? "")}</td>)}</tr>)}</tbody></table></div>}
              {modal === "meta" && <><h3>{selectedLayer.name}</h3><p><b>Dimensión:</b> {groups.find((group) => group[0] === selectedLayer.theme)?.[1]}</p><p><b>Geometría:</b> {selectedLayer.geometry}</p><p><b>Fuente:</b> {selectedLayer.source}</p><p><b>Registros:</b> {selectedData.features.length.toLocaleString("es-CL")}</p><p>{selectedLayer.description}</p></>}
              {modal === "report" && <><h3>Resumen</h3><p><b>Capa:</b> {selectedLayer.name}</p><p><b>Análisis:</b> {analysis}</p><p><b>Resultado:</b> {analysisResult}</p>{polygonResults && <p><b>Polígono:</b> {polygonResults.length} capas intersectadas.</p>}<button className="reportPrint" onClick={printPdf}>Imprimir / guardar PDF</button></>}
              {modal === "help" && <><h3>Herramientas del visor</h3><p><b>Clúster y Calor:</b> selecciona primero una capa de puntos.</p><p><b>Polígono:</b> dibuja un área para seleccionar e intersectar coberturas.</p><p><b>Proximidad:</b> selecciona un punto y define un radio.</p><p><b>Isócronas:</b> selecciona un punto de origen, modo y tiempo; el cálculo usa la red vial cargada.</p><p><b>SANTI:</b> responde consultas territoriales directas y consultas espaciales del polígono.</p></>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
