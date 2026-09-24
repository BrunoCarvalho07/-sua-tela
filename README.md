# 🖥️ Sua Tela

Compartilhamento de tela em tempo real entre navegadores, direto e sem
intermediários — construído com **WebRTC** para o vídeo e **Node.js +
Socket.IO** apenas para a sinalização (o "aperto de mão" inicial entre
os dois lados).

Interface simples, no tema **verde e cinza**, pensada para você
compartilhar sua tela com amigos em segundos: cria uma sala, manda o
nome, e pronto.

---

## ✨ Como funciona

```
┌────────────┐        sinalização (Socket.IO)        ┌────────────┐
│    Host    │ ─────────────────────────────────────▶│  Servidor  │
│ (compart.) │◀───────────────────────────────────── │  Node.js   │
└─────┬──────┘                                        └─────┬──────┘
      │                                                      │
      │            vídeo da tela — direto (WebRTC)           │
      └──────────────────────────────────────────────────────┘
                              ▲
                              │
                        ┌─────┴──────┐
                        │  Viewer(s) │
                        │ (assistem) │
                        └────────────┘
```

O servidor **nunca vê o conteúdo da tela compartilhada** — ele só
ajuda os dois navegadores a se encontrarem. Depois que a conexão
WebRTC é estabelecida, o vídeo trafega **direto entre os
computadores**, criptografado nativamente (DTLS/SRTP).

---

## 📁 Estrutura do projeto

```
screenshare/
├── server.js              # Ponto de entrada: sobe Express + Socket.IO
├── src/
│   ├── roomManager.js      # Estado das salas (quem é host, quem assiste)
│   └── signaling.js        # Eventos de sinalização WebRTC (offer/answer/ICE)
├── public/
│   ├── index.html          # Estrutura da página
│   ├── css/
│   │   └── style.css       # Tema visual (verde + cinza)
│   └── js/
│       ├── webrtc.js       # Lógica específica de WebRTC
│       └── app.js          # Liga a UI ao Socket.IO e ao webrtc.js
├── package.json
└── README.md
```

---

## 🚀 Rodando localmente

Pré-requisito: [Node.js](https://nodejs.org) instalado (versão 18+).

```bash
npm install
npm start
```

Abra **http://localhost:3000** no navegador.

1. Na aba **Compartilhar**, digite um nome de sala e clique em
   *Iniciar compartilhamento*. O navegador vai pedir para você
   escolher a tela/janela a compartilhar.
2. Envie esse nome de sala para o seu amigo.
3. Na aba **Assistir**, ele digita o código e clica em *Entrar na
   sala*.

---

## ☁️ Colocando no ar (deploy gratuito)

Recomendado: **[Render](https://render.com)** — tem free tier,
suporta WebSocket (necessário para o Socket.IO) e dá HTTPS
automático (obrigatório para captura de tela fora de `localhost`).

1. Suba este projeto para um repositório no GitHub.
2. No Render: **New > Web Service** → conecte o repositório.
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Aguarde o deploy — você receberá uma URL pública
   (`https://seu-app.onrender.com`).

> O `server.js` já lê a porta pela variável de ambiente `PORT`
> (`process.env.PORT`), então não precisa mexer em nada — a maioria
> dos hosts Node.js define essa variável automaticamente.

---

## 🔒 Segurança

- O vídeo trafega **peer-to-peer**, criptografado nativamente pelo
  próprio WebRTC — o servidor nunca tem acesso ao conteúdo.
- Salas são isoladas por nome/código: só entra quem tiver o código.
- Em produção, use sempre HTTPS (a maioria dos hosts gratuitos já
  fornece isso automaticamente).

## 🧭 Possíveis próximos passos

- Senha por sala
- Chat de texto durante a sessão
- Indicador de quantos espectadores estão assistindo
- Gravação da sessão no lado do host

---

## 🛠️ Tecnologias

- [Node.js](https://nodejs.org) + [Express](https://expressjs.com)
- [Socket.IO](https://socket.io) — sinalização em tempo real
- [WebRTC](https://webrtc.org) — transmissão de vídeo peer-to-peer
- HTML, CSS e JavaScript puros no front-end (sem build step)
