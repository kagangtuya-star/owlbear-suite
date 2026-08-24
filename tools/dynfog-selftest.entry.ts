// Node entry for the dynfog geometry self-test. Bundled by
// tools/dynfog-selftest.mjs; not part of any browser build.
import { reportDynfogSelfTest } from "../src/modules/fullFog/dynfog/selftest";

const ok = reportDynfogSelfTest();
process.exit(ok ? 0 : 1);
