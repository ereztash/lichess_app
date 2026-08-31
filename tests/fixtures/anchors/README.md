# A register whose proof does not reach its claim

Positive control for `GATE-CLAIM-ANCHOR`. A repository in miniature carrying both defects the gate
is for, and the scanner run over this directory is the same scanner run over the root — a control
with its own weaker predicate proves nothing.

- **`docs/MASTER_PRODUCT_DEBT.md`** holds one **P0** row — *a record can be lost or made wrong* —
  whose `**Gate:**` names a test that runs against one function with hand-built inputs. That is the
  shape all four real P0 rows have today, reduced to one.
- **`tests/gates/bare-override.test.ts`** declares `@level L6` and gives no reason, which is a
  number pretending to be an argument.
