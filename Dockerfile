
FROM php:8.3-apache

# Install dependencies and PHP extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    libonig-dev \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        mbstring \
        opcache \
    && apt-get purge -y --auto-remove libonig-dev \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache modules
RUN a2enmod rewrite headers

# Apache security settings
RUN printf '%s\n' \
    'ServerName localhost' \
    'ServerTokens Prod' \
    'ServerSignature Off' \
    'TraceEnable Off' \
    >> /etc/apache2/apache2.conf

# Allow .htaccess overrides
RUN sed -i \
    's/AllowOverride None/AllowOverride All/g' \
    /etc/apache2/apache2.conf

# PHP production configuration
RUN { \
    echo 'expose_php=Off'; \
    echo 'display_errors=Off'; \
    echo 'display_startup_errors=Off'; \
    echo 'log_errors=On'; \
    echo 'error_log=/proc/self/fd/2'; \
    echo 'upload_max_filesize=64M'; \
    echo 'post_max_size=64M'; \
    echo 'memory_limit=256M'; \
    echo 'max_execution_time=60'; \
    echo 'date.timezone=Europe/Berlin'; \
    echo 'opcache.enable=1'; \
    echo 'opcache.enable_cli=0'; \
    echo 'opcache.memory_consumption=128'; \
    echo 'opcache.interned_strings_buffer=16'; \
    echo 'opcache.max_accelerated_files=20000'; \
    echo 'opcache.validate_timestamps=0'; \
    } > /usr/local/etc/php/conf.d/production.ini

WORKDIR /var/www/html

# Copy application files
COPY --chown=root:root . /var/www/html

# Create writable directories
# Adjust these paths to match your application
RUN mkdir -p \
    /var/www/html/uploads \
    /var/www/html/cache \
    && chown -R www-data:www-data \
        /var/www/html/uploads \
        /var/www/html/cache \
    && chmod -R 750 \
        /var/www/html/uploads \
        /var/www/html/cache

EXPOSE 80

CMD ["apache2-foreground"]
