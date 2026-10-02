# 🥟 App de Pedidos · Pastelada

Aplicativo web (PWA) para registrar os pedidos de um evento beneficente (pastelada), usado em vários celulares ao mesmo tempo com sincronização em tempo real.

## ✨ Funcionalidades

- **Novo Pedido**: registra o cliente e os sabores/quantidades.
- **Pedidos**: lista todos os pedidos com totais atualizados automaticamente.
- **Sabores**: cadastro e remoção de sabores.
- **Resumo**: total de pastéis por sabor (para a cozinha) e total geral.
- Sincronização em **tempo real** entre aparelhos (Supabase Realtime).
- Instalável no celular (PWA) e com modo offline, salvando no próprio aparelho.

## 🧰 Tecnologias

- JavaScript, HTML e CSS (sem framework)
- Supabase (PostgreSQL + Realtime + RLS)
- PWA (manifest + service worker)
- Hospedagem na Vercel

## ▶️ Como usar

1. Crie um projeto gratuito no [Supabase](https://supabase.com) e rode o script `supabase-setup.sql` no SQL Editor.
2. Em `supabase-config.js`, troque `COLE_AQUI_url` e `COLE_AQUI_anonKey` pelos dados do seu projeto (Project Settings → API).
3. Publique a pasta na Vercel (passo a passo em `GUIA-VERCEL.txt`) ou abra o `index.html` localmente.

> Sem configurar o Supabase, o app funciona normalmente, mas salva os dados apenas no aparelho.

## 👤 Autor

**Paulo Henrique Marques** · [GitHub](https://github.com/paulo-marques-dev)
