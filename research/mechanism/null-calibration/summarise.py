"""Compact read of the null-coverage outputs.

A member is judged ONLY when every POP target the committed run produced is present in this
run's output. null_permutation.py checkpoints after each target, so a member still in flight
has a partially written file; counting that as a disagreement reads an artifact of the
observation as the thing observed. Those are reported as (partial) and excluded from the
reproduce/disagree tally.
"""
import json, glob, os

REPL = '/work/research/mechanism/replications'
res = json.load(open('/work/research/mechanism/replication100/COHORT_RESULTS.json'))
comm = {m['u']: m['status'] for m in res['members']}


def expected_pop_targets(u):
    d = os.path.join(REPL, f'lichess_{u}_COHORT', 'analysis')
    if not os.path.isdir(d):
        return set()
    out = set()
    for f in os.listdir(d):
        if f.startswith('discovery_POP_') and f.endswith('.json'):
            out.add(f[len('discovery_POP_'):-len('.json')])
    return out


rows = []
for p in sorted(glob.glob('/tmp/nullcov/*.json')):
    if 'probe' in os.path.basename(p) or 'summary' in os.path.basename(p):
        continue
    try:
        d = json.load(open(p))
    except Exception:
        continue
    rows += (d if isinstance(d, list) else d.get('results', []))

by = {}
for r in rows:
    by.setdefault(r['username'], []).append(r)

print('%-24s %7s %8s %6s  %-28s %s' % ('member', 'max_z', 'null_max', 'pass', 'committed', 'verdict'))
print('-' * 100)
rep = dis = part = 0
npass = ntot = 0
maxnull = 0.0
for u in sorted(by):
    rs = by[u]
    got = {r['target'] for r in rs if r['stage'] == 'POP'}
    want = expected_pop_targets(u)
    complete = want and got >= want
    zs = [r['observed_max_resid_wg_z'] for r in rs
          if isinstance(r['observed_max_resid_wg_z'], (int, float))
          and r['observed_max_resid_wg_z'] == r['observed_max_resid_wg_z']]
    mz = max(zs) if zs else float('nan')
    mn = max(r['null_max'] for r in rs)
    maxnull = max(maxnull, mn)
    for r in rs:
        npass += int(round(r.get('null_pass_rate', 0) * r.get('null_reps', 0)))
        ntot += r.get('null_reps', 0)
    ap = any(r['observed_pass'] for r in rs if r['stage'] == 'POP')
    exp = comm.get(u) == 'PERSONAL_RESIDUAL_CANDIDATE'
    if not complete:
        verdict = '(partial %d/%d targets)' % (len(got), len(want) if want else 0)
        part += 1
    elif ap == exp:
        verdict = 'reproduces'
        rep += 1
    else:
        verdict = '*** MISMATCH ***'
        dis += 1
    print('%-24s %7s %8.2f %6s  %-28s %s' % (
        u, ('%.2f' % mz) if mz == mz else 'none', mn, 'yes' if ap else 'no',
        comm.get(u, '?'), verdict))
print('-' * 100)
print('complete: %d   reproduce: %d   MISMATCH: %d   in flight: %d' % (rep + dis, rep, dis, part))
if ntot:
    print('null pass rate at bar 3.5: %d / %d = %.3f%%   highest null z: %.2f' % (
        npass, ntot, 100 * npass / ntot, maxnull))
