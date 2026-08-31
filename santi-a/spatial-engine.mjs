// Santi_A spatial engine
// Operaciones básicas GeoJSON sin depender del estado visible del mapa.

function bboxOfCoords(coords, bbox = [Infinity, Infinity, -Infinity, -Infinity]) {
  if (!Array.isArray(coords)) return bbox;
  if (typeof coords[0] === "number") {
    const [x, y] = coords;
    bbox[0] = Math.min(bbox[0], x);
    bbox[1] = Math.min(bbox[1], y);
    bbox[2] = Math.max(bbox[2], x);
    bbox[3] = Math.max(bbox[3], y);
    return bbox;
  }
  for (const child of coords) bboxOfCoords(child, bbox);
  return bbox;
}

export function bboxOfGeometry(geometry) {
  if (!geometry?.coordinates) return null;
  const bbox = bboxOfCoords(geometry.coordinates);
  return bbox.every(Number.isFinite) ? bbox : null;
}

export function bboxIntersects(a, b) {
  if (!a || !b) return false;
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

export function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point, polygonGeometry) {
  if (!polygonGeometry) return false;
  if (polygonGeometry.type === "Polygon") {
    const [outer, ...holes] = polygonGeometry.coordinates;
    return pointInRing(point, outer) && !holes.some((hole) => pointInRing(point, hole));
  }
  if (polygonGeometry.type === "MultiPolygon") {
    return polygonGeometry.coordinates.some((poly) => pointInPolygon(point, { type: "Polygon", coordinates: poly }));
  }
  return false;
}

function orientation(a, b, c) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b[0] <= Math.max(a[0], c[0]) + 1e-12 && b[0] + 1e-12 >= Math.min(a[0], c[0]) && b[1] <= Math.max(a[1], c[1]) + 1e-12 && b[1] + 1e-12 >= Math.min(a[1], c[1]);
}

export function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function polygonEdges(polygonGeometry) {
  const polygons = polygonGeometry.type === "MultiPolygon" ? polygonGeometry.coordinates : [polygonGeometry.coordinates];
  const edges = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) edges.push([ring[i - 1], ring[i]]);
    }
  }
  return edges;
}

function lineSegments(geometry) {
  const lines = geometry.type === "MultiLineString" ? geometry.coordinates : [geometry.coordinates];
  const segments = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) segments.push([line[i - 1], line[i]]);
  }
  return segments;
}

export function geometryIntersectsPolygon(geometry, polygonGeometry) {
  if (!geometry || !polygonGeometry) return false;
  if (!bboxIntersects(bboxOfGeometry(geometry), bboxOfGeometry(polygonGeometry))) return false;

  if (geometry.type === "Point") return pointInPolygon(geometry.coordinates, polygonGeometry);
  if (geometry.type === "MultiPoint") return geometry.coordinates.some((pt) => pointInPolygon(pt, polygonGeometry));

  const polyEdges = polygonEdges(polygonGeometry);

  if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
    const segments = lineSegments(geometry);
    for (const [a, b] of segments) {
      if (pointInPolygon(a, polygonGeometry) || pointInPolygon(b, polygonGeometry)) return true;
      if (polyEdges.some(([c, d]) => segmentsIntersect(a, b, c, d))) return true;
    }
    return false;
  }

  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    const candidateEdges = polygonEdges(geometry);
    if (candidateEdges.some(([a, b]) => polyEdges.some(([c, d]) => segmentsIntersect(a, b, c, d)))) return true;
    const candidatePoint = geometry.type === "Polygon" ? geometry.coordinates[0][0] : geometry.coordinates[0][0][0];
    const queryPoint = polygonGeometry.type === "Polygon" ? polygonGeometry.coordinates[0][0] : polygonGeometry.coordinates[0][0][0];
    return pointInPolygon(candidatePoint, polygonGeometry) || pointInPolygon(queryPoint, geometry);
  }

  return false;
}

export function intersectFeatureCollection(polygonGeometry, featureCollection) {
  const features = featureCollection?.features ?? [];
  const matches = features.filter((feature) => geometryIntersectsPolygon(feature.geometry, polygonGeometry));
  return {
    count: matches.length,
    featureIds: matches.map((feature, index) => feature.id ?? feature.properties?.id ?? index),
    features: matches,
  };
}

export function analyzeCatalogPolygon(polygonGeometry, layers = []) {
  const intersections = {};
  for (const layer of layers) {
    if (layer.queryable === false || !layer.id || !layer.data) continue;
    intersections[layer.id] = intersectFeatureCollection(polygonGeometry, layer.data);
  }
  return intersections;
}
