# Usa la imagen oficial de Node.js ligera
FROM node:20-slim

# Instalar las dependencias del sistema necesarias para correr Chromium (Puppeteer) en Linux
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Variables de entorno críticas para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# Configurar el directorio de trabajo
WORKDIR /usr/src/app

# Copiar configuración e instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el código del servidor
COPY . .

# El puerto que usará Render
EXPOSE 10000

# Encender el robot
CMD ["node", "server.js"]
