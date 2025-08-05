FROM ubuntu:24.04

ARG USERNAME=hluser
ARG USER_UID=10000
ARG USER_GID=$USER_UID
ARG CHAIN=Mainnet

# Define URLs based on chain
ARG PUB_KEY_URL=https://raw.githubusercontent.com/hyperliquid-dex/node/refs/heads/main/pub_key.asc
ARG HL_VISOR_URL
ARG HL_VISOR_ASC_URL

# Set URLs based on chain argument
RUN if [ "$CHAIN" = "Testnet" ]; then \
        echo "Setting up for Testnet"; \
        echo "ARG HL_VISOR_URL=https://binaries.hyperliquid-testnet.xyz/Testnet/hl-visor" > /tmp/urls.sh; \
        echo "ARG HL_VISOR_ASC_URL=https://binaries.hyperliquid-testnet.xyz/Testnet/hl-visor.asc" >> /tmp/urls.sh; \
    else \
        echo "Setting up for Mainnet"; \
        echo "ARG HL_VISOR_URL=https://binaries.hyperliquid.xyz/Mainnet/hl-visor" > /tmp/urls.sh; \
        echo "ARG HL_VISOR_ASC_URL=https://binaries.hyperliquid.xyz/Mainnet/hl-visor.asc" >> /tmp/urls.sh; \
    fi

# Create user and install dependencies
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && apt-get update -y && apt-get install -y curl gnupg \
    && apt-get clean && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /home/$USERNAME/hl/data && chown -R $USERNAME:$USERNAME /home/$USERNAME/hl

USER $USERNAME
WORKDIR /home/$USERNAME

# Configure chain
RUN echo "{\"chain\": \"$CHAIN\"}" > /home/$USERNAME/visor.json

# Download bootnodes for testnet (if needed)
RUN if [ "$CHAIN" = "Testnet" ]; then \
        curl https://hyperliquid-peers.all4nodes.io/ > override_gossip_config.json; \
    fi

# Import GPG public key
RUN curl -o /home/$USERNAME/pub_key.asc $PUB_KEY_URL \
    && gpg --import /home/$USERNAME/pub_key.asc

# Download and verify hl-visor binary
RUN if [ "$CHAIN" = "Testnet" ]; then \
        curl -o /home/$USERNAME/hl-visor https://binaries.hyperliquid-testnet.xyz/Testnet/hl-visor \
        && curl -o /home/$USERNAME/hl-visor.asc https://binaries.hyperliquid-testnet.xyz/Testnet/hl-visor.asc; \
    else \
        curl -o /home/$USERNAME/hl-visor https://binaries.hyperliquid.xyz/Mainnet/hl-visor \
        && curl -o /home/$USERNAME/hl-visor.asc https://binaries.hyperliquid.xyz/Mainnet/hl-visor.asc; \
    fi \
    && gpg --verify /home/$USERNAME/hl-visor.asc /home/$USERNAME/hl-visor \
    && chmod +x /home/$USERNAME/hl-visor

# Expose gossip ports
EXPOSE 4000-4010
EXPOSE 3000-3010

# Run a non-validating node
ENTRYPOINT ["/home/hluser/hl-visor", "run-non-validator", "--replica-cmds-style", "recent-actions", "--serve-eth-rpc"] 