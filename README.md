# QAR Riberana — App web

Vercel (hosting + API) + Supabase (base de datos y fotos) + publicación automática a Basecamp.

## Variables de entorno (Vercel → Settings → Environment Variables)
| Nombre | Valor |
|---|---|
| SUPABASE_URL | Project URL de Supabase |
| SUPABASE_SERVICE_KEY | llave service_role de Supabase (secreta) |
| SESSION_SECRET | cualquier texto largo y aleatorio (32+ caracteres) |
| ADMIN_EMAIL | correo del administrador |
| ADMIN_PIN | PIN del administrador (el primer login crea el usuario admin) |
| APP_URL | URL de la app, sin diagonal final. Ej. https://qar-riberana.vercel.app |
| BC_CLIENT_ID | Client ID de Basecamp |
| BC_CLIENT_SECRET | Client Secret de Basecamp |
| BC_REFRESH_TOKEN | se obtiene al abrir APP_URL/api/bc-auth (paso final) |

## Base de datos
Supabase → SQL Editor → pegar y ejecutar `supabase/schema.sql`.
