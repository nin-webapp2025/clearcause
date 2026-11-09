# Gas report

Measured on a local Hardhat chain with the optimiser enabled (runs=1). **Gas units are exact** and the same on any EVM chain running this code.
The ETH and USD columns are **estimates** using an assumed gas price of 10 gwei and ETH = $3000. Real prices change daily; Sepolia test ETH has no value.

For scale: a plain ETH transfer costs 21,000 gas.

| Action | Contract | Gas used | Est. ETH | Est. USD | Note |
|---|---|---:|---:|---:|---|
| Deploy KYCManager | KYCManager | 967,860 | 0.00968 | 29.04 | one-time |
| Deploy ClearCause | ClearCause | 5,428,213 | 0.05428 | 162.85 | one-time |
| Submit KYC | KYCManager | 210,893 | 0.00211 | 6.33 |  |
| Verify KYC (admin) | KYCManager | 53,495 | 0.00053 | 1.60 |  |
| Create campaign (2 milestones) | ClearCause | 366,226 | 0.00366 | 10.99 | starts Pending |
| Set payout address | ClearCause | 55,633 | 0.00056 | 1.67 |  |
| Approve campaign (admin) | ClearCause | 83,582 | 0.00084 | 2.51 |  |
| Create campaign (no milestones) | ClearCause | 252,885 | 0.00253 | 7.59 |  |
| Reject campaign (admin) | ClearCause | 39,577 | 0.00040 | 1.19 |  |
| Donate (first donation to a campaign) | ClearCause | 496,659 | 0.00497 | 14.90 | mints receipt NFT |
| Donate (same donor, second time) | ClearCause | 366,409 | 0.00366 | 10.99 | donor already has stats |
| Donate (new donor, campaign has 2 donations) | ClearCause | 470,859 | 0.00471 | 14.13 |  |
| Donate (repeat donor, campaign already has 24 donations) | ClearCause | 366,311 | 0.00366 | 10.99 | scaling check: should stay flat |
| Donate (repeat donor, campaign already has 49 donations) | ClearCause | 366,311 | 0.00366 | 10.99 | scaling check: should stay flat |
| Donate (repeat donor, campaign already has 99 donations) | ClearCause | 366,311 | 0.00366 | 10.99 | scaling check: should stay flat |
| Withdraw funds (successful campaign) | ClearCause | 75,350 | 0.00075 | 2.26 | pays the approved payout address |
| Suspend campaign (admin) | ClearCause | 54,103 | 0.00054 | 1.62 | opens refunds |
| Claim refund | ClearCause | 64,653 | 0.00065 | 1.94 |  |
| Check campaign status (marks Failed) | ClearCause | 56,746 | 0.00057 | 1.70 |  |
| Create milestone-adjustment proposal | ClearCause | 327,536 | 0.00328 | 9.83 | needs KYC |
