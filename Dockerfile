FROM node:24.21.0-bookworm-slim

ENV NODE_ENV=production PORT=4173 BIND_HOST=0.0.0.0
WORKDIR /app
# No installation or build: all runtime code and browser assets are local.
COPY --chown=node:node package.json ./
COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node frontend/ ./frontend/
COPY docs/reference/licenses/ ./licenses/
RUN mkdir -p .local .cache && chown node:node .local .cache
USER node
EXPOSE 4173
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/api/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/server.js"]
