import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeCatalogPolygon,
  geometryIntersectsPolygon,
  pointInPolygon,
} from "./spatial-engine.mjs";

const queryPolygon = {
  type: "Polygon",
  coordinates: [[
    [-70.64798, -33.43569],
    [-70.64689, -33.43569],
    [-70.64689, -33.43478],
    [-70.64798, -33.43478],
    [-70.64798, -33.43569],
  ]],
};

test("point-in-polygon basic behavior", () => {
  assert.equal(pointInPolygon([-70.6474, -33.4352], queryPolygon), true);
  assert.equal(pointInPolygon([-70.65, -33.44], queryPolygon), false);
});

test("line crossing the drawn polygon is detected", () => {
  const line = {
    type: "LineString",
    coordinates: [
      [-70.6485, -33.4352],
      [-70.6465, -33.4352],
    ],
  };
  assert.equal(geometryIntersectsPolygon(line, queryPolygon), true);
});

test("catalog analysis checks layers regardless of visual state", () => {
  const layers = [
    {
      id: "museos",
      queryable: true,
      visible: false,
      data: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", id: "m1", properties: {}, geometry: { type: "Point", coordinates: [-70.6474, -33.4352] } },
          { type: "Feature", id: "m2", properties: {}, geometry: { type: "Point", coordinates: [-70.65, -33.44] } },
        ],
      },
    },
    {
      id: "bibliotecas",
      queryable: true,
      visible: false,
      data: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", id: "b1", properties: {}, geometry: { type: "Point", coordinates: [-70.6472, -33.4351] } },
        ],
      },
    },
  ];

  const result = analyzeCatalogPolygon(queryPolygon, layers);
  assert.equal(result.museos.count, 1);
  assert.equal(result.bibliotecas.count, 1);
});
