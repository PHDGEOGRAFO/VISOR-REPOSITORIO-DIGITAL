"use client";
import { useEffect, useMemo, useRef, useState } from "react";
export type Feature = {
  geometry: {
    type:
      | "Polygon"
      | "MultiPolygon"
      | "Point"
      | "LineString"
      | "MultiLineString";
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
  id?: string;
};
type Collection = { type: "FeatureCollection"; features: Feature[] };
type Datum = { x: number; y: number; f: Feature; i: number };
const W = 900,
  H = 600,
  TILE = 256;
function world(lon: number, lat: number, z: number) {
  const s = TILE * 2 ** z,
    sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * s,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s,
  };
}
function name(f: Feature, fallback: string) {
  const p = f.properties;
  return String(
    p.NOMBRE ??
      p.NOM_BARRIO ??
      p.NOM_TERR ??
      p.BARRIO ??
      p.COD_MZN ??
      p.TIPO_EQUIP ??
      fallback,
  );
}
function pathFor(f: Feature, z: number, cx: number, cy: number) {
  const project = (p: number[]) => {
    const q = world(p[0], p[1], z);
    return [q.x - cx + W / 2, q.y - cy + H / 2];
  };
  const polygons =
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : (f.geometry.coordinates as unknown[]);
  return (polygons as unknown[][])
    .map((poly) =>
      (poly as number[][][])
        .map(
          (ring) =>
            ring
              .map((p, i) => {
                const [x, y] = project(p);
                return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
              })
              .join("") + "Z",
        )
        .join(" "),
    )
    .join(" ");
}
function linePath(f: Feature, z: number, cx: number, cy: number) {
  const project = (p: number[]) => {
    const q = world(p[0], p[1], z);
    return [q.x - cx + W / 2, q.y - cy + H / 2];
  };
  const lines =
    f.geometry.type === "LineString"
      ? [f.geometry.coordinates]
      : (f.geometry.coordinates as unknown[]);
  return (lines as number[][][])
    .map((line) =>
      line
        .map((p, i) => {
          const [x, y] = project(p);
          return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(""),
    )
    .join(" ");
}
function inside(p: number[], poly: number[][]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
}
function meters(a: number[], b: number[]) {
  const k = Math.PI / 180,
    x = (b[0] - a[0]) * k * Math.cos(((a[1] + b[1]) * k) / 2),
    y = (b[1] - a[1]) * k;
  return Math.hypot(x, y) * 6371008.8;
}
function lines(f: Feature) {
  return (
    f.geometry.type === "LineString"
      ? [f.geometry.coordinates]
      : f.geometry.coordinates
  ) as number[][][];
}
function heapPush(h: [number, string][], v: [number, string]) {
  h.push(v);
  let i = h.length - 1;
  while (i) {
    const p = (i - 1) >> 1;
    if (h[p][0] <= v[0]) break;
    h[i] = h[p];
    i = p;
  }
  h[i] = v;
}
function heapPop(h: [number, string][]) {
  if (!h.length) return null;
  const root = h[0],
    last = h.pop()!;
  if (h.length) {
    let i = 0;
    while (true) {
      let c = i * 2 + 1;
      if (c >= h.length) break;
      if (c + 1 < h.length && h[c + 1][0] < h[c][0]) c++;
      if (h[c][0] >= last[0]) break;
      h[i] = h[c];
      i = c;
    }
    h[i] = last;
  }
  return root;
}

export default function InteractiveMap({
  boundaries,
  libraries,
  grifos,
  streets,
  selectedData,
  layerData,
  selectedLayerId,
  analysis,
  active,
  selectBoundary,
  viz,
  field,
  tool,
  radius,
  selectedFeature,
  onFeature,
  onSelection,
  isoMode,
  isoMinutes,
}: {
  boundaries: Record<string, Collection>;
  libraries: Collection;
  grifos: Collection;
  streets: Collection;
  selectedData: Collection;
  layerData: Record<string, Collection>;
  selectedLayerId: string;
  analysis: string;
  active: string[];
  selectBoundary: (id: string) => void;
  viz: "simple" | "cluster" | "heat" | "draw";
  field: string;
  tool: string;
  radius: string;
  selectedFeature: Feature | null;
  onFeature: (f: Feature) => void;
  onSelection: (f: Feature[] | null) => void;
  isoMode: string;
  isoMinutes: number;
}) {
  const [center, setCenter] = useState({ lon: -70.657, lat: -33.448 }),
    [zoom, setZoom] = useState(14),
    [tip, setTip] = useState<{
      x: number;
      y: number;
      title: string;
      detail: string;
    } | null>(null),
    [draw, setDraw] = useState<number[][]>([]);
  const drag = useRef<{
      x: number;
      y: number;
      center: { lon: number; lat: number };
    } | null>(null),
    drawing = useRef(false),
    cw = world(center.lon, center.lat, zoom);
  const tiles = useMemo(() => {
    const minX = Math.floor((cw.x - W / 2) / TILE),
      maxX = Math.floor((cw.x + W / 2) / TILE),
      minY = Math.floor((cw.y - H / 2) / TILE),
      maxY = Math.floor((cw.y + H / 2) / TILE),
      n = 2 ** zoom,
      out: { x: number; y: number; tx: number; ty: number }[] = [];
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        if (y >= 0 && y < n)
          out.push({
            x,
            y,
            tx: x * TILE - cw.x + W / 2,
            ty: y * TILE - cw.y + H / 2,
          });
    return out;
  }, [cw.x, cw.y, zoom]);
  const projectPoints = (fc: Collection) =>
    fc.features
      .filter((f) => f.geometry.type === "Point")
      .map((f, i) => {
        const p = f.geometry.coordinates as number[],
          q = world(p[0], p[1], zoom);
        return { x: q.x - cw.x + W / 2, y: q.y - cw.y + H / 2, f, i };
      });
  const pointData: Datum[] = useMemo(
    () => projectPoints(selectedData),
    [selectedData, cw.x, cw.y, zoom],
  );
  const clusters = useMemo(() => {
    const out: { x: number; y: number; items: Datum[] }[] = [];
    pointData.forEach((p) => {
      const hit = out.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < 38);
      if (hit) {
        hit.items.push(p);
        hit.x = hit.items.reduce((a, v) => a + v.x, 0) / hit.items.length;
        hit.y = hit.items.reduce((a, v) => a + v.y, 0) / hit.items.length;
      } else out.push({ x: p.x, y: p.y, items: [p] });
    });
    return out;
  }, [pointData]);
  const colors = ["#a74235", "#d6a84d", "#35699a", "#668b70", "#7d5a9a"],
    collection = selectedData,
    categories = useMemo(
      () =>
        [
          ...new Set(
            collection.features.map((f) =>
              String(f.properties[field] || "Sin dato"),
            ),
          ),
        ].sort(),
      [collection, field],
    ),
    color = (f: Feature) =>
      colors[
        Math.max(
          0,
          categories.indexOf(String(f.properties[field] || "Sin dato")),
        ) % colors.length
      ],
    anchor =
      pointData.find(
        (p) =>
          selectedFeature &&
          (p.f.id === selectedFeature.id ||
            p.f.properties.ID === selectedFeature.properties.ID),
      ) ?? pointData[0];
  const isoPolygon = useMemo(() => {
    if (analysis !== "Isócronas" || !anchor || !streets.features.length)
      return "";
    const origin = anchor.f.geometry.coordinates as number[],
      max =
        (isoMode === "Vehículo" ? 8.33 : isoMode === "Bicicleta" ? 4.2 : 1.4) *
        isoMinutes *
        60,
      nodes = new Map<string, number[]>(),
      edges = new Map<string, { to: string; cost: number }[]>(),
      key = (p: number[]) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
    streets.features.forEach((f) =>
      lines(f).forEach((line) => {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1],
            b = line[i],
            ka = key(a),
            kb = key(b),
            cost = meters(a, b);
          nodes.set(ka, a);
          nodes.set(kb, b);
          edges.set(ka, [...(edges.get(ka) || []), { to: kb, cost }]);
          edges.set(kb, [...(edges.get(kb) || []), { to: ka, cost }]);
        }
      }),
    );
    let start = "",
      best = Infinity;
    nodes.forEach((p, k) => {
      const d = meters(origin, p);
      if (d < best) {
        best = d;
        start = k;
      }
    });
    const dist = new Map<string, number>([[start, 0]]),
      queue: [number, string][] = [[0, start]],
      reached: number[][] = [];
    while (queue.length) {
      const [d, k] = heapPop(queue)!;
      if (d !== (dist.get(k) ?? Infinity) || d > max) continue;
      reached.push(nodes.get(k)!);
      for (const e of edges.get(k) || []) {
        const nd = d + e.cost;
        if (nd <= max && nd < (dist.get(e.to) ?? Infinity)) {
          dist.set(e.to, nd);
          heapPush(queue, [nd, e.to]);
        }
      }
    }
    const bins = new Map<number, { p: number[]; d: number }>();
    reached.forEach((p) => {
      const a = Math.atan2(
          p[1] - origin[1],
          (p[0] - origin[0]) * Math.cos((origin[1] * Math.PI) / 180),
        ),
        bin = Math.round(((a + Math.PI) * 36) / Math.PI) % 72,
        d = meters(origin, p),
        old = bins.get(bin);
      if (!old || d > old.d) bins.set(bin, { p, d });
    });
    return [...bins.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => {
        const q = world(v.p[0], v.p[1], zoom);
        return `${(q.x - cw.x + W / 2).toFixed(1)},${(q.y - cw.y + H / 2).toFixed(1)}`;
      })
      .join(" ");
  }, [analysis, anchor, streets, isoMode, isoMinutes, zoom, cw.x, cw.y]);
  const screen = (e: React.PointerEvent) => {
      const r = e.currentTarget.getBoundingClientRect();
      return [
        ((e.clientX - r.left) / r.width) * W,
        ((e.clientY - r.top) / r.height) * H,
      ];
    },
    zoomAt = (z: number) => setZoom(Math.max(11, Math.min(18, z))),
    move = (e: React.PointerEvent) => {
      if (drawing.current) {
        const p = screen(e);
        setDraw((a) =>
          a.length &&
          Math.hypot(a[a.length - 1][0] - p[0], a[a.length - 1][1] - p[1]) < 5
            ? a
            : [...a, p],
        );
        return;
      }
      if (!drag.current) return;
      const scale = TILE * 2 ** zoom,
        dx = e.clientX - drag.current.x,
        dy = e.clientY - drag.current.y,
        c = world(drag.current.center.lon, drag.current.center.lat, zoom),
        x = c.x - dx,
        y = c.y - dy,
        lon = (x / scale) * 360 - 180,
        n = Math.PI - (2 * Math.PI * y) / scale,
        lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
      setCenter({ lon, lat });
    },
    finish = () => {
      if (drawing.current) {
        drawing.current = false;
        onSelection(
          pointData.filter((p) => inside([p.x, p.y], draw)).map((p) => p.f),
        );
      }
      drag.current = null;
    },
    selectedIds = new Set(
      (draw.length > 2
        ? pointData.filter((p) => inside([p.x, p.y], draw))
        : []
      ).map((p) => p.i),
    ),
    radiusPx =
      Number(radius) /
      ((Math.cos((center.lat * Math.PI) / 180) * 2 * Math.PI * 6378137) /
        (TILE * 2 ** zoom));
  useEffect(() => {
    if (analysis !== "Proximidad" || !anchor) return;
    const origin = anchor.f.geometry.coordinates as number[];
    onSelection(
      collection.features.filter(
        (f) =>
          f.geometry.type === "Point" &&
          meters(origin, f.geometry.coordinates as number[]) <= Number(radius),
      ),
    );
  }, [analysis, anchor?.f, radius, collection]);
  return (
    <div
      className="interactiveMap"
      onWheel={(e) => {
        e.preventDefault();
        zoomAt(zoom + (e.deltaY < 0 ? 1 : -1));
      }}
      onPointerDown={(e) => {
        if ((e.target as Element).closest(".layerControl,.zoomControl")) return;
        if (viz === "draw") {
          drawing.current = true;
          setDraw([screen(e)]);
          onSelection(null);
        } else drag.current = { x: e.clientX, y: e.clientY, center };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={move}
      onPointerUp={finish}
    >
      <svg viewBox={`0 0 ${W} ${H}`}>
        <g className="osmTiles">
          {tiles.map((t) => (
            <image
              key={`${zoom}-${t.x}-${t.y}`}
              href={`https://tile.openstreetmap.org/${zoom}/${((t.x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom}/${t.y}.png`}
              x={t.tx}
              y={t.ty}
              width={TILE}
              height={TILE}
            />
          ))}
        </g>
        {(["comuna", "territorio", "barrio", "manzana"] as const).map(
          (id) =>
            active.includes(id) &&
            boundaries[id] && (
              <g key={id} className={`geoLayer geo-${id}`}>
                {boundaries[id].features.map((f, i) => (
                  <path
                    key={i}
                    fillRule="evenodd"
                    d={pathFor(f, zoom, cw.x, cw.y)}
                    onClick={() => onFeature(f)}
                  />
                ))}
              </g>
            ),
        )}
        {analysis === "Isócronas" && (
          <g className="streetNetwork">
            {streets.features.map((f, i) => (
              <path key={i} d={linePath(f, zoom, cw.x, cw.y)} />
            ))}
          </g>
        )}
        {isoPolygon && (
          <polygon className="isochronePolygon" points={isoPolygon} />
        )}{" "}
        {analysis === "Isócronas" && anchor && (
          <circle className="isoOrigin" cx={anchor.x} cy={anchor.y} r="7" />
        )}
        {active
          .filter((id) => id !== selectedLayerId && layerData[id])
          .map((id, layerIndex) => (
            <g key={id} className="overlayPoints">
              {projectPoints(layerData[id]).map((point) => (
                <circle
                  key={point.i}
                  cx={point.x}
                  cy={point.y}
                  r={id === "grifos" ? 3.5 : 6}
                  style={{ fill: ["#a74235", "#278276", "#35699a", "#c1923f", "#7d5a9a"][layerIndex % 5] }}
                  onClick={() => onFeature(point.f)}
                >
                  <title>{name(point.f, id)}</title>
                </circle>
              ))}
            </g>
          ))}
        {active.includes(selectedLayerId) && viz === "heat" && (
          <g className="realHeat">
            {pointData.map((p) => (
              <circle key={p.i} cx={p.x} cy={p.y} r="25" />
            ))}
          </g>
        )}
        {active.includes(selectedLayerId) && viz === "cluster" && (
          <g className="realClusters">
            {clusters.map((c, i) => (
              <g
                key={i}
                onClick={() => c.items.length === 1 && onFeature(c.items[0].f)}
              >
                <circle cx={c.x} cy={c.y} r={c.items.length > 1 ? 16 : 8} />
                {c.items.length > 1 && (
                  <text x={c.x} y={c.y + 4}>
                    {c.items.length}
                  </text>
                )}
              </g>
            ))}
          </g>
        )}
        {active.includes(selectedLayerId) &&
          (viz === "simple" || viz === "draw") && (
            <g className="realPoints">
              {pointData.map((p) => (
                <circle
                  key={p.i}
                  className={
                    viz === "draw"
                      ? selectedIds.has(p.i)
                        ? "drawSelected"
                        : "drawOutside"
                      : ""
                  }
                  cx={p.x}
                  cy={p.y}
                  r={selectedLayerId === "grifos" ? 3.5 : 7}
                  style={
                    field === "Sin desagregar"
                      ? undefined
                      : { fill: color(p.f) }
                  }
                  onClick={() => onFeature(p.f)}
                >
                  <title>{name(p.f, selectedLayerId)}</title>
                </circle>
              ))}
            </g>
          )}
        {viz === "draw" && draw.length > 1 && (
          <polyline
            className="freehandSelection"
            points={
              draw.map((p) => p.join(",")).join(" ") +
              (drawing.current ? "" : " " + draw[0].join(","))
            }
          />
        )}{" "}
        {analysis === "Proximidad" && anchor && (
          <circle
            className="realBuffer"
            cx={anchor.x}
            cy={anchor.y}
            r={radiusPx}
          />
        )}
      </svg>
      <div className="zoomControl">
        <button onClick={() => zoomAt(zoom + 1)}>+</button>
        <b>{zoom}</b>
        <button onClick={() => zoomAt(zoom - 1)}>−</button>
        <button
          onClick={() => {
            setCenter({ lon: -70.657, lat: -33.448 });
            setZoom(14);
          }}
        >
          ⌂
        </button>
      </div>
      <div className="layerControl" onPointerDown={(e) => e.stopPropagation()}>
        <b>Límites</b>
        {[
          ["comuna", "Límite comunal"],
          ["territorio", "Territorios"],
          ["barrio", "Barrios"],
          ["manzana", "Manzanas"],
        ].map(([id, label]) => (
          <label key={id}>
            <input
              type="radio"
              name="limite"
              checked={active.includes(id)}
              onChange={() => selectBoundary(id)}
            />
            <i className={`key-${id}`} />
            {label}
          </label>
        ))}
        <small>Se muestra un límite territorial a la vez.</small>
      </div>
      <div className="mapAttribution">
        © OpenStreetMap contributors · arrastre para mover · rueda o +/− para
        zoom
      </div>
      {tip && (
        <div className="mapTooltip" style={{ left: tip.x, top: tip.y }}>
          <b>{tip.title}</b>
          <span>{tip.detail}</span>
        </div>
      )}
    </div>
  );
}
