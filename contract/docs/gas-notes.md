# Reading the gas report (for the evaluation chapter)

Run `npm run gas:report` in `contract/` to regenerate `gas-report.md` / `.json`.

1. **Donating is the expensive action: about 366,000 to 497,000 gas**, roughly 17 to 24 times a plain ETH transfer (21,000).
   Most of it is minting the receipt NFT plus storing donor statistics and reputation. This is the price of the
   transparency feature (every donation gets a verifiable on-chain receipt), and a fair trade-off to discuss.
2. **A donor's first-ever donation costs about 100,000 gas more** than a repeat donor (about 497k / 471k vs 366k)
   because their statistics are written to storage for the first time.
3. **Cost does not grow with campaign size.** A repeat donor pays the same 366,366 gas whether the campaign has 24, 49 or
   99 donations earlier. This is good scalability evidence for the write path. (Read functions that return all donors
   of a campaign do grow, which is why the website reads donations from events instead.)
4. **Admin actions are cheap**: approve about 84k, reject about 40k, suspend about 54k. The review step that makes
   fraud prevention possible adds little cost per campaign.
5. **Deploying ClearCause costs about 5.5 million gas** (one time), far below the block limit but close to the
   contract-size limit (see PROVENANCE.md).
6. The fraud-detection service costs **no gas**: it runs off-chain and only advises. This is why the detection logic
   was kept out of the contract.

Caveats: ETH and USD columns assume a gas price and ETH price (defaults 10 gwei and $3,000, set with
`GAS_PRICE_GWEI` and `ETH_USD`). I could not check current market prices, so quote the gas units and treat the
money figures as illustrative. Measurements are from a local chain with the optimiser at runs=1.
