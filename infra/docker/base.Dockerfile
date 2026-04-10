FROM node:22-bookworm-slim AS base

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY servers ./servers

RUN corepack enable
RUN pnpm install --recursive --frozen-lockfile=false
