"""Synthetic charity-campaign generator with labelled fraud typologies.

Output snapshots use the same schema the Node service reads from the chain:
  campaign = {id, owner, payout, target, createdAt, approvedAt, donations:[{donor, amount, ts}],
              label (0/1), fraudType}
`label` and `fraudType` are only used for training/evaluation, never as features.

Honest limitation (state it in the report): there is no public labelled dataset of
on-chain charity fraud, so the fraud patterns below are modelled from published
typologies. Results on this data show the detectors work on these patterns, not
that they would catch every real-world scheme. To reduce circularity the generator
has two difficulty levels:
  standard - clear-cut fraud among normal campaigns, 25% of which are unusual but legitimate
             (viral bursts, whale donors, pledge drives, charity appeal weeks)
  hard     - subtle fraud (low intensity) among normals with 50% unusual-but-legitimate behaviour

Usage:  python generate_data.py --out data --seed 42
"""
import argparse
import json
import os
import random

T0 = 1_700_000_000
HOUR, DAY = 3600, 86400


class Gen:
    def __init__(self, seed):
        self.r = random.Random(seed)
        self.next_wallet = 1
        self.next_id = 1

    def wallet(self):
        w = "0x%040x" % (self.r.getrandbits(160) | 1)
        return w

    def donors(self, k):
        return [self.wallet() for _ in range(k)]

    # ---- helpers -------------------------------------------------------
    def human_amount(self, scale=1.0):
        # log-normal: many small gifts, few large ones; sometimes round numbers
        a = self.r.lognormvariate(-2.8, 1.0) * scale
        if self.r.random() < 0.25:
            a = max(0.01, round(a * 20) / 20)
        return round(max(0.001, a), 6)

    def human_times(self, n, start, span):
        # donations cluster early and fade (campaign sharing), exponential gaps
        ts = []
        for _ in range(n):
            ts.append(start + int(self.r.expovariate(3.0 / span) % span))
        return sorted(ts)

    def base(self, target, created=None, payout_other=False):
        owner = self.wallet()
        created = created if created is not None else T0 + self.r.randint(0, 120 * DAY)
        approved = created + self.r.randint(HOUR, 2 * DAY)
        c = {
            "id": self.next_id, "owner": owner,
            "payout": self.wallet() if payout_other else owner,
            "target": target, "createdAt": created, "approvedAt": approved,
            "donations": [], "label": 0, "fraudType": "none",
        }
        self.next_id += 1
        return c

    # ---- normal behaviours ---------------------------------------------
    def normal(self, noise=0.0):
        target = self.r.choice([2, 5, 10, 20, 50])
        c = self.base(target, payout_other=self.r.random() < 0.15)
        n = int(self.r.lognormvariate(3.0, 0.7))
        n = max(3, min(n, 120))
        pool = self.donors(max(2, int(n * self.r.uniform(0.75, 1.0))))
        span = self.r.randint(5, 30) * DAY
        ts = self.human_times(n, c["approvedAt"], span)
        scale = target / 10 / max(1, n) * 6
        for t in ts:
            c["donations"].append({"donor": self.r.choice(pool), "amount": self.human_amount(scale), "ts": t})
        if self.r.random() < noise:
            kind = self.r.choice(["viral", "whale", "round", "dormant", "quick"])
            if kind == "viral":      # share on social media -> genuine burst of many donors
                k = self.r.randint(8, 25)
                t0 = c["approvedAt"] + self.r.randint(HOUR, 6 * HOUR)
                for _ in range(k):
                    c["donations"].append({"donor": self.wallet(), "amount": self.human_amount(scale),
                                           "ts": t0 + self.r.randint(0, 540)})
            elif kind == "whale":    # one generous donor
                c["donations"].append({"donor": self.wallet(), "amount": round(target * self.r.uniform(0.4, 0.8), 4),
                                       "ts": c["approvedAt"] + self.r.randint(DAY, 5 * DAY)})
            elif kind == "round":    # lots of identical round gifts (e.g. 0.1 ETH pledge drive)
                k = self.r.randint(6, 14)
                t0 = c["approvedAt"] + self.r.randint(DAY, 3 * DAY)
                for _ in range(k):
                    c["donations"].append({"donor": self.wallet(), "amount": 0.1,
                                           "ts": t0 + self.r.randint(0, 5 * DAY)})
            elif kind == "quick":    # well-supported and funded within the first hour (corporate/community drive)
                k = self.r.randint(5, 10)
                for _ in range(k):
                    c["donations"].append({"donor": self.wallet(), "amount": self.human_amount(scale * 2),
                                           "ts": c["approvedAt"] + self.r.randint(60, 3000)})
            # "dormant": nothing extra, simply a quiet campaign
        c["donations"].sort(key=lambda d: d["ts"])
        return c

    def normal_charity_group(self, noise=0.0):
        """A real charity running several campaigns that share one payout wallet.
        Usually spread over months; with probability `noise` it is an appeal week where
        the campaigns launch together (looks like a ring to a naive rule)."""
        payout = self.wallet()
        out = []
        creators = [self.wallet() for _ in range(self.r.randint(2, 3))]
        together = self.r.random() < noise
        t_launch = T0 + self.r.randint(0, 120 * DAY)
        for owner in creators:
            c = self.normal(noise)
            c["owner"], c["payout"] = owner, payout
            if together:
                shift = (t_launch + self.r.randint(0, 20 * HOUR)) - c["createdAt"]
                c["createdAt"] += shift
                c["approvedAt"] += shift
                for d in c["donations"]:
                    d["ts"] += shift
            out.append(c)
        return out

    # ---- fraud typologies ----------------------------------------------
    def fraud_self(self, subtle=False):
        target = self.r.choice([5, 10, 20])
        c = self.base(target)
        if subtle:
            c["payout"] = self.wallet()  # still ties back via donor == payout
        n_real = self.r.randint(3, 12)
        pool = self.donors(n_real)
        for t in self.human_times(n_real, c["approvedAt"], 20 * DAY):
            c["donations"].append({"donor": self.r.choice(pool), "amount": self.human_amount(target / 10 / n_real * 6), "ts": t})
        real_total = sum(d["amount"] for d in c["donations"])
        # wash: creator (or payout wallet) donates to fake momentum
        share = self.r.uniform(0.08, 0.2) if subtle else self.r.uniform(0.3, 0.7)
        fake_total = real_total * share / (1 - share)
        k = self.r.randint(1, 3) if subtle else self.r.randint(1, 4)
        wallet = c["owner"] if not subtle else c["payout"]
        for _ in range(k):
            c["donations"].append({"donor": wallet, "amount": round(fake_total / k, 6),
                                   "ts": c["approvedAt"] + self.r.randint(HOUR, 10 * DAY)})
        c["label"], c["fraudType"] = 1, "self_donation"
        c["donations"].sort(key=lambda d: d["ts"])
        return c

    def fraud_shared_payout(self, subtle=False):
        """One beneficiary wallet behind several 'different' fresh creator wallets (duplicate/mule ring).
        Standard: launched within hours of each other. Subtle: spread over several days."""
        payout = self.wallet()
        out = []
        t_launch = T0 + self.r.randint(0, 120 * DAY)
        spread = 6 * DAY if subtle else 20 * HOUR
        for _ in range(self.r.randint(2, 3)):
            c = self.normal(noise=0.0)
            c["owner"], c["payout"] = self.wallet(), payout
            shift = (t_launch + self.r.randint(0, spread)) - c["createdAt"]
            c["createdAt"] += shift
            c["approvedAt"] += shift
            for d in c["donations"]:
                d["ts"] += shift
            c["label"], c["fraudType"] = 1, "shared_payout"
            out.append(c)
        return out

    def fraud_burst(self, subtle=False):
        """Bot / purchased donations: many wallets, tiny identical-looking gifts, fast."""
        target = self.r.choice([5, 10, 20])
        c = self.base(target)
        k = self.r.randint(10, 18) if subtle else self.r.randint(20, 40)
        amount = round(target / (k * self.r.uniform(1.2, 2.5)), 5)
        t0 = c["approvedAt"] + self.r.randint(60, HOUR)
        gap = self.r.randint(40, 200) if subtle else self.r.randint(5, 40)
        t = t0
        for _ in range(k):
            t += gap if not subtle else max(10, int(self.r.gauss(gap, gap * 0.5)))
            a = amount if not subtle else round(amount * self.r.uniform(0.7, 1.4), 5)
            c["donations"].append({"donor": self.wallet(), "amount": a, "ts": t})
        c["label"], c["fraudType"] = 1, "burst"
        return c

    def fraud_structuring(self, subtle=False):
        """One person splits a large sum into many identical small donations from sock-puppet wallets
        at regular intervals, to look like broad support."""
        target = self.r.choice([5, 10, 20])
        c = self.base(target)
        k = self.r.randint(10, 18) if subtle else self.r.randint(12, 30)
        amount = round(target * self.r.uniform(0.03, 0.08), 4)
        t = c["approvedAt"] + self.r.randint(HOUR, DAY)
        step = self.r.randint(900, 7200)
        for _ in range(k):
            jitter = self.r.uniform(0.7, 1.4) if subtle else self.r.uniform(0.95, 1.05)
            t += int(step * jitter)
            a = amount if not subtle or self.r.random() < 0.75 else round(amount * 1.5, 4)
            c["donations"].append({"donor": self.wallet(), "amount": a, "ts": t})
        c["label"], c["fraudType"] = 1, "structuring"
        return c

    def fraud_serial(self, subtle=False):
        """Spam: the same creator opens several campaigns within hours, fishing for a hit."""
        owner = self.wallet()
        start = T0 + self.r.randint(0, 120 * DAY)
        out = []
        k = self.r.randint(3, 6)
        for i in range(k):
            gap = self.r.randint(HOUR, 6 * HOUR) if subtle else self.r.randint(60, HOUR)
            c = self.base(self.r.choice([5, 10, 20]), created=start + i * gap)
            c["owner"], c["payout"] = owner, owner
            for t in self.human_times(self.r.randint(0, 3), c["approvedAt"], 5 * DAY):
                c["donations"].append({"donor": self.wallet(), "amount": self.human_amount(0.3), "ts": t})
            c["label"], c["fraudType"] = 1, "serial_campaigns"
            out.append(c)
        return out

    # ---- dataset assembly ----------------------------------------------
    def dataset(self, n_normal, n_fraud_groups, noise, subtle):
        items = []
        while sum(1 for c in items if c["label"] == 0) < n_normal:
            if self.r.random() < 0.12:
                items.extend(self.normal_charity_group(noise))
            else:
                items.append(self.normal(noise))
        makers = [self.fraud_self, self.fraud_shared_payout, self.fraud_burst,
                  self.fraud_structuring, self.fraud_serial]
        for i in range(n_fraud_groups):
            made = makers[i % len(makers)](subtle)
            items.extend(made if isinstance(made, list) else [made])
        self.r.shuffle(items)
        for i, c in enumerate(items, 1):
            c["id"] = i
        return items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--normal", type=int, default=1600)
    ap.add_argument("--fraud-groups", type=int, default=200)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    # separate generators and seeds so the splits never share wallets or campaigns.
    # noise  = share of normal campaigns with unusual-but-legitimate behaviour (viral burst, whale donor,
    #          pledge drive, quick community funding, charity appeal-week launches)
    # subtle = fraud run at low intensity so it blends in
    # train/validation/test_standard share the same world (noise 25%, clear fraud);
    # test_hard has twice the noise and subtle fraud.
    plan = [
        ("train", a.seed + 1, 0.25, False),
        ("validation", a.seed + 2, 0.25, False),
        ("test_standard", a.seed + 3, 0.25, False),
        ("test_hard", a.seed + 4, 0.50, True),
    ]
    for name, seed, noise, subtle in plan:
        g = Gen(seed)
        n_norm = a.normal if name == "train" else a.normal // 2
        n_frd = a.fraud_groups if name == "train" else a.fraud_groups // 2
        data = g.dataset(n_norm, n_frd, noise, subtle)
        path = os.path.join(a.out, f"{name}.json")
        with open(path, "w") as f:
            json.dump({"seed": seed, "noise": noise, "subtle": subtle, "campaigns": data}, f)
        fr = sum(c["label"] for c in data)
        print(f"{name:14s} campaigns={len(data):4d} fraud={fr:3d} ({fr/len(data):.0%}) noise={noise} subtle={subtle} seed={seed}")


if __name__ == "__main__":
    main()
