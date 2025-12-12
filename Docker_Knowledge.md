# Docker Image Optimization Guide

## Base Image Selection

### Use Minimal Base Images
- **Alpine Linux**: 5MB base vs 109MB Debian
- **Distroless**: Google's minimal images with only runtime dependencies
- **Scratch**: For static binaries (Go, Rust)
- **Slim variants**: Language-specific minimal versions

### Language-Specific Base Images
```dockerfile
# Node.js
FROM node:18-alpine          # vs node:18 (saves ~900MB)

# Python  
FROM python:3.11-slim-alpine # vs python:3.11 (saves ~800MB)

# PHP
FROM php:8.1-fpm-alpine     # vs php:8.1-apache (saves ~600MB)

# Java
FROM openjdk:17-jre-alpine  # vs openjdk:17 (saves ~400MB)

# .NET
FROM mcr.microsoft.com/dotnet/aspnet:7.0-alpine

# Go (static binary)
FROM scratch                # Ultimate minimal (0MB base)
```

## Multi-Stage Builds

### Separate Build and Runtime Environments
```dockerfile
# Build stage - includes all build tools
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Runtime stage - minimal dependencies only
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

### Language-Specific Multi-Stage Examples
```dockerfile
# Go application
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o main .

FROM scratch
COPY --from=builder /app/main /main
ENTRYPOINT ["/main"]

# Java application
FROM maven:3.9-openjdk-17 AS builder
COPY . .
RUN mvn clean package -DskipTests

FROM openjdk:17-jre-alpine
COPY --from=builder /app/target/app.jar /app.jar
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

## Layer Optimization

### Combine Commands to Reduce Layers
```dockerfile
# Bad - Creates multiple layers
RUN apt-get update
RUN apt-get install -y curl git
RUN apt-get clean

# Good - Single optimized layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

### Clean Up in Same Layer
```dockerfile
# Alpine
RUN apk add --no-cache --virtual .build-deps \
        gcc musl-dev make && \
    # Build commands here && \
    apk del .build-deps

# Debian/Ubuntu
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    # Build commands here && \
    apt-get purge -y build-essential && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*
```

## File Exclusion with .dockerignore

### Universal Exclusions
```dockerignore
# Version control
.git
.gitignore
.gitattributes

# CI/CD
.github
.gitlab-ci.yml
.travis.yml
Jenkinsfile

# Documentation
README.md
CHANGELOG.md
docs/
*.md

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs and temporary files
*.log
logs/
tmp/
temp/
.tmp/

# User uploads and data (CRITICAL!)
uploads/
user-data/
storage/
data/
```

### Stack-Specific Exclusions
```dockerignore
# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm
.yarn-integrity
coverage/
.nyc_output

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv/
pip-log.txt
pip-delete-this-directory.txt

# PHP
vendor/
composer.phar
.env.local
storage/logs/
storage/framework/cache/
storage/framework/sessions/
storage/framework/views/

# Java
target/
*.class
*.jar
*.war
*.ear
.mvn/
mvnw
mvnw.cmd

# .NET
bin/
obj/
*.user
*.suo
packages/

# Go
*.exe
*.exe~
*.dll
*.so
*.dylib
vendor/
```

## Package Management Optimization

### Use Package Manager Best Practices
```dockerfile
# APT (Debian/Ubuntu)
RUN apt-get update && \
    apt-get install -y --no-install-recommends package && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# APK (Alpine)
RUN apk add --no-cache package

# YUM/DNF (RHEL/CentOS/Fedora)
RUN yum install -y package && \
    yum clean all && \
    rm -rf /var/cache/yum

# Zypper (openSUSE)
RUN zypper install -y package && \
    zypper clean -a
```

### Install Only Production Dependencies
```dockerfile
# Node.js
RUN npm ci --only=production --no-audit --no-fund
# or
RUN yarn install --production --frozen-lockfile

# Python
RUN pip install --no-cache-dir --no-deps -r requirements.txt

# PHP
RUN composer install --no-dev --optimize-autoloader --no-cache

# Go modules
RUN go mod download && go mod verify

# Maven
RUN mvn dependency:go-offline -B

# .NET
RUN dotnet restore --no-cache
```

## Application-Specific Optimizations

### Remove Unnecessary Runtime Files
```dockerfile
# Remove package manager caches
RUN rm -rf ~/.npm ~/.cache ~/.composer/cache

# Remove source files after compilation
RUN rm -rf /usr/src/* /tmp/* /var/tmp/*

# Remove documentation and man pages
RUN rm -rf /usr/share/man/* /usr/share/doc/* /usr/share/info/*

# Remove locales (keep only en_US if needed)
RUN find /usr/share/locale -mindepth 1 -maxdepth 1 ! -name 'en_US' -exec rm -rf {} +
```

### Language-Specific Cleanup
```dockerfile
# Python: Remove bytecode and cache
RUN find /usr/local -name '*.pyc' -delete && \
    find /usr/local -name '__pycache__' -delete && \
    find /usr/local -name '*.pyo' -delete

# Node.js: Clean npm cache
RUN npm cache clean --force && \
    rm -rf ~/.npm

# PHP: Remove Composer cache
RUN rm -rf ~/.composer/cache

# Java: Remove Maven cache
RUN rm -rf ~/.m2/repository

# Go: Clean module cache
RUN go clean -modcache
```

## Security and Efficiency

### Use Non-Root Users
```dockerfile
# Create and use non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Switch to non-root user
USER appuser

# Alternative for different distros
RUN useradd -r -u 1001 -g appgroup appuser
USER appuser
```

### Use Specific Versions
```dockerfile
# Bad - Unpredictable and potentially larger
FROM node:latest
FROM python:3
FROM alpine

# Good - Specific, reproducible versions
FROM node:18.17.0-alpine3.18
FROM python:3.11.5-slim-bullseye
FROM alpine:3.18.3
```

## Advanced Techniques

### Use BuildKit Features
```dockerfile
# syntax=docker/dockerfile:1
FROM alpine:latest

# Mount caches to avoid layer bloat
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --update package

# Mount secrets without adding to layers
RUN --mount=type=secret,id=api_key \
    API_KEY=$(cat /run/secrets/api_key) && \
    # Use API_KEY without storing in image
```

### Optimize for Different Architectures
```dockerfile
FROM --platform=$BUILDPLATFORM alpine:latest AS builder
ARG TARGETPLATFORM
ARG BUILDPLATFORM
RUN echo "Building on $BUILDPLATFORM for $TARGETPLATFORM"
```

## Monitoring and Measurement

### Analyze Image Size and Layers
```bash
# List images with sizes
docker images

# Get specific image size in bytes
docker image inspect myapp:latest --format='{{.Size}}'

# Analyze layer history
docker history myapp:latest --human --no-trunc

# Use dive for detailed analysis
dive myapp:latest
```

### Size Targets by Application Type
- **Static sites**: < 50MB
- **Microservices**: < 200MB
- **Web applications**: < 500MB
- **Full-stack applications**: < 1GB
- **Data processing**: < 2GB

## Common Pitfalls to Avoid

### Critical Mistakes
1. **Including user uploads/data** - Use volumes instead
2. **Forgetting .dockerignore** - Copies unnecessary files
3. **Installing dev dependencies** - Use production-only flags
4. **Multiple package updates** - Combine in single RUN command
5. **Keeping build tools** - Remove after compilation
6. **Using :latest tags** - Unpredictable size and behavior
7. **Not cleaning caches** - Leaves temporary files
8. **Copying entire context** - Use specific COPY commands
9. **Running as root** - Security and size implications
10. **Not using multi-stage builds** - Includes unnecessary build tools

### Real-World Size Improvements
```dockerfile
# Before: 4.78GB (PHP application)
FROM php:8.1-apache
COPY . /var/www/html/
RUN composer install

# After: 153MB (97% reduction)
FROM php:8.1-fpm-alpine
RUN apk add --no-cache nginx && \
    docker-php-ext-install pdo pdo_mysql
COPY . /var/www/html/
RUN composer install --no-dev --optimize-autoloader --no-cache
```

## Verification Checklist

- [ ] Used minimal base image (Alpine/slim/distroless)
- [ ] Created comprehensive .dockerignore file
- [ ] Combined RUN commands where possible
- [ ] Used multi-stage builds for complex applications
- [ ] Removed build dependencies after compilation
- [ ] Installed only production dependencies
- [ ] Cleaned package manager caches
- [ ] Excluded development and documentation files
- [ ] Used specific image versions (no :latest)
- [ ] Created non-root user for security
- [ ] Verified final image size with `docker images`
- [ ] Analyzed layers with `docker history`
- [ ] Tested image functionality after optimization

## Optimization Tools

### Analysis Tools
- **dive**: Interactive layer analysis (`dive image:tag`)
- **docker-slim**: Automatic image minification
- **hadolint**: Dockerfile best practices linter
- **trivy**: Security and efficiency scanner
- **docker scout**: Docker's official security analysis

### Build Tools
- **BuildKit**: Advanced Docker build features
- **Buildx**: Multi-platform builds
- **Kaniko**: Kubernetes-native builds

## Best Practices Summary

1. **Start small**: Choose the minimal base image for your needs
2. **Exclude aggressively**: Use .dockerignore to prevent unnecessary files
3. **Layer efficiently**: Combine commands and clean up in the same layer
4. **Build smart**: Use multi-stage builds to separate build and runtime
5. **Cache wisely**: Leverage Docker layer caching for faster builds
6. **Measure constantly**: Monitor image sizes and optimize iteratively
7. **Secure by default**: Use non-root users and specific versions

Remember: Smaller images mean faster deployments, reduced storage costs, improved security, and better performance across your entire development and production pipeline.
