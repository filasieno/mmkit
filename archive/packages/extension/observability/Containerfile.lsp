# Build context: components/mmkit (mmkit workspace root).
FROM docker.io/library/node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/lsp-server/package.json packages/lsp-server/
RUN npm ci -w @mmkit/shared -w @mmkit/lsp-server --ignore-scripts
COPY packages/shared packages/shared
COPY packages/lsp-server packages/lsp-server
COPY artifacts/tree-sitter-conceptbase.wasm artifacts/tree-sitter-conceptbase.wasm
ENV MMKIT_WASM_PATH=/src/artifacts/tree-sitter-conceptbase.wasm
RUN npm run build -w @mmkit/shared && npm run build -w @mmkit/lsp-server

FROM docker.io/library/node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    MMKIT_LSP_TRANSPORT=tcp \
    MMKIT_LSP_PORT=6011 \
    MMKIT_HTTP_PORT=8080 \
    OTEL_SERVICE_NAME=mmkit-lsp \
    OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
COPY --from=build /src/packages/lsp-server/dist/server.js /app/server.js
COPY --from=build /src/packages/lsp-server/dist/server.js.map /app/server.js.map
COPY --from=build /src/packages/lsp-server/dist/http-server.js /app/http-server.js
COPY --from=build /src/packages/lsp-server/dist/http-server.js.map /app/http-server.js.map
COPY --from=build /src/packages/lsp-server/dist/tree-sitter-conceptbase.wasm /app/tree-sitter-conceptbase.wasm
EXPOSE 6011 8080
CMD ["node", "server.js"]
