import { describe } from "bun:test";
import { resolve } from "node:path";
import {
  adapterConformance,
  artifactConformance,
  nodeRuntime,
} from "@tschk/moonshine-adapter-conformance";
import { nodeAdapter, nodeHarness } from "../src/index.js";

describe("node adapter", () => {
  adapterConformance(nodeAdapter, nodeHarness);
  artifactConformance(nodeAdapter, nodeRuntime, resolve(import.meta.dir, ".."));
});
