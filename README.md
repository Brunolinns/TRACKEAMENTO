# Hotmart → Meta CAPI (Purchase) — Método Cidinha Lins

Dispara o evento **Purchase** no Meta somente quando a Hotmart confirma
**compra aprovada** (cartão, Pix ou boleto). Server-side, com deduplicação
por transação.

**Por que existe:** a integração nativa "Vendas realizadas" da Hotmart não
entrega o Purchase ao pixel (comprovado: 0 eventos em 14 dias com config
correta). Este serviço substitui esse caminho.

---

## Arquivos

| Arquivo | Função |
|---|---|
| `server.js` | Recebe o webhook da Hotmart e envia o Purchase pra CAPI |
| `package.json` | Dependências (Express) e Node 18+ |
| `.gitignore` | Ignora node_modules e .env |

---

## Passo a passo de implantação

### 1. Subir o repositório
1. GitHub → **New repository** → nome: `hotmart-capi-cidinha` → Private → Create.
2. **Add file → Upload files** → suba `server.js`, `package.json` e `.gitignore` → Commit.

### 2. Criar o Web Service no Render (plano FREE)
1. Render → **New → Web Service** → conecta no repo `hotmart-capi-cidinha`.
2. Configurações:
   - Instance type: **Free**
   - Build command: `npm install`
   - Start command: `npm start`
3. **Create Web Service** e espera o deploy ficar "Live".
4. Anota a URL gerada (ex.: `https://hotmart-capi-cidinha.onrender.com`).
5. Teste: abre a URL no navegador → deve aparecer `hotmart-capi ok`.

### 3. Gerar o token da API de Conversões (Meta)
1. Gerenciador de Eventos → seleciona o **[PIXEL CL]** (767998115401803).
2. Aba **Configurações** → seção **API de Conversões** → **Gerar token de acesso**.
3. Copia o token (string longa). Guarda — só aparece uma vez.

### 4. Pegar o código de teste (Meta)
1. No mesmo pixel → aba **Eventos de teste**.
2. Copia o código que aparece (formato `TEST12345`).

### 5. Variáveis de ambiente no Render
Render → seu serviço → **Environment** → adicionar:

| Key | Value |
|---|---|
| `PIXEL_ID` | `767998115401803` |
| `META_ACCESS_TOKEN` | (token do passo 3) |
| `TEST_EVENT_CODE` | (código do passo 4 — **só durante os testes**) |
| `HOTTOK` | (vem no passo 6 — deixa pra depois) |

Salvar → o serviço redeploya sozinho.

### 6. Cadastrar o webhook na Hotmart
1. Hotmart → produto **Método Cidinha Lins** → **Ferramentas → Webhook (Postback)**.
2. **Cadastrar webhook**:
   - URL: `https://SEU-SERVICO.onrender.com/webhook/hotmart`
   - Versão: **2.0.0** (a mais recente)
   - Evento: **Compra aprovada** (só esse)
3. A Hotmart mostra o **hottok** (token de segurança) → copia.
4. Volta no Render → Environment → preenche `HOTTOK` com esse valor → salva.

### 7. Testar (sem sujar a produção)
1. Na tela do webhook da Hotmart, clica em **Testar/Enviar teste** no evento
   Compra aprovada.
2. Render → **Logs**: deve aparecer `== Webhook recebido ==` com o payload,
   e depois `Meta CAPI: {"events_received":1...}`.
3. Gerenciador de Eventos → **Eventos de teste**: deve aparecer 1 **Purchase**
   vindo de "Servidor". (Graças ao `TEST_EVENT_CODE`, esse teste NÃO conta
   como venda real no pixel.)
4. Se algo falhar, o log do Render mostra o motivo (hottok inválido, token
   errado, campo faltando).

### 8. Ir pra produção
1. Render → Environment → **remove** a variável `TEST_EVENT_CODE` → salva.
2. Pronto: a próxima venda aprovada real dispara o Purchase de verdade.

### 9. Keep-alive (evitar o "sono" do plano Free)
1. Cria conta gratuita no **UptimeRobot** (ou cron-job.org).
2. Novo monitor HTTP(s) → URL: a raiz do serviço
   (`https://SEU-SERVICO.onrender.com/`) → intervalo: **10 minutos**.
3. Isso mantém o serviço acordado. (Mesmo se dormir, a Hotmart reenvia o
   webhook em caso de falha — não se perde venda, só atrasa minutos.)

### 10. Desligar a integração nativa (SÓ depois da 1ª venda real confirmada)
1. Espera a **primeira venda real** aparecer no Gerenciador de Eventos como
   Purchase via "Servidor".
2. Aí sim: Hotmart → Ferramentas → Pixel de Rastreamento → Facebook+Instagram
   → Detalhes da configuração → **desmarca "Vendas realizadas"** (deixa o
   resto como está).
3. Motivo: se a integração nativa um dia "acordar", contaria a venda 2x.

---

## Checklist final

- [ ] Serviço "Live" no Render e respondendo `hotmart-capi ok`
- [ ] 4 variáveis de ambiente configuradas
- [ ] Webhook cadastrado na Hotmart (Compra aprovada, v2.0.0)
- [ ] Teste apareceu em Eventos de teste como Purchase (Servidor)
- [ ] `TEST_EVENT_CODE` removida após o teste
- [ ] Keep-alive pingando a cada 10 min
- [ ] "Vendas realizadas" desmarcado APÓS 1ª venda real confirmada

## Se der problema

- **Log mostra "hottok inválido"** → o valor no Render não bate com o da
  Hotmart. Recopia.
- **Log mostra erro do Meta (código 190)** → token da CAPI errado/expirado.
  Gera outro no passo 3.
- **Nada aparece no log** → URL do webhook errada na Hotmart (confere o
  `/webhook/hotmart` no final) ou serviço dormindo (espera ~1 min, a
  Hotmart reenvia).
- **Payload com campos diferentes** → o log `== Webhook recebido ==` mostra
  o JSON cru. Manda esse log pro Claude ajustar o mapeamento.

## Fase 2 (depois, opcional)

- Capturar `_fbp`/`_fbc` no checkout pra melhorar a qualidade de
  correspondência (EMQ) e a atribuição por campanha.
- Tratar eventos de reembolso/chargeback.
