/*
 * The engine harness, held on the GPL side ON PURPOSE.
 *
 * Copyright (C) 2026 Erez Tash
 * Licensed under the terms of the GNU General Public License v3.0 or later.
 *
 * THIS FILE IS THE HALF OF THE PAIR THAT MUST *NOT* BE CAUGHT, and it carries the same header as
 * `ordinary-helper.mjs` beside it so the difference between them is the exception list and nothing
 * else. A control in which the allowlisted file simply had no header would prove only that a file
 * with no header produces no finding.
 */
import { createRequire } from "node:module";
export const engine = () => createRequire(import.meta.url)("stockfish");
