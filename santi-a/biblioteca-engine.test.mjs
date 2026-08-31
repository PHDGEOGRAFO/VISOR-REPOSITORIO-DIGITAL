import assert from "node:assert/strict";
import test from "node:test";
import {
  getQueryableBibliotecaCatalog,
  getBibliotecaLayer,
  geometryFamily,
  answerBibliotecaPolygon,
} from "./biblioteca-engine.mjs";

test("catalog connects only validated/publicadas from 2. BIBLIOTECA DIGITAL", () => {
  const catalog = getQueryableBibliotecaCatalog();
  assert.equal(catalog.length, 25);
  assert.ok(catalog.every((entry) => entry.sourceUnit === "2. BIBLIOTECA DIGITAL"));
  assert.ok(catalog.every((entry) => entry.reviewStatus === "VALIDADA"));
  assert.ok(catalog.every((entry) => entry.repositoryStatus === "PUBLICADA"));
});

test("geometry families classify points lines polygons", () => {
  assert.equal(geometryFamily("Punto Z"), "point");
  assert.equal(geometryFamily("Multilínea"), "line");
  assert.equal(geometryFamily("Multipolígono"), "polygon");
});

test("real bus-stop layer metadata is registered", () => {
  const layer = getBibliotecaLayer("MOV_PTO_PARADEROS_BUS_MUNICIPAL");
  assert.equal(layer.recordCount, 51);
  assert.deepEqual(layer.fields, ["Id", "Direccion", "Trayecto", "Orientacio"]);
});

test("polygon query includes hidden real layer", () => {
  const result = answerBibliotecaPolygon(
    {
      mov_pto_paraderos_bus_municipal: {
        count: 1,
        details: [
          {
            Id: 45,
            Direccion: "San Diego – Pasaje Figueroa",
            Trayecto: "Regreso",
            Orientacio: "Esquina Suroriente",
          },
        ],
      },
    },
    { visibleLayers: [] },
  );

  assert.equal(result.queriedLayerCount, 25);
  assert.equal(result.resultLayerCount, 1);
  assert.equal(result.results[0].count, 1);
  assert.equal(result.results[0].mapVisibleBeforeQuery, false);
  assert.equal(result.ignoredMapVisibility, true);
});
