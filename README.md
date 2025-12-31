<div align="center">
  <h1>🚀 Starion Digital</h1>
  <p><strong>Modern E-commerce Platform for Souvenirs</strong></p>
  
  ![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)
  ![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)
  ![Prisma](https://img.shields.io/badge/Prisma-6.19-2d3748?style=for-the-badge&logo=prisma)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql)
  ![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=for-the-badge&logo=tailwind-css)
</div>

---

## 📋 Overview

**Starion Digital** is a full-featured e-commerce platform with an administrative panel for managing catalogs, orders, and partners. Built on a modern tech stack with a focus on performance, UX, and scalability.

### 🎯 Key Features

- 🛒 **Online Store** with magnets and license plates catalog
- 🌍 **Multilingual** (EN, RO, RU) via next-intl
- 👨‍💼 **Admin Dashboard** with detailed analytics
- 📊 **Order Management System** and partner management
- 💰 **Flexible Pricing System** by product groups
- 🎨 **Modern UI** with dark/light theme
- 📱 **Responsive Design** for all devices
- 🔐 **Authentication & Role-Based Access**
- 📦 **Dropbox Integration** for image storage
- 🤖 **Telegram Notifications** for new orders
- 📈 **Data Export** to Excel

---

## 🛠️ Tech Stack

### Frontend

- **[Next.js 15](https://nextjs.org)** — React framework with App Router
- **[React 19](https://react.dev)** — UI library
- **[TypeScript 5](https://www.typescriptlang.org)** — Typed JavaScript
- **[Tailwind CSS 4](https://tailwindcss.com)** — Utility-first CSS framework
- **[Framer Motion](https://www.framer.com/motion/)** — Animations
- **[Three.js](https://threejs.org)** + **React Three Fiber** — 3D graphics
- **[Radix UI](https://www.radix-ui.com)** — Headless UI components
- **[Lucide React](https://lucide.dev)** — Modern icons
- **[Zustand](https://github.com/pmndrs/zustand)** — State management

### Backend & Database

- **[Prisma ORM](https://www.prisma.io)** — Type-safe ORM
- **[PostgreSQL](https://www.postgresql.org)** — Relational database
- **[Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)** — Server-side API

### Integrations

- **[Dropbox SDK](https://www.dropbox.com/developers)** — Cloud image storage
- **[Telegram Bot API](https://core.telegram.org/bots/api)** — Notifications
- **[ExcelJS](https://github.com/exceljs/exceljs)** — Excel report generation

### UI/UX

- **[next-themes](https://github.com/pacocoursey/next-themes)** — Theme management
- **[Sonner](https://sonner.emilkowal.ski/)** — Modern toast notifications
- **[Recharts](https://recharts.org/)** — Charts and graphs
- **[Vanta.js](https://www.vantajs.com/)** — Animated backgrounds

---

## 📁 Project Structure

```
starion-digital/
├── app/                      # Next.js App Router
│   ├── admin/               # Admin dashboard
│   │   └── sections/        # Admin sections
│   ├── api/                 # API routes
│   │   ├── order/          # Order creation
│   │   ├── login/          # Authentication
│   │   ├── partner/        # Partner management
│   │   └── admin/          # Admin API
│   ├── contacts/           # Contacts page
│   ├── magnets/            # Magnets catalog
│   ├── plates/             # License plates catalog
│   ├── partnership/        # Partnership page
│   └── my-orders/          # User orders
├── components/              # React components
│   ├── shared/             # Shared components
│   └── ui/                 # UI kit (Radix + Tailwind)
├── lib/                     # Utilities and helpers
│   ├── admin/              # Admin utilities
│   ├── export/             # Data export
│   └── telegram/           # Telegram integration
├── prisma/                  # Prisma ORM
│   ├── schema.prisma       # Database schema
│   ├── seed.ts             # Seed data
│   └── migrations/         # Migrations
├── messages/               # i18n translations
│   ├── en.json
│   ├── ro.json
│   └── ru.json
└── store/                  # Zustand stores
```

---

## 🚀 Quick Start

### Requirements

- Node.js 20+
- PostgreSQL 14+
- npm/yarn/pnpm

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/starion-digital.git
cd starion-digital
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/starion"
DROPBOX_ACCESS_TOKEN="your_dropbox_token"
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_chat_id"
```

4. **Run database migrations**

```bash
npx prisma migrate dev
```

5. **Seed with demo data**

```bash
npm run seed:demo
```

6. **Start development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

### Additional Commands

```bash
npm run build        # Production build
npm start           # Start production server
npm run lint        # Lint code
npm run seed        # Seed production data
npx prisma studio   # Open Prisma Studio
```

---

## 📊 Data Model

Core database models:

- **Product** — Products (magnets and plates)
- **ProductGroup** — Product groups with translations
- **Partner** — Partners with roles
- **Order** — Customer orders
- **OrderItem** — Order line items
- **Price** — Flexible pricing system
- **Realization** — Partner sales

<details>
<summary>View ER Diagram</summary>

```
Partner 1----* Order
Partner 1----* Price
Partner 1----* Realization

Product *----1 ProductGroup
Product 1----* OrderItem
Product 1----* RealizationItem
Product 1----* Price

Order 1----* OrderItem

Realization 1----* RealizationItem

ProductGroup 1----* Price
```

</details>

---

## 🎨 UI/UX Features

- ⚡ **Turbopack** for instant hot reload
- 🎭 **Framer Motion** animations on all pages
- 🌓 Dark and light themes
- 📱 Mobile-first approach
- ♿ Accessibility (ARIA)
- 🎨 Custom color scheme
- 🖼️ Lazy loading images
- 🎯 Optimized Web Vitals

---

## 🔐 Security

- ✅ Password hashing (bcrypt)
- ✅ HTTP-only cookies for sessions
- ✅ CORS configuration
- ✅ SQL injection protection via Prisma
- ✅ XSS protection
- ✅ Role-based access control

---

## 📱 Integrations

### Dropbox

All product images are stored in Dropbox with automatic generation of direct links for fast loading.

### Telegram

Automatic Telegram notifications for:

- New orders
- Order status changes
- New partnership requests

---

## 📖 Documentation

- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) — Administrator guide
- [MODULARIZATION.md](MODULARIZATION.md) — Project architecture
- [OPTIMIZATION.md](OPTIMIZATION.md) — Performance optimizations
- [SEEDING_GUIDE.md](SEEDING_GUIDE.md) — Working with seed data
- [DROPBOX_IMAGE_MIGRATION.md](DROPBOX_IMAGE_MIGRATION.md) — Image migration

---

## 🌐 Internationalization

Supported languages:

- 🇬🇧 English
- 🇷🇴 Română
- 🇷🇺 Русский

Translations are managed via `next-intl` with JSON files in `/messages`.

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 📞 Contact

- 🌐 Website: [https://starion-digital.com](https://starion-digital.com)

---

<div align="center">
  <sub>Built with Next.js 15 • React 19 • TypeScript • Prisma • PostgreSQL</sub>
</div>
