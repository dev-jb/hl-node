FROM node:18-alpine

ARG USERNAME=hluser
ARG USER_UID=10000
ARG USER_GID=$USER_UID

# Install system dependencies
RUN apk add --no-cache \
    curl \
    jq \
    procps \
    docker-cli \
    shadow

# Create user
RUN addgroup -g $USER_GID $USERNAME \
    && adduser -u $USER_UID -G $USERNAME -s /bin/sh -D $USERNAME

# Set working directory
WORKDIR /home/$USERNAME

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy application files
COPY web_monitor.js ./
COPY public/ ./public/

# Change ownership
RUN chown -R $USERNAME:$USERNAME /home/$USERNAME

# Expose monitoring port
EXPOSE 8080

# Start monitoring (run as root for Docker access)
CMD ["node", "web_monitor.js"] 