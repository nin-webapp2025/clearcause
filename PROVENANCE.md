# Provenance: what is inherited and what is original

## Upstream base
- Project: **Fundly** by Kanasjnr, https://github.com/Kanasjnr/Fundly
- License: MIT (SPDX headers in the contracts and a license statement in the upstream README).
  The upstream `LICENSE.md` file is missing and the copyright holder is not named, so the
  upstream author is credited by repository name. Keep the SPDX headers in all inherited files.
- Inherited: the main campaign contract (upstream `Fundly.sol`, renamed here to `ClearCause.sol`),
  `contract/contracts/KYCManager.sol`, the React client in `client/`, and the Hardhat project setup.
  Libraries: OpenZeppelin Contracts (MIT), Hardhat.
- **Renaming.** The product and the main contract were renamed from Fundly to **ClearCause** so the project
  has its own identity. The rename does not hide the origin: the MIT SPDX headers are kept, `ClearCause.sol`
  carries a header comment naming the upstream project and licence, and this file lists every inherited part.
  The upstream README is kept verbatim as `UPSTREAM_README.md`.
- The upstream `client/.env` (the original author's own keys and addresses) was deliberately NOT kept.

## Original work in this project

### Smart contract (`ClearCause.sol`)
- Campaigns are created as `Pending` instead of going live immediately.
- New admin-only `approveCampaign`, `rejectCampaign(reason)` and `suspendCampaign(reason)`.
  Suspension stops donations and withdrawals and opens refunds. It is the on-chain action that the
  fraud-detection service will trigger.
- New creator function `setPayoutAddress`, allowed only while Pending. After approval the payout address
  is locked, so the admin approves the exact address that will be paid.
- Withdrawals go to the approved payout address instead of always the creator's wallet.
- Refunds are available for Suspended campaigns as well as Failed ones.
- Reputation is awarded on approval, not on creation (prevents farming with spam campaigns).
- New events: `CampaignApproved`, `CampaignRejected`, `CampaignSuspended`, `PayoutAddressSet`.
- New statuses are appended to the enum (`Pending=4`, `Rejected=5`, `Suspended=6`).
- Removed `updateCampaignStatuses` (batch version of `checkCampaignStatus`) and set optimizer runs to 1
  to stay under the 24,576-byte contract size limit (currently about 24.5 KB).

### Tests
- Upstream tests targeted an older contract version and 12 of 19 failed. Rewritten and expanded: 47 tests, all passing,
  about 76% statement coverage of the main contract.
- Tests were checked by mutation: deliberately breaking the contract (skipping review, ignoring the payout
  address, no refund on suspend) makes tests fail.
- Governance now supports executable milestone-adjustment proposals only. Unsupported fund-allocation proposals
  are rejected, campaign owners cannot bypass voting by editing milestones directly, and each receipt NFT can
  contribute voting power only once per proposal even if it is transferred after voting.
- Campaign creation enforces the documented one-day minimum duration, and out-of-range campaign pagination
  returns an empty page rather than reverting.
- Repeated KYC submissions update the pending record without adding duplicate queue entries.
- `contract/scripts/e2e-local.mjs`: 28 end-to-end checks against a local chain, using the client's own ABI,
  status labels, event decoder and error decoder.

### Deployment tooling
- `contract/scripts/gas-report.ts` (`npm run gas:report`): measures gas per function; results and interpretation in `contract/docs/`.
- `contract/scripts/deploy.ts`: deploys both contracts, saves addresses, copies ABIs into the client and prints
  the `.env` lines. The governance quorum is a small vote count (default 3).

### Branding and landing page
- Renamed throughout to ClearCause, with an original logo (`client/public/logo.svg`). The upstream logo image
  was deleted rather than reused under a new name.
- The inherited landing page carried three invented testimonials ("John Doe", "Jane Smith", "Mike Johnson")
  and invented figures ("$10M+ raised", "50,000+ backers"). Rebranded, these would have read as false claims
  about this project, so both sections were removed. In their place, a `LiveStats` section counts the real
  campaigns, donations and ETH raised from the contract at page load, and says so when the chain is unreachable.
- The inherited feature list advertised "Decentralized Identity (DID)" and "Token-Gated Perks", neither of
  which the code implements. It was rewritten so that each of the six items maps to working, tested behaviour.
- The placeholder NFT metadata URL pointed at `api.fundly.com`, a domain this project does not control.
  It is now `clearcause://receipt/<campaignId>/<amount>`, which is plainly a demo identifier. A production
  system would serve real metadata from a URL it owns.

### One-command demo
- `start-demo.ps1` (Windows) and `start-demo.sh` (macOS/Linux) start the blockchain, deploy, seed demo
  campaigns, start the model and fraud service, and open the website, then shut it all down on Ctrl+C.

### Client
- Network switched from CrossFi to Sepolia (or a local chain), configurable through `.env`.
- Admin review screen (`components/Admin/CampaignReview.jsx`), visible only to wallets holding the admin role.
- Pending / Rejected / Suspended statuses in the listing and detail pages. Unreviewed campaigns are hidden from
  the public list (they show for the creator and admins).
- Donation history read from chain events with a transaction hash and block-explorer link for each donation.
- Payout address field when creating a campaign, and a form to change it while the campaign is pending.
- Banners explaining why a campaign cannot take donations, and refund wording for suspended campaigns.

### Fraud-detection layer (`fraud/`, entirely original; nothing inherited from Fundly)
- Feature extraction, rule engine, combination logic, chain reader and REST API (Node), 17 unit tests.
- Synthetic labelled data generator with five fraud typologies and a hard test set; Isolation Forest training and
  evaluation (rules vs model vs combined); Flask scoring API.
- Admin Campaign Review screen shows risk scores and reasons (`useFraudRisk.js`, `CampaignReview.jsx`).
- Integration demo on a local chain, including the admin acting on recommendations.
- Full description, results and limitations: `fraud/README.md`. Libraries: scikit-learn (BSD-3), Flask (BSD-3), Express (MIT), ethers (MIT).

## Upstream bugs found and fixed
1. **Event parsing never worked.** Ten hooks read `receipt.events`, an ethers v5 API, but the project uses
   ethers v6. Campaign IDs, donation token IDs and status changes were never read from receipts. Fixed with
   `lib/receiptEvents.js` (decodes `receipt.logs`).
2. **Custom errors were not recognised.** ethers v6 does not decode custom errors on sent transactions, so the
   hooks' `err.message.includes("InvalidStatus")` checks never matched. Fixed with `withRevertName`.
3. **Deploy script quorum.** Upstream deployed with a quorum of 5 ETH in wei while votes are counted as NFTs held, so
   no proposal could ever pass. Replaced.
4. The React context provider (upstream `FundlyContext.jsx`, now `ClearCauseContext.jsx`) used `useContext` without importing it.
5. Image uploads (campaign images **and the KYC ID document**) were hard-coded to the original author's Cloudinary account, so users' uploads would have gone to someone else. Now configured through `.env`, and the KYC form warns that submitted data is public on-chain (demo only).
6. The UI always assumed "refund not yet claimed" and only counted a donor's first donation. Now it reads
   `RefundClaimed` events and sums all donations.

## Known limitations (for the report)
- KYC data (name, email, ID number, ID image) is stored on-chain; "private" storage is still publicly readable.
  A real deployment would keep personal data off-chain.
- Governance votes count a donor's receipt NFTs across all campaigns. Transfers are supported, but a receipt
  that has already voted cannot vote again from its new wallet on the same proposal.
- The compiled contract is 24,268 bytes, 308 bytes below the 24,576-byte deployment limit.
- Receipt NFT metadata uses the demo-only `clearcause://receipt/<campaignId>/<amount>` identifier; it is not
  hosted JSON metadata suitable for production wallets or marketplaces.
- The admin is a single wallet (deployer). A production system would use a multi-signature wallet.
- KYC verification authority belongs to the owner of `KYCManager`, while campaign review uses ClearCause's
  `ADMIN_ROLE`. Deployment assigns both to the deployer, but transferring or granting either role does not
  automatically transfer the other.

## Still to do
- Deploy to Sepolia and test the UI with a real wallet (needs your RPC URL, test ETH and Reown project ID).
- The report itself (gas and detection results are ready to cite).
- Optional: allow-list of verified charity payout wallets (main false-positive source), and a real-data check of the fraud layer if any labelled data can be found.
