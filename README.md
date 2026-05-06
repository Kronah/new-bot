# WhatsBot Manager

Painel de gerenciamento de bot de WhatsApp — interface frontend estática, sem necessidade de backend ou API.

## Funcionalidades

- **Dashboard** com estatísticas em tempo real simuladas e gráfico de mensagens por hora
- **Status do Bot** com controles de ligar/desligar/reiniciar e geração de QR Code
- **Mensagens Automáticas** com CRUD completo (criar, editar, excluir, buscar)
- **Contatos** com listagem, adição, busca e exportação em CSV
- **Fluxos de Atendimento** com cards visuais e gerenciamento
- **Logs do Sistema** com filtros por tipo e exportação em TXT
- **Configurações** com formulários de ajuste do bot, notificações e horário de funcionamento

## Como hospedar no GitHub Pages (100% gratuito)

### Passo 1 — Criar repositório no GitHub

1. Acesse [github.com](https://github.com) e faça login
2. Clique em **New repository**
3. Nomeie o repositório (ex: `whatsbot-manager`)
4. Marque como **Public**
5. Clique em **Create repository**

### Passo 2 — Enviar os arquivos

Pelo terminal (com Git instalado):

```bash
cd whatsapp-bot-manager
git init
git add .
git commit -m "Initial commit: WhatsBot Manager"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/whatsbot-manager.git
git push -u origin main
```

### Passo 3 — Ativar o GitHub Pages

1. No repositório, vá em **Settings** → **Pages**
2. Em **Source**, selecione **Deploy from a branch**
3. Escolha a branch **main** e pasta **/ (root)**
4. Clique em **Save**

Após alguns minutos, o site estará disponível em:
```
https://SEU_USUARIO.github.io/whatsbot-manager/
```

## Estrutura de arquivos

```
whatsapp-bot-manager/
├── index.html        # Página principal
├── css/
│   └── style.css     # Estilos (tema escuro)
├── js/
│   └── app.js        # Lógica interativa
└── README.md         # Este arquivo
```

## Tecnologias utilizadas

- HTML5, CSS3, JavaScript (Vanilla)
- [Chart.js](https://www.chartjs.org/) — gráficos
- [Font Awesome 6](https://fontawesome.com/) — ícones
- GitHub Pages — hospedagem gratuita
