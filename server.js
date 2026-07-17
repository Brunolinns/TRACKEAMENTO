// Webhook Hotmart -> Meta Conversions API (Purchase)
// Método Cidinha Lins — só dispara em PURCHASE_APPROVED (cartão, Pix ou boleto, quando aprova)

const express = require("express");
const crypto = require("crypto");

const app = express();
// Aceita JSON e form-encoded (a Hotmart pode mandar de qualquer um dependendo da versão)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PIXEL_ID = process.env.PIXEL_ID;                 // 767998115401803
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; // token da API de Conversões
const HOTTOK = process.env.HOTTOK;                     // token do webhook da Hotmart
const TEST_EVENT_CODE = process.env.TEST_EVENT_CODE;   // opcional: só durante testes (aba Eventos de teste)
const API_VERSION = "v25.0";                           // versão atual da Graph API (fev/2026)

const sha256 = (v) =>
  v ? crypto.createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex") : undefined;

// Healthcheck — Render usa pra manter vivo e você testa abrindo no navegador
app.get("/", (_req, res) => res.send("hotmart-capi ok"));

app.post("/webhook/hotmart", async (req, res) => {
  try {
    const body = req.body || {};

    // LOG do payload cru — ESSENCIAL no 1º evento real pra conferir os nomes dos campos
    console.log("== Webhook recebido ==", JSON.stringify(body));

    // 1. Valida origem: hottok pode vir no header OU no corpo, dependendo da config
    const receivedHottok = req.headers["x-hotmart-hottok"] || body.hottok;
    if (HOTTOK && receivedHottok !== HOTTOK) {
      console.warn("hottok inválido:", receivedHottok);
      return res.status(401).send("hottok inválido");
    }

    // 2. Só compra APROVADA vira Purchase
    if (body.event !== "PURCHASE_APPROVED") {
      return res.status(200).send("evento ignorado: " + body.event);
    }

    const purchase = body.data?.purchase || {};
    const buyer = body.data?.buyer || {};

    const transactionId = purchase.transaction;
    const value = purchase.price?.value ?? 397.0;
    const currency = purchase.price?.currency_value || purchase.price?.currency || "BRL";

    // 3. Monta o evento (dados hasheados, dedup por transação)
    const event = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: transactionId,          // dedup: reenvio da Hotmart não duplica no Meta
      action_source: "website",
      event_source_url: "https://metodo.cidinhalins.com",
      user_data: {
        em: [sha256(buyer.email)].filter(Boolean),
        ph: [sha256((buyer.checkout_phone || buyer.phone || "").replace(/\D/g, ""))].filter(Boolean),
        fn: [sha256((buyer.name || "").split(" ")[0])].filter(Boolean),
      },
      custom_data: {
        value: Number(value),
        currency: currency,
        content_name: "Método Cidinha Lins",
      },
    };

    // 4. Envia pra API de Conversões
    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        TEST_EVENT_CODE ? { data: [event], test_event_code: TEST_EVENT_CODE } : { data: [event] }
      ),
    });

    const result = await resp.json();
    console.log("Meta CAPI:", JSON.stringify(result), "| transação:", transactionId);

    if (!resp.ok) return res.status(500).json(result);
    return res.status(200).json({ ok: true, transaction: transactionId, meta: result });
  } catch (err) {
    console.error("Erro no webhook:", err);
    return res.status(500).send("erro interno");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("hotmart-capi rodando na porta " + PORT));
