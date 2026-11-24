// Explicit Cloudflare Pages route for the public game catalog.
import handler from '../_shared/handler.js';
export async function onRequest({ request, env }) {
  return handler.fetch(request, env);
}
