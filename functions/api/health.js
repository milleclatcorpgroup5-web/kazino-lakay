// Explicit Cloudflare Pages route for runtime diagnostics.
import handler from '../_shared/handler.js';
export async function onRequest({ request, env }) {
  return handler.fetch(request, env);
}
