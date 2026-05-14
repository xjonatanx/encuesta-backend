# Usamos Node 22 (Debian Slim) para máxima compatibilidad con Puppeteer
FROM node:22-slim

# Instalamos las dependencias del sistema necesarias para que Chromium funcione
# Sin estas librerías, Puppeteer nunca se instalará/ejecutará correctamente
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Saltamos la descarga de Chromium interno de Puppeteer (usaremos el del sistema)
# Y le decimos dónde está el ejecutable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copiamos archivos de configuración
COPY package*.json ./

# Instalamos de cero. Al usar slim, esto debería ser mucho más rápido y seguro
RUN npm install

# Copiamos el resto del código
COPY . .

# Generar cliente de prisma (asegúrate de que esté instalado en package.json)
RUN npx prisma generate

EXPOSE 3002

CMD ["npm", "start"]
