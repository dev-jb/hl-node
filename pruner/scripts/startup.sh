#!/bin/bash

# Pruner startup script
echo "$(date): Pruner container starting..." >> /proc/1/fd/1
echo "$(date): Environment variables:" >> /proc/1/fd/1
echo "$(date):   PRUNE_HOURS=$PRUNE_HOURS" >> /proc/1/fd/1
echo "$(date):   CHAIN=$CHAIN" >> /proc/1/fd/1
echo "$(date): Starting cron service..." >> /proc/1/fd/1

# Start cron service
crontab /etc/cron.d/prune
exec /usr/sbin/cron -f -L 15 