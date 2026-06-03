// src/lib/server/adminAuth.ts
// Middleware de autenticação via header para rotas admin

export function requireAdminSecret(request: Request): Response | null {
  const adminSecret = process.env.GMB_ADMIN_SECRET;

  if (!adminSecret) {
    return new Response(
      JSON.stringify({
        error: 'Servidor sem GMB_ADMIN_SECRET configurado. Defina a variável no .env.local.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const providedSecret = request.headers.get('x-admin-secret');

  if (!providedSecret || providedSecret !== adminSecret) {
    return new Response(
      JSON.stringify({ error: 'Não autorizado. Header x-admin-secret incorreto ou ausente.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return null; // OK, prosseguir
}
