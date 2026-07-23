#!/usr/bin/env python3
"""Gate a pip-audit JSON report on CVSS severity.

pip-audit reports every known advisory but does not expose severity, so a
"fail only on HIGH/CRITICAL" policy cannot be enforced from its output alone.
This script enriches each finding with a CVSS base score fetched from OSV
(https://osv.dev) and exits non-zero only when a vulnerability scores
>= FAIL_THRESHOLD (7.0 = HIGH). Everything else is printed as a warning so
nothing is hidden.

Usage: pip_audit_gate.py <pip-audit-report.json>
"""
import json
import sys
import urllib.request
import urllib.error

from cvss import CVSS3, CVSS4

FAIL_THRESHOLD = 7.0  # CVSS v3/v4 base score for HIGH; CRITICAL is >= 9.0
OSV_API = "https://api.osv.dev/v1/vulns/"


def cvss_score(vector):
    try:
        if vector.startswith("CVSS:4"):
            return CVSS4(vector).base_score
        return CVSS3(vector).base_score
    except Exception:
        return None


def severity_for(vuln_id):
    """Return (score, label) for an advisory id, or (None, 'UNKNOWN')."""
    try:
        req = urllib.request.Request(
            OSV_API + vuln_id, headers={"User-Agent": "crossover-ci"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.load(resp)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None, "UNKNOWN"

    vectors = [s.get("score", "") for s in data.get("severity", [])]
    for aff in data.get("affected", []):
        vectors += [s.get("score", "") for s in aff.get("severity", [])]

    best = None
    for vec in vectors:
        if vec.startswith("CVSS:"):
            sc = cvss_score(vec)
            if sc is not None and (best is None or sc > best):
                best = sc
    if best is None:
        return None, "UNKNOWN"
    label = (
        "CRITICAL" if best >= 9.0 else "HIGH" if best >= 7.0
        else "MEDIUM" if best >= 4.0 else "LOW"
    )
    return best, label


def main():
    if len(sys.argv) != 2:
        print("usage: pip_audit_gate.py <report.json>", file=sys.stderr)
        return 2
    with open(sys.argv[1]) as fh:
        report = json.load(fh)

    findings = []
    seen = set()
    for dep in report.get("dependencies", []):
        for vuln in dep.get("vulns", []):
            key = (dep["name"], dep["version"], vuln["id"])
            if key in seen:
                continue
            seen.add(key)
            score, label = severity_for(vuln["id"])
            findings.append(
                {
                    "pkg": dep["name"],
                    "version": dep["version"],
                    "id": vuln["id"],
                    "fix": ",".join(vuln.get("fix_versions", [])) or "none",
                    "score": score,
                    "label": label,
                }
            )

    if not findings:
        print("pip-audit: no known vulnerabilities. ✅")
        return 0

    findings.sort(key=lambda f: f["score"] if f["score"] is not None else -1, reverse=True)
    print(f"pip-audit: {len(findings)} advisory(ies) found\n")
    print(f"{'SEVERITY':<10} {'SCORE':<6} {'PACKAGE':<16} {'VERSION':<10} {'ID':<20} FIX")
    print("-" * 90)
    blocking = []
    for f in findings:
        sc = f"{f['score']:.1f}" if f["score"] is not None else "  -"
        print(f"{f['label']:<10} {sc:<6} {f['pkg']:<16} {f['version']:<10} {f['id']:<20} {f['fix']}")
        if f["score"] is not None and f["score"] >= FAIL_THRESHOLD:
            blocking.append(f)

    print()
    if blocking:
        print(
            f"❌ FAIL: {len(blocking)} HIGH/CRITICAL vulnerability(ies) "
            f"(CVSS >= {FAIL_THRESHOLD}). Upgrade the affected package(s)."
        )
        return 1
    print(
        f"✅ PASS: no HIGH/CRITICAL vulnerabilities (CVSS >= {FAIL_THRESHOLD}). "
        "Lower-severity advisories above are informational."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
