import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ===== DealBot Onboarding — interpreta el negocio del usuario y genera la config =====
// Usa Opus 4.8 (calidad, corre 1 vez por cliente). Cambiable por secret ONBOARD_MODEL.
const MODEL = Deno.env.get("ONBOARD_MODEL") || "claude-opus-4-8";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(o: unknown) { return new Response(JSON.stringify(o), { headers: { ...CORS, "content-type": "application/json" } }); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const productos = (body.productos ?? "").toString().slice(0, 200);
    const modo = (body.modo ?? "consumidor").toString().slice(0, 20);
    const marca = (body.marca ?? "").toString().slice(0, 80);

    const KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SB_URL = Deno.env.get("SUPABASE_URL")!;
    const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` };
    const catsRes = await fetch(`${SB_URL}/rest/v1/dealbot_categorias?select=slug,nombre&activo=eq.true&order=orden`, { headers: h });
    const cats = await catsRes.json().catch(() => []);
    const slugs = (Array.isArray(cats) ? cats : []).map((c: any) => c.slug);
    const catList = (Array.isArray(cats) ? cats : []).map((c: any) => `${c.slug} (${c.nombre})`).join(", ");

    if (!KEY) return json({ categoria_principal: slugs[0] || "atun", categorias: slugs, modo, marca: marca || null, no_disponibles: [], bienvenida: "¡Listo! Entra al panel para empezar.", sinKey: true });

    const system = `Sos el configurador de DealBot PA, una plataforma de inteligencia de precios de supermercados de Panama. Un usuario describio que quiere monitorear y vas a armar la configuracion de su panel.\n\nCategorias disponibles (usa SOLO estos slugs): ${catList}\n\nReglas:\n- categoria_principal: el slug EXACTO de la categoria disponible mas relevante a lo que pidio.\n- categorias: array con todos los slugs disponibles relevantes a su interes.\n- modo: "consumidor" si quiere ahorrar en sus compras, "negocio" si vigila competencia o vende una marca.\n- marca: la marca o producto que vende (texto), o null.\n- no_disponibles: array con los productos que pidio pero que NO estan en las categorias disponibles (ej: aceite, leche, pasta).\n- bienvenida: 1-2 frases calidas en espanol resumiendo como configuraste su panel.\n\nResponde UNICAMENTE con un objeto JSON valido, sin markdown ni texto adicional, con exactamente estas claves: categoria_principal, categorias, modo, marca, no_disponibles, bienvenida.`;

    const userMsg = `Productos que quiere monitorear: ${productos || "no especifico"}\nTipo de uso: ${modo}\nMarca/producto que vende: ${marca || "ninguno"}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, system, messages: [{ role: "user", content: userMsg }] }),
    });
    const j = await r.json();
    if (!r.ok) return json({ categoria_principal: slugs[0] || "atun", categorias: slugs, modo, marca: marca || null, no_disponibles: [], bienvenida: "Entra al panel y elegi tu categoria." });

    const texto = (Array.isArray(j.content) ? (j.content.find((b: any) => b.type === "text")?.text) : "") || "";
    let cfg: any = null;
    try { cfg = JSON.parse(texto); } catch { const m = texto.match(/\{[\s\S]*\}/); if (m) { try { cfg = JSON.parse(m[0]); } catch { /*noop*/ } } }
    if (!cfg) return json({ categoria_principal: slugs[0] || "atun", categorias: slugs, modo, marca: marca || null, no_disponibles: [], bienvenida: "¡Listo! Entra al panel." });

    cfg.categorias = Array.isArray(cfg.categorias) ? cfg.categorias.filter((s: string) => slugs.includes(s)) : [];
    if (!slugs.includes(cfg.categoria_principal)) cfg.categoria_principal = cfg.categorias[0] || slugs[0] || "atun";
    if (!cfg.categorias.length) cfg.categorias = [cfg.categoria_principal];
    cfg.modo = (cfg.modo === "negocio" ? "negocio" : "consumidor");
    if (!Array.isArray(cfg.no_disponibles)) cfg.no_disponibles = [];
    cfg.modelo = MODEL;
    return json(cfg);
  } catch (e) {
    return json({ categoria_principal: "atun", categorias: [], modo: "consumidor", marca: null, no_disponibles: [], bienvenida: "Entra al panel y configura manualmente.", error: String((e as Error)?.message || e) });
  }
});
