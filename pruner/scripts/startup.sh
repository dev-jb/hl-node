#!/bin/bash

# Pruner startup script
echo "$(date): Pruner container starting..." >> /proc/1/fd/1
echo "$(date): Environment variables:" >> /proc/1/fd/1
echo "$(date):   PRUNE_HOURS=$PRUNE_HOURS" >> /proc/1/fd/1
echo "$(date):   CHAIN=$CHAIN" >> /proc/1/fd/1
echo "$(date): Starting cron service..." >> /proc/1/fd/1

# Create a cron job with environment variables
CRON_JOB="0 * * * * /bin/bash -c 'PRUNE_HOURS=$PRUNE_HOURS /home/hluser/scripts/prune.sh > /proc/1/fd/1 2>&1'"
echo "$CRON_JOB" > /etc/cron.d/prune

# Start cron service
crontab /etc/cron.d/prune
exec /usr/sbin/cron -f -L 15 