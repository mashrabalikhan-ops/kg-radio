FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server.cjs .
USER node
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node","server.cjs"]
