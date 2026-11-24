// Konfigirasyon Firebase piblik la soti nan environment variables Pages.
import handler from './_shared/handler.js';

export async function onRequest({ request, env }) {
  return handler.fetch(request, env);
}
