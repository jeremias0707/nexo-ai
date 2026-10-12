/**
 * Modo grupo: anonymous "how many in my class finished today" counter.
 * Memory only (like Stage A tokens): resets when the server restarts and is
 * not shared across instances. Stores a hash of the class code, a hash of the
 * device and the score (0–3). No names, no messages, no IPs.
 */
import { daysBetween } from "./progress.ts";
import { GROUP_QUESTIONS } from "./group.ts";

export const GROUP_MAX_CLASSES = 5_000;
export const GROUP_MAX_MEMBERS = 300;
export const GROUP_HITS_PER_MINUTE = 20;

type DayBoard = { day: string; scores: Map<string, number> };

const boards = new Map<string, DayBoard>();
const hits = new Map<string, number[]>();
let nowForTests: (() => number) | null = null;

export function setGroupNowForTests(now: (() => number) | null) {
  nowForTests = now;
}

export function resetGroupMemoryForTests() {
  boards.clear();
  hits.clear();
}

function nowMs() {
  return nowForTests ? nowForTests() : Date.now();
}

function utcDay(ms: number) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** The client sends its local day; accept only today ±1 (time zones). */
export function acceptableDay(day: unknown): day is string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return Math.abs(daysBetween(utcDay(nowMs()), day)) <= 1;
}

export function groupRateAllows(deviceKey: string) {
  const now = nowMs();
  const list = (hits.get(deviceKey) ?? []).filter((t) => t > now - 60_000);
  if (list.length >= GROUP_HITS_PER_MINUTE) {
    hits.set(deviceKey, list);
    return false;
  }
  list.push(now);
  hits.set(deviceKey, list);
  if (hits.size > GROUP_MAX_CLASSES * 2) {
    for (const [key, times] of hits) if (!times.some((t) => t > now - 60_000)) hits.delete(key);
  }
  return true;
}

function boardKey(classKey: string, day: string) {
  return `${classKey}|${day}`;
}

function pruneBoards() {
  const today = utcDay(nowMs());
  for (const [key, board] of boards) {
    if (Math.abs(daysBetween(today, board.day)) > 1) boards.delete(key);
  }
}

export type GroupStats = { done: number; perfect: number; average: number | null };

export function groupStats(classKey: string, day: string): GroupStats {
  const board = boards.get(boardKey(classKey, day));
  if (!board || board.scores.size === 0) return { done: 0, perfect: 0, average: null };
  const scores = [...board.scores.values()];
  const sum = scores.reduce((a, b) => a + b, 0);
  return {
    done: scores.length,
    perfect: scores.filter((s) => s === GROUP_QUESTIONS).length,
    average: Math.round((sum / scores.length) * 10) / 10,
  };
}

/** Records this device's first score of the day. False when the class (or server) is full. */
export function recordGroupScore(
  classKey: string,
  day: string,
  deviceKey: string,
  correct: number,
) {
  const key = boardKey(classKey, day);
  let board = boards.get(key);
  if (!board) {
    // Old days go away as soon as a new board is made (a few days at most).
    pruneBoards();
    if (boards.size >= GROUP_MAX_CLASSES) return false;
    board = { day, scores: new Map() };
    boards.set(key, board);
  }
  // First try of the day is the one that counts (no retrying for a better class average).
  if (board.scores.has(deviceKey)) return true;
  if (board.scores.size >= GROUP_MAX_MEMBERS) return false;
  const score = Math.max(0, Math.min(GROUP_QUESTIONS, Math.floor(Number(correct) || 0)));
  board.scores.set(deviceKey, score);
  return true;
}
