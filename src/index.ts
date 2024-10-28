import { shouldInterruptAfterDeadline } from "quickjs-emscripten";

import type { QuickJSWASMModule } from "quickjs-emscripten";
import { Arena } from "quickjs-emscripten-sync";
import {
  newQuickJSWASMModule,
  DEBUG_SYNC as baseVariant,
  newVariant,
} from "quickjs-emscripten";
import cloudflareWasmModule from "./DEBUG_SYNC.wasm";
import cloudflareWasmModuleSourceMap from "./DEBUG_SYNC.wasm.map.txt";

const cloudflareVariant = newVariant(baseVariant, {
  wasmModule: cloudflareWasmModule,
  wasmSourceMapData: cloudflareWasmModuleSourceMap,
});

let QuickJS: QuickJSWASMModule | undefined;

addEventListener("fetch", async (event) => {
  event.respondWith(serverResponse(event));
});

const input = `
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
    <link rel="stylesheet" href="styles.css"> <!-- Link to external CSS if needed -->
</head>
<body>
    <h1>Hello World</h1>
</body>
</html>
`;

const serverResponse = async (event: FetchEvent) => {
  QuickJS = await newQuickJSWASMModule(cloudflareVariant);

  const ctx = QuickJS.newContext();
  const arena = new Arena(ctx, { isMarshalable: true });

  let result = "";

  const handleResult = ctx.newFunction("handleResult", (r) => {
    console.log(ctx.getString(r));
    result = ctx.getString(r);
  });

  ctx.setProp(ctx.global, "onResult", handleResult);
  handleResult.dispose();

  const exposed = {
    rewritter: new HTMLRewriter(),
    input,
  };

  arena.expose(exposed);

  arena.evalCode(`
    // This works
    onResult("result");

    class ElementHandler {
      async element(element) {
    }
    };

   // rewritter.on fails with Maximum call stack size exceeded
  //  rewritter.on("title", new ElementHandler());
  `);

  arena.dispose();
  ctx.dispose();

  const headers = { "content-type": "text/html" };
  const response = new Response(input, { headers });
  return response;
};
