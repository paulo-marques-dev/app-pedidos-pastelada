// ============================================================
//  CONFIGURAÇÃO
// ============================================================

// Valor de cada pastel, em reais. Altere aqui se o preço mudar.
const PRECO_PASTEL = 10;

// ============================================================
//  CAMADA DE DADOS  (Supabase em tempo real OU navegador local)
// ============================================================

const cfg = window.supabaseConfig || {};
const usaSupabase =
  typeof cfg.url === "string" && typeof cfg.anonKey === "string" &&
  !cfg.url.startsWith("COLE_AQUI") && !cfg.anonKey.startsWith("COLE_AQUI");

let store;

// ---------- Backend: Supabase (tempo real via websockets) ----------
function criarStoreSupabase() {
  const client = window.supabase.createClient(cfg.url, cfg.anonKey);

  const mapSabor = r => ({ id: r.id, nome: r.nome, createdAt: r.created_at });
  const mapPedido = r => ({
    id: r.id, cliente: r.cliente, itens: r.itens || [],
    status: r.status || "pendente", createdAt: r.created_at
  });

  return {
    modo: "supabase",

    onSabores(cb) {
      const carregar = async () => {
        const { data, error } = await client
          .from("sabores").select("*").order("nome");
        if (!error && data) cb(data.map(mapSabor));
        else if (error) console.error(error);
      };
      carregar();
      client
        .channel("rt-sabores")
        .on("postgres_changes",
          { event: "*", schema: "public", table: "sabores" }, carregar)
        .subscribe();
    },

    onPedidos(cb) {
      const carregar = async () => {
        const { data, error } = await client
          .from("pedidos").select("*").order("created_at", { ascending: false });
        if (!error && data) { setConn(true); cb(data.map(mapPedido)); }
        else if (error) { setConn(false); console.error(error); }
      };
      carregar();
      client
        .channel("rt-pedidos")
        .on("postgres_changes",
          { event: "*", schema: "public", table: "pedidos" }, carregar)
        .subscribe(status => {
          if (status === "SUBSCRIBED") setConn(true);
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConn(false);
        });
    },

    async addSabor(nome) {
      const { error } = await client.from("sabores").insert({ nome });
      if (error) throw error;
    },
    async removeSabor(id) {
      const { error } = await client.from("sabores").delete().eq("id", id);
      if (error) throw error;
    },
    async addPedido(cliente, itens) {
      const { error } = await client.from("pedidos").insert({ cliente, itens });
      if (error) throw error;
    },
    async removePedido(id) {
      const { error } = await client.from("pedidos").delete().eq("id", id);
      if (error) throw error;
    },
    async atualizarStatus(id, status) {
      const { error } = await client.from("pedidos").update({ status }).eq("id", id);
      if (error) throw error;
    }
  };
}

// ---------- Backend: navegador local (um dispositivo) ----------
function criarStoreLocal() {
  const KEY_S = "pastelada_sabores";
  const KEY_P = "pastelada_pedidos";
  let subsSabores = [];
  let subsPedidos = [];

  const ler = k => JSON.parse(localStorage.getItem(k) || "[]");
  const grav = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const notifS = () => { const d = ler(KEY_S); subsSabores.forEach(cb => cb(d)); };
  const notifP = () => {
    const d = ler(KEY_P).sort((a, b) => b.createdAt - a.createdAt);
    subsPedidos.forEach(cb => cb(d));
  };

  // sincroniza entre abas do mesmo navegador
  window.addEventListener("storage", e => {
    if (e.key === KEY_S) notifS();
    if (e.key === KEY_P) notifP();
  });

  return {
    modo: "local",
    onSabores(cb) {
      subsSabores.push(cb);
      cb(ler(KEY_S).sort((a, b) => a.nome.localeCompare(b.nome)));
    },
    onPedidos(cb) {
      subsPedidos.push(cb);
      notifP();
    },
    addSabor(nome) {
      const d = ler(KEY_S);
      d.push({ id: uid(), nome, createdAt: Date.now() });
      d.sort((a, b) => a.nome.localeCompare(b.nome));
      grav(KEY_S, d); notifS();
    },
    removeSabor(id) {
      grav(KEY_S, ler(KEY_S).filter(s => s.id !== id)); notifS();
    },
    addPedido(cliente, itens) {
      const d = ler(KEY_P);
      d.push({ id: uid(), cliente, itens, status: "pendente", createdAt: Date.now() });
      grav(KEY_P, d); notifP();
    },
    removePedido(id) {
      grav(KEY_P, ler(KEY_P).filter(p => p.id !== id)); notifP();
    },
    atualizarStatus(id, status) {
      const d = ler(KEY_P);
      const p = d.find(x => x.id === id);
      if (p) { p.status = status; grav(KEY_P, d); notifP(); }
    }
  };
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ============================================================
//  ESTADO E ELEMENTOS
// ============================================================

let sabores = [];
let pedidos = [];
let filtroPedidos = "";
let filtroStatus = "todos"; // todos | pendente | concluido

const el = id => document.getElementById(id);

// texto sem acento e em minúsculas, para busca
function normaliza(s) {
  return (s || "").toString().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ============================================================
//  NAVEGAÇÃO ENTRE ABAS
// ============================================================

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const alvo = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach(b =>
      b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab-panel").forEach(p =>
      p.classList.toggle("active", p.id === "tab-" + alvo));
  });
});

// ============================================================
//  STATUS DE CONEXÃO
// ============================================================

function setConn(online, textoCustom) {
  const dot = el("connDot");
  const txt = el("connText");
  if (store && store.modo === "local") {
    dot.className = "dot";
    txt.textContent = "Somente este aparelho";
    return;
  }
  dot.className = "dot " + (online ? "online" : "offline");
  txt.textContent = textoCustom || (online ? "Sincronizado" : "Sem conexão");
}

// ============================================================
//  ABA: NOVO PEDIDO
// ============================================================

function novaLinhaItem() {
  const row = document.createElement("div");
  row.className = "item-row";

  const sel = document.createElement("select");
  sabores.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.nome;
    opt.textContent = s.nome;
    sel.appendChild(opt);
  });

  const qtd = document.createElement("input");
  qtd.type = "number";
  qtd.min = "1";
  qtd.value = "1";

  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "btn-remove-item";
  rm.textContent = "✕";
  rm.addEventListener("click", () => row.remove());

  row.append(sel, qtd, rm);
  el("itens-pedido").appendChild(row);
}

el("btn-add-item").addEventListener("click", () => {
  if (sabores.length === 0) return;
  novaLinhaItem();
});

el("form-pedido").addEventListener("submit", async e => {
  e.preventDefault();
  const cliente = el("input-cliente").value.trim();
  if (!cliente) return;

  const itens = [];
  el("itens-pedido").querySelectorAll(".item-row").forEach(row => {
    const sabor = row.querySelector("select").value;
    const q = parseInt(row.querySelector("input").value, 10);
    if (sabor && q > 0) {
      const existente = itens.find(i => i.sabor === sabor);
      if (existente) existente.qtd += q;
      else itens.push({ sabor, qtd: q });
    }
  });

  if (itens.length === 0) {
    toast("Adicione ao menos um sabor ao pedido.");
    return;
  }

  const btn = el("btn-submit-pedido");
  btn.disabled = true;
  try {
    await store.addPedido(cliente, itens);
    el("form-pedido").reset();
    el("itens-pedido").innerHTML = "";
    novaLinhaItem();
    toast("Pedido de " + cliente + " registrado!");
  } catch (err) {
    toast("Erro ao salvar. Tente de novo.");
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

// ============================================================
//  ABA: SABORES
// ============================================================

el("form-sabor").addEventListener("submit", async e => {
  e.preventDefault();
  const nome = el("input-sabor-nome").value.trim();
  if (!nome) return;
  if (sabores.some(s => s.nome.toLowerCase() === nome.toLowerCase())) {
    toast("Esse sabor já existe.");
    return;
  }
  el("input-sabor-nome").value = "";
  try {
    await store.addSabor(nome);
    toast("Sabor adicionado!");
  } catch (err) {
    toast("Erro ao adicionar sabor.");
    console.error(err);
  }
});

async function excluirSabor(id, nome) {
  if (!confirm('Excluir o sabor "' + nome + '"?')) return;
  try { await store.removeSabor(id); }
  catch (err) { toast("Erro ao excluir."); console.error(err); }
}

// ============================================================
//  ABA: PEDIDOS
// ============================================================

async function excluirPedido(id, cliente) {
  if (!confirm("Excluir o pedido de " + cliente + "?")) return;
  try { await store.removePedido(id); }
  catch (err) { toast("Erro ao excluir."); console.error(err); }
}

async function alternarStatus(p) {
  const novo = (p.status || "pendente") === "concluido" ? "pendente" : "concluido";
  try {
    await store.atualizarStatus(p.id, novo);
    toast(novo === "concluido" ? "Pedido concluído!" : "Pedido reaberto.");
  } catch (err) {
    const msg = String((err && (err.message || err.code)) || err);
    if (/status/i.test(msg) && /(does not exist|42703)/i.test(msg)) {
      toast("Falta ativar o status: rode o SQL no Supabase.");
    } else {
      toast("Erro ao atualizar status.");
    }
    console.error(err);
  }
}

// filtro por status (Todos / Pendentes / Concluídos)
document.querySelectorAll(".chip-status").forEach(chip => {
  chip.addEventListener("click", () => {
    filtroStatus = chip.dataset.status;
    document.querySelectorAll(".chip-status").forEach(c =>
      c.classList.toggle("active", c === chip));
    renderPedidos();
  });
});

// busca de pedidos por nome do cliente
(function () {
  const busca = el("buscaPedido");
  const limpar = el("limparBusca");
  if (!busca) return;
  busca.addEventListener("input", () => {
    filtroPedidos = busca.value;
    if (limpar) limpar.hidden = filtroPedidos.length === 0;
    renderPedidos();
  });
  if (limpar) {
    limpar.addEventListener("click", () => {
      busca.value = "";
      filtroPedidos = "";
      limpar.hidden = true;
      renderPedidos();
      busca.focus();
    });
  }
})();

// ============================================================
//  RENDERIZAÇÃO
// ============================================================

function renderSabores() {
  const ul = el("lista-sabores");
  ul.innerHTML = "";
  el("saboresVazio").hidden = sabores.length > 0;

  sabores.forEach(s => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = s.nome;
    const btn = document.createElement("button");
    btn.className = "btn-excluir-sabor";
    btn.textContent = "🗑";
    btn.addEventListener("click", () => excluirSabor(s.id, s.nome));
    li.append(span, btn);
    ul.appendChild(li);
  });

  // atualiza aviso e primeira linha da aba de pedido
  el("avisoSemSabor").hidden = sabores.length > 0;
  const itensBox = el("itens-pedido");
  if (sabores.length > 0 && itensBox.children.length === 0) {
    novaLinhaItem();
  }
  if (sabores.length === 0) {
    itensBox.innerHTML = "";
  }
  el("btn-add-item").disabled = sabores.length === 0;
  el("btn-submit-pedido").disabled = sabores.length === 0;
}

function formatHora(createdAt) {
  let d;
  if (!createdAt) return "";
  if (typeof createdAt === "number") d = new Date(createdAt);
  else if (typeof createdAt === "string") d = new Date(createdAt);
  else if (createdAt.toDate) d = createdAt.toDate();
  else return "";
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function totalDoPedido(p) {
  return p.itens.reduce((acc, i) => acc + i.qtd, 0);
}

function valorDoPedido(p) {
  return totalDoPedido(p) * PRECO_PASTEL;
}

function formatBRL(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function textoPasteis(n) {
  return n === 1 ? "1 pastel" : n + " pastéis";
}

function statusDo(p) {
  return (p.status || "pendente") === "concluido" ? "concluido" : "pendente";
}

function renderPedidos() {
  const box = el("listaPedidos");
  box.innerHTML = "";

  // contadores por status (sempre sobre TODOS os pedidos)
  const nPend = pedidos.filter(p => statusDo(p) === "pendente").length;
  const nConc = pedidos.filter(p => statusDo(p) === "concluido").length;
  if (el("cntTodos")) el("cntTodos").textContent = pedidos.length;
  if (el("cntPendente")) el("cntPendente").textContent = nPend;
  if (el("cntConcluido")) el("cntConcluido").textContent = nConc;

  // aplica filtro de status e de busca
  const termo = normaliza(filtroPedidos);
  const lista = pedidos.filter(p =>
    (filtroStatus === "todos" || statusDo(p) === filtroStatus) &&
    (!termo || normaliza(p.cliente).includes(termo))
  );

  el("pedidosVazio").hidden = pedidos.length > 0;
  el("pedidosSemResultado").hidden = !(pedidos.length > 0 && lista.length === 0);

  lista.forEach(p => {
    const st = statusDo(p);
    const card = document.createElement("div");
    card.className = "pedido-card" + (st === "concluido" ? " concluido" : "");

    const header = document.createElement("div");
    header.className = "pedido-header";

    const cli = document.createElement("div");
    cli.className = "pedido-cliente";
    const nome = document.createElement("strong");
    nome.textContent = p.cliente;
    const badge = document.createElement("span");
    badge.className = "badge-status " + st;
    badge.textContent = st === "concluido" ? "✓ Concluído" : "Pendente";
    cli.append(nome, badge);

    const hora = document.createElement("span");
    hora.className = "pedido-time";
    hora.textContent = formatHora(p.createdAt);
    header.append(cli, hora);

    const ul = document.createElement("ul");
    ul.className = "pedido-itens";
    p.itens.forEach(i => {
      const li = document.createElement("li");
      li.textContent = i.qtd + "× " + i.sabor;
      ul.appendChild(li);
    });

    const footer = document.createElement("div");
    footer.className = "pedido-footer";
    const tot = document.createElement("span");
    tot.className = "pedido-total-itens";
    tot.textContent = textoPasteis(totalDoPedido(p)) + " · " + formatBRL(valorDoPedido(p));

    const acoes = document.createElement("div");
    acoes.className = "pedido-acoes";
    const btnStatus = document.createElement("button");
    btnStatus.className = "btn-status" + (st === "concluido" ? " reabrir" : "");
    btnStatus.textContent = st === "concluido" ? "↺ Reabrir" : "✓ Concluir";
    btnStatus.addEventListener("click", () => alternarStatus(p));
    const btnExcluir = document.createElement("button");
    btnExcluir.className = "btn-excluir-pedido";
    btnExcluir.textContent = "Excluir";
    btnExcluir.addEventListener("click", () => excluirPedido(p.id, p.cliente));
    acoes.append(btnStatus, btnExcluir);

    footer.append(tot, acoes);

    card.append(header, ul, footer);
    box.appendChild(card);
  });

  atualizarNumeros();
  renderResumo();
}

function atualizarNumeros() {
  const totalPasteis = pedidos.reduce((acc, p) => acc + totalDoPedido(p), 0);
  const totalReais = totalPasteis * PRECO_PASTEL;
  el("statPedidos").textContent = pedidos.length;
  el("statPasteis").textContent = totalPasteis;
  el("statTotal").textContent = formatBRL(totalReais);
  el("resumoPedidos").textContent = pedidos.length;
  el("resumoPasteis").textContent = totalPasteis;
  el("resumoTotal").textContent = formatBRL(totalReais);
}

function renderResumo() {
  const cont = el("resumoSabores");
  cont.innerHTML = "";

  const porSabor = {};
  pedidos.forEach(p => p.itens.forEach(i => {
    porSabor[i.sabor] = (porSabor[i.sabor] || 0) + i.qtd;
  }));

  const linhas = Object.entries(porSabor).sort((a, b) => b[1] - a[1]);
  el("resumoVazio").hidden = linhas.length > 0;

  const max = linhas.length ? linhas[0][1] : 0;

  linhas.forEach(([sabor, qtd]) => {
    const row = document.createElement("div");
    row.className = "resumo-bar-row";

    const label = document.createElement("div");
    label.className = "resumo-bar-label";
    label.textContent = sabor;

    const track = document.createElement("div");
    track.className = "resumo-bar-track";
    const fill = document.createElement("div");
    fill.className = "resumo-bar-fill";
    fill.style.width = (max ? (qtd / max) * 100 : 0) + "%";
    track.appendChild(fill);

    const val = document.createElement("div");
    val.className = "resumo-bar-value";
    val.textContent = qtd;

    row.append(label, track, val);
    cont.appendChild(row);
  });
}

// ============================================================
//  TOAST
// ============================================================

let toastTimer;
function toast(msg) {
  const t = el("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ============================================================
//  INICIALIZAÇÃO
// ============================================================

function iniciar() {
  if (usaSupabase && window.supabase && window.supabase.createClient) {
    try {
      store = criarStoreSupabase();
    } catch (err) {
      console.error("Falha ao iniciar Supabase, usando modo local:", err);
      store = criarStoreLocal();
    }
  } else {
    store = criarStoreLocal();
  }

  setConn(false);

  store.onSabores(dados => {
    sabores = dados;
    renderSabores();
    renderPedidos();
  });

  store.onPedidos(dados => {
    pedidos = dados;
    renderPedidos();
  });
}

// ============================================================
//  INSTALAR COMO APP (PWA)
// ============================================================

(function () {
  const banner = el("installBanner");
  if (!banner) return;
  const btn = el("btnInstall");
  const fechar = el("btnInstallClose");
  const texto = el("installText");

  let deferredPrompt = null;
  const ua = navigator.userAgent || "";
  const jaInstalado =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isMobile = isIOS || isAndroid ||
    window.matchMedia("(pointer: coarse)").matches;
  // navegadores internos (WhatsApp/Instagram/etc.) NÃO instalam PWA
  const inApp = /(FBAN|FBAV|Instagram|Line|Twitter|WhatsApp|WeChat|MicroMessenger|GSA|Snapchat)/i.test(ua);

  function mostrar(msg, comBotao) {
    texto.textContent = msg;
    btn.hidden = !comBotao;
    banner.hidden = false;
  }

  const MSG_MENU = "📲 Toque no menu ⋮ do Chrome e escolha “Instalar aplicativo”.";
  const MSG_IOS  = "📲 Para instalar: toque em Compartilhar e “Adicionar à Tela de Início”.";
  const MSG_INAPP = "📲 Para instalar, abra no Chrome: toque em ⋮ e “Abrir no navegador”.";

  // Estado inicial do banner conforme o ambiente
  if (jaInstalado) {
    banner.hidden = true;
  } else if (inApp) {
    mostrar(MSG_INAPP, false);
  } else if (isIOS) {
    mostrar(MSG_IOS, false);
  } else if (isMobile) {
    mostrar("📲 Instalar como aplicativo", true);
  }

  // Android/Chrome: quando o atalho nativo fica disponível
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    if (!jaInstalado && !inApp && !isIOS) mostrar("📲 Instalar como aplicativo", true);
  });

  btn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.hidden = true;
    } else {
      // Atalho nativo ainda não liberado: ensina pelo menu do navegador
      mostrar(MSG_MENU, false);
    }
  });

  fechar.addEventListener("click", () => { banner.hidden = true; });
  window.addEventListener("appinstalled", () => { banner.hidden = true; });
})();

iniciar();
