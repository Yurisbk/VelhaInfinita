# 🚀 Guia de Deploy em Produção

Três opções cobertas aqui, da mais simples à mais controlada:

| Opção | Quando usar | Custo |
|---|---|---|
| [Railway](#opção-1-railway-mais-fácil) | Quer subir em minutos | Gratuito (trial) / ~$5/mês |
| [Render](#opção-2-render) | Alternativa gratuita ao Railway | Gratuito com limitações |
| [VPS + Nginx + PM2](#opção-3-vps-ubuntu--nginx--pm2-controle-total) | Controle total, domínio próprio | ~$6/mês (DigitalOcean/Hetzner) |

---

## Pré-requisitos comuns a todas as opções

### 1. MongoDB Atlas (banco em nuvem gratuito)

1. Acesse https://cloud.mongodb.com → crie uma conta gratuita
2. Crie um **Cluster** (tier M0 = gratuito)
3. Em **Database Access** → crie um usuário com senha forte
4. Em **Network Access** → adicione `0.0.0.0/0` (permite acesso de qualquer IP)
5. Clique em **Connect** → **Drivers** → copie a string de conexão:
   ```
   mongodb+srv://usuario:SENHA@cluster0.xxxx.mongodb.net/tictactoe-infinite
   ```
6. Guarde essa string — será o valor de `MONGO_URI`

### 2. Google OAuth (credenciais de produção)

1. Acesse https://console.cloud.google.com
2. Crie um projeto (ou use um existente)
3. APIs e Serviços → **Credenciais** → Criar credenciais → **ID de cliente OAuth**
4. Tipo: **Aplicativo da Web**
5. Em **URIs de redirecionamento autorizados** adicione:
   ```
   https://SEU-DOMINIO.com/api/auth/google/callback
   ```
6. Copie o **Client ID** e o **Client Secret**

---

## Opção 1: Railway (mais fácil)

O Railway detecta automaticamente Node.js e configura tudo.

### Passo a passo

```bash
# 1. Instale a CLI do Railway
npm install -g @railway/cli

# 2. Faça login
railway login

# 3. Na raiz do projeto, crie e vincule um projeto
railway init
```

### Deploy do servidor

```bash
cd server

# Crie um novo serviço
railway up --service server
```

Vá no painel do Railway (https://railway.app) → seu projeto → serviço `server`:

**Variables** → adicione todas essas:

```
MONGO_URI=mongodb+srv://usuario:senha@cluster0.xxx.mongodb.net/tictactoe-infinite
JWT_SECRET=uma_string_longa_e_aleatoria_aqui_use_openssl_rand_hex_32
GOOGLE_CLIENT_ID=seu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu_client_secret
ADMIN_PASSWORD=sua_senha_de_admin_forte
NODE_ENV=production
PORT=3001
```

**Settings** → em **Start Command** coloque:
```
node dist/index.js
```

**Settings** → em **Build Command** coloque:
```
npm install && npm run build
```

### Deploy do cliente (frontend)

O cliente é estático após o build. Use o Railway Static Site ou o **Vercel** (mais simples para frontend):

```bash
# Instale a CLI do Vercel
npm install -g vercel

cd client

# Build local
npm run build

# Deploy (siga as instruções interativas)
vercel --prod
```

No painel do Vercel, adicione a variável de ambiente:
```
VITE_API_URL=https://seu-server.railway.app
```

E no `client/vite.config.ts`, ajuste o proxy para apontar para a URL de produção do server (ou configure CORS no server).

---

## Opção 2: Render

### Servidor no Render

1. Acesse https://render.com → **New** → **Web Service**
2. Conecte seu repositório GitHub
3. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/index.js`
   - **Environment**: Node
4. Adicione as variáveis de ambiente (mesmas da seção Railway acima)
5. Clique em **Deploy**

### Frontend no Render (Static Site)

1. **New** → **Static Site**
2. Conecte o mesmo repositório
3. Configure:
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Adicione redirecionamentos para SPA (React Router):
   - Em **Redirects/Rewrites**: `/* → /index.html` (status 200)

---

## Opção 3: VPS Ubuntu + Nginx + PM2 (controle total)

### Preparar o servidor (Ubuntu 22.04)

```bash
# Conecte no seu VPS
ssh root@IP_DO_SEU_SERVIDOR

# Instalar Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 (gerenciador de processos)
npm install -g pm2

# Instalar Nginx
sudo apt install -y nginx

# Instalar Certbot (SSL grátis)
sudo apt install -y certbot python3-certbot-nginx
```

### Fazer upload do projeto

```bash
# No seu computador local — faça o build primeiro
cd /caminho/para/TicTacToeInfinite
npm run build                    # client e server

# Copie para o servidor via rsync
rsync -av --exclude='node_modules' --exclude='.env' \
  ./ root@IP_DO_SERVIDOR:/var/www/tictactoe/
```

### Configurar variáveis de ambiente no servidor

```bash
# No servidor
nano /var/www/tictactoe/server/.env
```

Adicione todas as variáveis (MONGO_URI, JWT_SECRET, GOOGLE_CLIENT_ID, etc.) com os valores de produção.

### Iniciar o servidor com PM2

```bash
cd /var/www/tictactoe/server
npm install --production

pm2 start dist/index.js --name tictactoe-server
pm2 startup   # configura inicialização automática após reboot
pm2 save
```

### Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/tictactoe
```

Cole:

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO.com www.SEU_DOMINIO.com;

    # Frontend estático
    root /var/www/tictactoe/client/dist;
    index index.html;

    # React Router — redireciona tudo para index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para o servidor Node.js
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket (Socket.io)
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Métricas Prometheus (proteja com senha ou restrinja por IP)
    location /metrics {
        proxy_pass http://localhost:3001;
        # Restringe acesso apenas ao IP do seu servidor de monitoramento
        # allow 1.2.3.4;
        # deny all;
    }
}
```

```bash
# Ativa o site
sudo ln -s /etc/nginx/sites-available/tictactoe /etc/nginx/sites-enabled/
sudo nginx -t          # verifica a configuração
sudo systemctl reload nginx
```

### Configurar SSL gratuito (HTTPS)

```bash
sudo certbot --nginx -d SEU_DOMINIO.com -d www.SEU_DOMINIO.com
```

O Certbot configura o HTTPS automaticamente e renova o certificado a cada 90 dias.

### Verificar se tudo está funcionando

```bash
pm2 status            # servidor Node.js rodando
pm2 logs              # ver logs em tempo real
curl https://SEU_DOMINIO.com/api/health   # deve retornar {"status":"ok"}
```

---

## Atualizar depois do deploy (VPS)

```bash
# No seu computador local
npm run build

rsync -av --exclude='node_modules' --exclude='.env' \
  ./ root@IP_DO_SERVIDOR:/var/www/tictactoe/

# No servidor
ssh root@IP_DO_SERVIDOR
cd /var/www/tictactoe/server
npm install --production
pm2 restart tictactoe-server
```

---

## Variáveis de ambiente de produção (resumo)

| Variável | Exemplo | Obrigatória |
|---|---|---|
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/db` | Sim |
| `JWT_SECRET` | string aleatória de 64+ chars | Sim |
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | Não (desativa login Google) |
| `GOOGLE_CLIENT_SECRET` | string do Google Console | Não |
| `GOOGLE_CALLBACK_URL` | `https://dominio.com/api/auth/google/callback` | Não |
| `ADMIN_PASSWORD` | senha forte para `/admin` | Sim |
| `FRONTEND_URL` | `https://dominio.com` | Sim |
| `PORT` | `3001` | Sim |
| `NODE_ENV` | `production` | Sim |

### Gerar um JWT_SECRET seguro

```bash
# No terminal (Linux/Mac/WSL):
openssl rand -hex 64

# Resultado (exemplo):
# a3f8b2c1d4e5...
```

---

## Checklist final antes de ir ao ar

- [ ] `MONGO_URI` apontando para MongoDB Atlas (não localhost)
- [ ] `JWT_SECRET` com pelo menos 64 caracteres aleatórios
- [ ] `NODE_ENV=production`
- [ ] `FRONTEND_URL` com o domínio real (sem barra no final)
- [ ] `ADMIN_PASSWORD` diferente de `admin123`
- [ ] SSL (HTTPS) configurado
- [ ] No Google Console: URI de callback atualizado para o domínio de produção
- [ ] Firewall: portas 80 e 443 abertas; porta 3001 **fechada** para acesso externo (só o Nginx acessa)
- [ ] `robots.txt` e `sitemap.xml` com a URL real (editar `client/public/`)
- [ ] `index.html`: atualizar `https://tictactoe-infinite.app/` para o domínio real
