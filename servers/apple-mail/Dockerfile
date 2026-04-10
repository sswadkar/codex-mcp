FROM node:22-bookworm-slim AS runtime

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY servers ./servers

RUN corepack enable
RUN pnpm install --recursive --frozen-lockfile=false
RUN pnpm -r build

ENV SERVER_ID=apple-mail
ENV SERVER_NAME="Apple Mail MCP Server"
ENV SERVER_VERSION=0.1.0
ENV HOST=0.0.0.0
ENV PORT=8080

CMD ["pnpm", "--filter", "@codex-mcp/server-apple-mail", "exec", "node", "dist/index.js"]
