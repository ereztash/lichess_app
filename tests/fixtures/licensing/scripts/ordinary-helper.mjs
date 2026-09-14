/*
 * An ordinary build helper, pasted out of a GPL project with its header intact.
 *
 * Copyright (C) 2021 Some Other Project
 * Licensed under the terms of the GNU General Public License v3.0 or later.
 *
 * THIS FILE IS THE HALF OF THE PAIR THAT MUST BE CAUGHT. `scripts/` was named as first-party
 * territory by LICENSING.md §3 rule 1 from the start and was not scanned, and `.mjs` was not a
 * source extension this gate read at all, so a paste here was doubly invisible.
 */
export const slug = (s) => s.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
