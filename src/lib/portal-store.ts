import { useSyncExternalStore } from "react";
import type { PortalState } from "./portal-logic";
import { seedState } from "./portal-seed";

const STORAGE_KEY = "kcc-portal-demo-v1";
let state: PortalState = seedState;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as PortalState;
  } catch {
    state = seedState;
  }
}

export function getPortalState() {
  load();
  return state;
}

export function setPortalState(next: PortalState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: keep in memory */
  }
  listeners.forEach((l) => l());
}

export function resetPortalDemo() {
  setPortalState(seedState);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePortal() {
  return useSyncExternalStore(subscribe, getPortalState, () => seedState);
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newPassToken() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `KCC-${chars.slice(0, 4)}-${chars.slice(4)}`;
}
