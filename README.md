# Encuestas · PHP + MySQL

Aplicación web para diseñar encuestas visuales de varios pasos, compartirlas (enlace, QR, iframe) y analizar los resultados. Funciona en cualquier hosting LAMP.

## Requisitos

- PHP 7.4 o superior (recomendado 8.1+) con las extensiones `pdo_mysql`, `mbstring`, `fileinfo` y `json`
- MySQL 5.7+ o MariaDB 10.2+
- Apache con `.htaccess` habilitado (`AllowOverride All`). Con Nginx, replica las reglas de `.htaccess`, `inc/.htaccess` y `uploads/.htaccess`.

## Instalación en quiz.fourmartech.es

1. En el panel del hosting, crea el subdominio `quiz.fourmartech.es` y apunta su carpeta raíz (document root) a esta aplicación. Por ejemplo `public_html/quiz` o `/var/www/quiz`.
2. Activa SSL para el subdominio (Let's Encrypt). El `.htaccess` redirige automáticamente de HTTP a HTTPS.
3. Crea una base de datos MySQL y un usuario con permisos sobre ella.
4. Sube el contenido de la carpeta. PHP debe poder escribir en la raíz (para crear `config.php`) y en `uploads/`.
5. Abre `https://quiz.fourmartech.es/install.php`. La URL pública ya aparece rellenada; indica los datos de MySQL y crea el administrador.
6. **Borra `install.php`** del servidor.
7. El panel está en `https://quiz.fourmartech.es/admin/`. Las encuestas se comparten con enlaces cortos del tipo `https://quiz.fourmartech.es/Xk3mP9qa2B`.

Si los enlaces cortos dan error 404, el servidor no tiene `mod_rewrite`. En ese caso pon `'pretty_urls' => false` en `config.php` y los enlaces pasarán a ser `…/s.php?id=Xk3mP9qa2B`.

Para configurarla a mano, copia `config.sample.php` como `config.php`, importa `schema.sql` y crea un usuario en la tabla `users` con `password_hash()`.

## Funcionalidades

**Editor visual**
- Encuestas de varios pasos, con pantallas de bienvenida y final configurables.
- Para añadir componentes, arrástralos o haz clic en ellos. Se reordenan arrastrando y se mueven de un paso a otro.
- Contenido: títulos, texto con formato (`**negrita**`, `*cursiva*`, `[enlace](https://…)`), imágenes, vídeo (YouTube, Vimeo o MP4), franja de logos, separador y espacio.
- Preguntas: opción única, opción múltiple con mínimo y máximo, opción "Otro", **elección con imágenes o logos** (una o varias), desplegable, sí/no, valoración con estrellas, corazones o caras, escala lineal, NPS, deslizador, ranking, matriz, texto corto y largo, email, número y fecha.
- Autoguardado, deshacer/rehacer (Ctrl+Z / Ctrl+Shift+Z), duplicar (Ctrl+D), vista previa en escritorio y en móvil.
- Plantillas de partida: en blanco, satisfacción (NPS), feedback de evento y votación de logos.

**Temas**
- 10 temas predefinidos (claros, oscuros, degradados, serif…).
- Temas personalizados reutilizables: colores (principal, fondo, tarjeta, texto, bordes, campos), fondo sólido, degradado o imagen, efecto cristal, tipografía, redondeo y sombra.
- Generador automático de paleta (clara u oscura) a partir del color principal, con aviso si el contraste es bajo.
- Al editar un tema, el cambio se aplica a todas las encuestas que lo usan.
- Se gestionan desde **Temas** en el menú o desde la pestaña **Diseño** del editor.

**Compartir**
- Enlace público y código para insertarla en un iframe.
- **Código QR** descargable en PNG (alta resolución) o SVG (vectorial, para imprenta).
- **Cartel imprimible A4** con el QR, los colores del tema y textos editables (Imprimir / Guardar como PDF).

**Control de participación**
- Una respuesta por navegador mediante una cookie (más `localStorage` como respaldo), y opcionalmente una por IP (se guarda anonimizada con un hash).
- Fechas de apertura y cierre, límite de respuestas y mensajes personalizables.
- Validación en el servidor de todas las respuestas, campo trampa contra bots y límite de envíos por minuto.

**Resultados**
- Respuestas, visitas, tasa de finalización, tiempo medio y evolución diaria.
- Un gráfico por pregunta: barras, ganador en las preguntas con imágenes o logos, NPS con promotores y detractores, media de valoraciones, mapa de calor para las matrices, posición media en los rankings y listado filtrable de los textos libres.
- Filtro por fechas, respuestas individuales (con opción de borrarlas), exportación a CSV (compatible con Excel) e impresión o PDF.

## Estructura

```
admin/        Panel: login, encuestas, editor, temas, resultados, cartel QR y API JSON
assets/       CSS y JS (blocks.js es el renderizador común del editor y de la encuesta)
inc/          Arranque, temas, plantillas y cálculo de resultados (no accesible por web)
uploads/      Imágenes y vídeos subidos (sin ejecución de PHP)
s.php         Encuesta pública  →  s.php?id=XXXXXXXXXX
submit.php    Recepción de respuestas
```
