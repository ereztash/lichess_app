#!/bin/sh
# The shipped engine as a spawnable binary. See scripts/sf-wasm.mjs for why the wrapper is needed.
exec node "$(dirname "$0")/sf-wasm.mjs" "${SF_FLAVOUR:-lite-single}"
