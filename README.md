# Survey Builder — visual, bilingual survey platform (PHP + MySQL)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) ![PHP](https://img.shields.io/badge/PHP-7.4%2B-777bb4) ![MySQL](https://img.shields.io/badge/MySQL%20%2F%20MariaDB-supported-00758f)

A self-hosted, bilingual (Spanish / English) survey platform. You design multi-step surveys in a drag-and-drop editor, share them with short links and QR codes, and analyze the results in a built-in dashboard. It runs on any standard **LAMP** hosting: Apache, PHP and MySQL/MariaDB. There is no build step and no Composer or npm dependencies.

> 🇪🇸 [Leer en español](README.es.md)

---

## Table of contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation (5 minutes)](#installation-5-minutes)
  - [Option A — Any Apache hosting (cPanel, shared hosting, VPS)](#option-a--any-apache-hosting-cpanel-shared-hosting-vps)
  - [Option B — Plesk, step by step](#option-b--plesk-step-by-step)
  - [Option C — Local development](#option-c--local-development)
  - [Manual installation (without the installer)](#manual-installation-without-the-installer)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Security notes](#security-notes)
- [License](#license)

---

## Features

**Visual editor**
- Multi-step surveys with configurable welcome and thank-you screens.
- Click or drag components onto the canvas, reorder them by dragging, and move them between steps.
- **Content blocks:** headings, rich text (`**bold**`, `*italics*`, `[links](https://…)`), images, video (YouTube, Vimeo or uploaded MP4), logo strip, divider and spacer.
- **16 question types:**
  - single and multiple choice (min/max selections, "Other" option)
  - **image/logo choice** (single or multiple)
  - dropdown, yes/no
  - rating (stars, hearts or faces), linear scale, NPS, slider
  - ranking, matrix
  - short and long text, email, number, date
- Autosave, undo/redo, desktop and mobile preview, and starter templates.

**Bilingual surveys (ES + EN)**
- A survey can be written in one language or in both.
- Participants get the survey in their browser's language and can switch it with an ES | EN toggle.
- **Translation mode** in the editor:
  - the original text is shown above every field;
  - pending translations are highlighted, with a "Next pending" button;
  - the structure is locked so both versions always match.
- Results from every language are merged into **one report**, with a breakdown by language.
- The starter templates come fully translated.

**Admin panel in Spanish or English**, chosen per user from the top bar or the login screen.

**Themes**
- 10 presets.
- Custom themes with colors, solid/gradient/image background, glass effect, font, corner radius and shadow.
- Automatic palette generation from your main color, with contrast warnings.
- Themes are reusable: editing one updates every survey that uses it.

**Sharing**
- Short links (`https://your-domain/Xk3mP9qa2B`).
- QR codes as high-resolution PNG or vector SVG.
- **Printable A4 poster**: editable texts, theme colors, available in one language or both.
- Iframe embed code.

**Participation control**
- One response per browser (cookie) and optionally one per IP (stored as a hash).
- Opening and closing date/time.
- Maximum number of responses.
- Server-side validation, honeypot and rate limiting.

**Results**
- KPIs: responses, visits, completion rate, median time.
- Daily timeline and one chart per question: winner highlight for logo votes, NPS breakdown, matrix heatmap, ranking positions, searchable free-text answers.
- Date filter, individual responses, CSV export (Excel friendly) and print/PDF view.

---

## Requirements

| | Minimum |
|---|---|
| PHP | 7.4 (8.1+ recommended) with `pdo_mysql`, `mbstring`, `fileinfo`, `json` |
| Database | MySQL 5.7+ or MariaDB 10.2+ |
| Web server | Apache with `.htaccess` enabled (`AllowOverride All`) and `mod_rewrite` |
| HTTPS | Strongly recommended (required for the "one response per browser" cookie inside iframes) |

> **Nginx:** it works, but you need to translate the rules in `.htaccess`, `inc/.htaccess` and `uploads/.htaccess` to your server block. See [How it works](#how-it-works).

---

## Installation (5 minutes)

### Option A — Any Apache hosting (cPanel, shared hosting, VPS)

1. **Get the code.** Download the latest release ZIP, or clone the repository:
   ```bash
   git clone https://github.com/<your-user>/survey-builder.git
   ```
2. **Upload it** to the folder your domain or subdomain points to, for example `public_html/` or `public_html/surveys/`.
3. **Create a MySQL database** and a user with full privileges on it, from your hosting panel. Write down the database name, user and password.
4. **Enable HTTPS** for the domain (Let's Encrypt is free on most panels).
5. **Open the installer** in your browser:
   ```
   https://your-domain.com/install.php
   ```
   Fill in:
   - **Database:** host (usually `localhost`), port `3306`, database name, user and password.
   - **Web address:** the public URL is pre-filled. Leave **Short links** on.
   - **Administrator:** your name, email and password.

   Click **Install**.
6. **Delete `install.php`** from the server. It locks itself once installed, but it's better gone.
7. **Sign in** at `https://your-domain.com/admin/` and create your first survey 🎉

### Option B — Plesk, step by step

1. **Websites & Domains → Add Subdomain** (or use an existing domain). Keep the suggested document root.
2. Open the site's **PHP Settings**:
   - Select **PHP 8.x**.
   - Select **"FPM application served by Apache"**. This is important: with *served by nginx*, `.htaccess` is ignored and short links stop working.
   - Under **Additional directives**, raise the upload limits:
     ```ini
     upload_max_filesize = 64M
     post_max_size = 64M
     ```
3. **SSL/TLS Certificates → Let's Encrypt → Get it free.** The domain must already resolve to the server.
4. **Databases → Add Database:**
   - Link it to the site and create a user.
   - For access control, choose **"Allow local connections only"**.
   - Generate a password and copy it.
5. **File Manager:**
   - Open the site's folder and delete the default `index.html`.
   - **Upload** the ZIP, then use **Extract Files**.
   - Make sure `index.php`, `install.php`, `admin/` and `.htaccess` end up directly in the document root, not in a subfolder.
6. Open `https://your-domain/install.php`, fill in the form and click **Install**.
7. Delete `install.php` in the File Manager and sign in at `/admin/`.

### Option C — Local development

With **XAMPP / MAMP / Laragon**, copy the folder into `htdocs` (or `www`), create an empty database in phpMyAdmin and open `http://localhost/survey-builder/install.php`.

With **PHP's built-in server** (no Apache, so `.htaccess` is ignored):

```bash
php -S localhost:8000
```

Open `http://localhost:8000/install.php` and **turn off "Short links"**, since `mod_rewrite` isn't available. Surveys will then use `s.php?id=…` links.

### Manual installation (without the installer)

1. Import `schema.sql` into an empty database.
2. Copy `config.sample.php` to `config.php` and fill it in:
   - database credentials;
   - `app_url`;
   - a long random `secret`.
3. Create the first administrator:
   ```bash
   php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"
   ```
   ```sql
   INSERT INTO users (name, email, password_hash, lang) VALUES ('Admin', 'you@example.com', '<hash>', 'en');
   ```

---

## Updating

1. Back up the database and the `uploads/` folder.
2. Upload the new files over the old ones, **except `config.php`** (it isn't in the repository anyway) and **`install.php`** (don't upload it again).
3. Open the admin panel once. **Database migrations run automatically.** The applied version is stored in `uploads/.schema-version`.
4. Force-refresh the browser (Ctrl+F5) so it picks up the new CSS and JS. File names carry a version query string, so normally this happens on its own.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Short links (`/Xk3mP9qa2B`) return 404 | `mod_rewrite` / `.htaccess` isn't active. On Plesk, use *FPM served by Apache*. As a fallback, set `'pretty_urls' => false` in `config.php`. |
| Blank page / error 500 | Check the PHP error log. On Plesk: *Websites & Domains → Logs*. Make sure `pdo_mysql`, `mbstring` and `fileinfo` are enabled. |
| "PHP cannot write to … to create config.php" | Give the PHP user write permission on the app folder during installation, or create `config.php` manually. |
| Image upload fails | Raise `upload_max_filesize` and `post_max_size` in PHP, and check that `uploads/` is writable. |
| People can answer twice | The cookie control is per browser. Also enable **One response per IP** in the survey settings, keeping in mind that shared networks share an IP. |
| Wrong times on scheduled surveys | Set `'timezone'` in `config.php` (default `Europe/Madrid`). |

---

## How it works

- **Survey definition:** each survey is stored as a JSON document (`surveys.definition`) with settings, welcome/thank-you screens and steps → blocks.
  - Answers reference **question and option IDs**, not texts. That's why translating or renaming options never breaks the results.
  - Translations live next to each text, in a `tr` object:
    ```json
    { "title": "¿Cuál prefieres?", "tr": { "en": { "title": "Which one do you prefer?" } } }
    ```
- **Rendering:** `assets/js/blocks.js` renders every block. The same code drives the editor canvas and the public survey, so the preview is exact.
- **One response per person:** after submitting, the server sets an HttpOnly cookie `svy_done_<id>` (valid 1 year) and refuses further submissions from that browser with `409`. `localStorage` is used as a secondary hint.
- **Short links:** `.htaccess` rewrites `/XXXXXXXXXX` to `s.php?id=XXXXXXXXXX`.
- **Nginx equivalent of the Apache rules:**
  ```nginx
  location ~ ^/(inc|\.git)/ { deny all; }
  location ~ ^/(config\.php|config\.sample\.php|schema\.sql)$ { deny all; }
  location ^~ /uploads/ { location ~ \.php$ { deny all; } }
  location ~ "^/([A-Za-z0-9]{10})/?$" { try_files $uri /s.php?id=$1&$args; }
  ```

---

## Project structure

```
admin/           Admin panel: login, survey list, editor, themes, results, QR poster, JSON API
assets/css/      app.css (panel) · survey.css (public survey + editor canvas)
assets/js/       i18n.js · blocks.js (shared renderer) · editor.js · survey.js · report.js · themes.js …
inc/             Bootstrap, i18n, migrations, themes, templates, results (not web-accessible)
inc/lang/en.json English dictionary for the admin panel (Spanish source strings are the keys)
uploads/         Uploaded images and videos (PHP execution disabled)
s.php            Public survey page
submit.php       Receives and validates responses
install.php      One-time installer
schema.sql       Database schema
```

**Adding or changing panel texts:** write them in Spanish wrapped in `__('…')` (PHP) or `_t('…')` (JS), then add the English version to `inc/lang/en.json`. Participant-facing texts live in `SV.P` (`assets/js/i18n.js`) and `ptext()` (`inc/i18n.php`).

---

## Security notes

- All database access uses prepared statements (PDO).
- Admin actions are protected by sessions and a CSRF token.
- Uploads are restricted to images/video by MIME type. SVGs with scripts are rejected, and PHP is disabled in `uploads/`.
- IP addresses are only stored as salted SHA-256 hashes.
- CSV exports are protected against formula injection.
- `config.php` and `inc/` are denied by `.htaccess`. Delete `install.php` after installing.

---

## License

Released under the [MIT License](LICENSE) — © 2026 Fourmartech. You are free to use, modify and distribute it, including for commercial purposes, as long as the copyright notice is kept.
