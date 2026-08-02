#!/usr/bin/env node

export const localCli = 'local cli';

const command = process.argv[2] ?? 'inspect';
process.stdout.write(`${localCli}: ${command}\n`);
