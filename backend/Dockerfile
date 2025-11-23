# backend/Dockerfile — build sqlite3 inside container and use Node 20
FROM node:20-bullseye

WORKDIR /app

# install build dependencies and sqlite headers for compiling sqlite3
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      build-essential \
      g++ \
      make \
      libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

# copy package files and install inside container
COPY package.json package-lock.json ./

# install dependencies inside container (compiles native modules here)
RUN npm ci --unsafe-perm

# copy rest of source
COPY . .

# (optional) force rebuild sqlite3 from source (safe)
RUN npm rebuild sqlite3 --build-from-source || true

EXPOSE 4000

CMD ["npm", "run", "dev"]
