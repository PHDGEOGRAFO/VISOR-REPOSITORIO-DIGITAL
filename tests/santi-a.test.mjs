import assert from "node:assert/strict";
import test from "node:test";
import { answer, detectIntent, detectLayer } from "../santi-a/engine.mjs";

const stats = {
  museos: [
    { barrio: "A", territorio: "Centro", count: 3 },
    { barrio: "B", territorio: "Sur", count: 7 },
  ],
  bibliotecas: [{ barrio: "C", territorio: "Centro", count: 2 }],
};

test("detecta consulta de concentración", () => {
  assert.equal(
    detectIntent("¿Dónde hay mayor concentración de museos?"),
    "max_concentration",
  );
});

test("detecta capa museo", () => {
  assert.equal(
    detectLayer("¿Dónde hay mayor concentración de museos?")?.id,
    "museos",
  );
});

test("responde con barrio, territorio, estadística y acciones de mapa", () => {
  const result = answer("¿Dónde hay mayor concentración de museos?", stats);
  assert.equal(result.ok, true);
  assert.equal(result.stats.barrio, "B");
  assert.equal(result.stats.territorio, "Sur");
  assert.match(result.summary, /7 registros/);
  assert.deepEqual(
    result.mapActions.map((action) => action.type),
    ["activate_layer", "zoom_to", "highlight"],
  );
});
