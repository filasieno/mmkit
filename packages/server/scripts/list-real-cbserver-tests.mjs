#!/usr/bin/env node
/**
 * Emit `file|grep-pattern` lines for test-cbserver-real-one-by-one.sh
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out-test/test/cbserver");

const lifecycle = [
  "ENROLL on connect, CANCEL_ME on close, supervisor reaches Stopped",
  "close is idempotent-safe on supervisor registry",
  "two connections: close each with CANCEL_ME before server stop",
  "stop waits for subprocess exit",
  "server stop closes open connections before SIGTERM",
];

const commands = [
  "getConnectionId",
  "getClientId",
  "getNotificationClientId",
  "pwd-initial",
  "mkdir",
  "cd-set",
  "pwd-after-cd",
  "get-module-context",
  "tellModel",
  "tell-bill",
  "tell-bill-name",
  "tell-mary",
  "tell-transactions",
  "tell-query",
  "who",
  "sub",
  "lm-named",
  "lm-current",
  "ls-class",
  "ls-all",
  "ask-exists-bill",
  "ask-objnames-label",
  "ask-get-object-frame",
  "ask-frames-query",
  "show",
  "hypoAsk-objnames",
  "hypoAsk-frames",
  "retell-mary",
  "untell-mary2",
  "reportClients",
  "nextMessage-empty",
  "prolog-true",
  "lpicall-getModulePath",
  "why",
];

const notification = [
  "tell-empview",
  "tell-empview-naive-vm",
  "ask-empview",
  "notificationRequest",
  "notificationRequest-delete",
  "getNotificationMessage",
];

function emit(file, pattern) {
  process.stdout.write(`${file}|${pattern}\n`);
}

for (const pattern of lifecycle) {
  emit(join(outDir, "lifecycle.real.test.js"), pattern);
}
for (const label of commands) {
  emit(join(outDir, "commands-steps.real.test.js"), `step/${label}`);
}
emit(join(outDir, "commands-all.real.test.js"), "STOP_SERVER returns ok");
for (const label of notification) {
  emit(join(outDir, "notification-steps.real.test.js"), `notify/${label}`);
}
