FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

ARG CHATBOT_URL_GEMINI
ARG DATABASE_URL
ARG RESEND_API_KEY
ARG NEXT_PUBLIC_AUTH_KEY_DASHBOARD

ENV CHATBOT_URL_GEMINI=${CHATBOT_URL_GEMINI}
ENV DATABASE_URL=${DATABASE_URL}
ENV RESEND_API_KEY=${RESEND_API_KEY}
ENV PORT 3000
ENV NEXT_PUBLIC_AUTH_KEY_DASHBOARD=${NEXT_PUBLIC_AUTH_KEY_DASHBOARD}

RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE ${PORT}

CMD ["sh", "-c", "node drizzle/migrate.js && node server.js -p $PORT -H 0.0.0.0"]