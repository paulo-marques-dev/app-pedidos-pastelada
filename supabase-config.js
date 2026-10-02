// ============================================================
//  CONFIGURAÇÃO DO SUPABASE (banco em tempo real)
// ============================================================
//
// Cole abaixo os dados do SEU projeto Supabase:
//   - url:     "Project URL"  (ex: https://xxxxxxxx.supabase.co)
//   - anonKey: a chave "anon public"
//
// Onde achar: painel do Supabase > Project Settings (engrenagem)
//             > "Data API"  (ou "API").
//
// A chave "anon" é pública por natureza (fica visível no
// navegador). A proteção dos dados vem das políticas (RLS)
// que o script supabase-setup.sql já configura.
//
// Enquanto estiver com "COLE_AQUI...", o app funciona apenas
// neste aparelho (salva no próprio navegador).
//
// ------------------------------------------------------------

window.supabaseConfig = {
  url: "COLE_AQUI_url",
  anonKey: "COLE_AQUI_anonKey"
};
