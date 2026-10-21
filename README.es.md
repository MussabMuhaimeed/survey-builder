# Encuestas — creador visual de encuestas (PHP + MySQL)

Plataforma de encuestas autoalojada y bilingüe (español / inglés). Diseñas encuestas de varios pasos en un editor de arrastrar y soltar, las compartes con enlaces cortos y códigos QR, y analizas los resultados en un panel integrado. Funciona en cualquier hosting **LAMP** estándar: Apache, PHP y MySQL/MariaDB. No necesita compilación ni dependencias de Composer o npm.

> 🇬🇧 [Read in English](README.md)

---

## Funcionalidades

- **Editor visual:**
  - Encuestas de varios pasos, con pantallas de bienvenida y final.
  - Bloques de contenido: títulos, texto con formato, imagen, vídeo, franja de logos, separador y espacio.
  - **16 tipos de pregunta**, entre ellos la elección con **imágenes o logos**, NPS, ranking y matriz.
  - Autoguardado, deshacer/rehacer, vista previa en escritorio y móvil, y plantillas.
- **Encuestas bilingües (ES + EN):**
  - Cada participante ve la encuesta en el idioma de su navegador y puede cambiarlo con el selector ES | EN.
  - **Modo traducción** en el editor: muestra el texto original, marca lo pendiente y bloquea la estructura.
  - Los resultados de ambos idiomas se suman en **un único informe**, con desglose por idioma.
- **Panel en español o inglés**, a elegir por cada usuario.
- **Temas:**
  - 10 predefinidos y temas personalizados reutilizables (colores, fondos, tipografía, efecto cristal…).
  - Generador automático de paleta a partir del color principal.
- **Compartir:**
  - Enlaces cortos.
  - QR en PNG o SVG.
  - **Cartel A4 imprimible**, en un idioma o en los dos.
  - Código iframe.
- **Control de participación:**
  - Una respuesta por navegador (cookie) o por IP.
  - Apertura y cierre por fecha y hora.
  - Límite de respuestas.
- **Resultados:** cifras clave, gráficos por pregunta, filtro de fechas, respuestas individuales, CSV e impresión o PDF.

## Requisitos

- PHP 7.4 o superior (recomendado 8.1+) con `pdo_mysql`, `mbstring`, `fileinfo` y `json`.
- MySQL 5.7+ o MariaDB 10.2+.
- Apache con `.htaccess` (`AllowOverride All`) y `mod_rewrite`.
- HTTPS (recomendado).

## Instalación (5 minutos)

### Cualquier hosting Apache (cPanel, compartido, VPS)

1. Descarga el ZIP de la última versión, o clona el repositorio.
2. Súbelo a la carpeta a la que apunta tu dominio o subdominio.
3. Crea una **base de datos MySQL** y un usuario con todos los permisos sobre ella.
4. Activa **HTTPS** (Let's Encrypt).
5. Abre `https://tu-dominio.com/install.php` y rellena:
   - los datos de la base de datos;
   - la URL pública (viene ya rellenada; deja activos los **enlaces cortos**);
   - tu cuenta de administrador.

   Pulsa **Instalar**.
6. **Borra `install.php`** del servidor.
7. Entra en `https://tu-dominio.com/admin/` 🎉

### Plesk, paso a paso

1. **Sitios web y dominios → Añadir subdominio**. Deja la carpeta raíz que propone.
2. **Configuración de PHP:**
   - Elige PHP 8.x **«servido por Apache»**. Es importante: con nginx no funciona el `.htaccess` y fallan los enlaces cortos.
   - En **Directivas adicionales**, añade:
     ```ini
     upload_max_filesize = 64M
     post_max_size = 64M
     ```
3. **Certificados SSL/TLS → Let's Encrypt → Obtener gratis.**
4. **Bases de datos → Añadir base de datos:**
   - Vincúlala al sitio y crea un usuario.
   - En el control de acceso, elige **«Solo conexiones locales»**.
   - Genera una contraseña y cópiala.
5. **Administrador de archivos:**
   - Borra el `index.html` de Plesk.
   - **Sube** el ZIP y usa **Extraer archivos**.
   - Comprueba que `index.php` y `.htaccess` quedan directamente en la carpeta raíz, no en una subcarpeta.
6. Abre `https://tu-dominio/install.php` e instala.
7. Borra `install.php` y entra en `/admin/`.

### En local

- **XAMPP / MAMP / Laragon:** copia la carpeta en `htdocs` y abre `http://localhost/encuestas/install.php`.
- **Servidor integrado de PHP:** ejecuta `php -S localhost:8000` y **desactiva los enlaces cortos** en el instalador (sin Apache no hay `.htaccess`).

## Actualizar

1. Haz una copia de seguridad de la base de datos y de la carpeta `uploads/`.
2. Sube los archivos nuevos encima de los antiguos, **sin** `config.php` ni `install.php`.
3. Entra una vez en el panel: **las migraciones de la base de datos se aplican solas**.

## Problemas frecuentes

| Problema | Solución |
|---|---|
| Los enlaces cortos dan 404 | No está activo `mod_rewrite` / `.htaccess`. En Plesk, usa «FPM servido por Apache». Como alternativa, pon `'pretty_urls' => false` en `config.php`. |
| Página en blanco o error 500 | Revisa el registro de errores de PHP y que estén activas las extensiones `pdo_mysql`, `mbstring` y `fileinfo`. |
| No se suben imágenes | Sube `upload_max_filesize` y `post_max_size`, y comprueba que `uploads/` tiene permisos de escritura. |
| Horas incorrectas en las encuestas programadas | Ajusta `'timezone'` en `config.php`. |

La documentación técnica completa (arquitectura, reglas para Nginx, estructura del proyecto y seguridad) está en el [README en inglés](README.md).
