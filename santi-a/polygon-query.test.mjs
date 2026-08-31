import assert from "node:assert/strict";
import test from "node:test";
import { answer, answerPolygon } from "./engine.mjs";

test("polygon inventory requires a drawn polygon", () => {
  const result = answer("¿Qué existe en este polígono?", {});
  assert.equal(result.ok, false);
  assert.equal(result.intent, "polygon_inventory");
  assert.equal(result.mapActions[0].type, "start_polygon_draw");
});

test("polygon inventory queries catalogued layers even when all are off", () => {
  const result = answerPolygon(
    {
      museos: { count: 3 },
      bibliotecas: { count: 2 },
      reciclaje: { count: 0 },
    },
    { visibleLayers: [] },
  );

  assert.equal(result.ok, true);
  assert.equal(result.ignoredMapVisibility, true);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].id, "museos");
  assert.equal(result.results[0].mapVisibleBeforeQuery, false);
  assert.equal(result.results[1].id, "bibliotecas");
});

test("polygon inventory reports only layers with intersections", () => {
  const result = answerPolygon({ museos: { count: 1 } });
  assert.deepEqual(result.results.map((row) => row.id), ["museos"]);
  assert.equal(result.results[0].count, 1);
});
