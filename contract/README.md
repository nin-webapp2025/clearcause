# ClearCause contracts

`ClearCause.sol` implements reviewed charity campaigns, donation receipt NFTs, locked payout wallets,
milestone governance, withdrawals, suspension and donor refunds. `KYCManager.sol` contains the demonstration
KYC gate. Its submitted identity fields are public blockchain data and must never contain real documents.

Governance supports milestone-adjustment proposals only. Receipt NFTs supply voting power, and each receipt can
be counted once per proposal even if it is later transferred. KYC ownership and the campaign `ADMIN_ROLE` are
separate authorities; the deployment script initially assigns both to the deployer.

```shell
npm install
npm test
npm run node
npm run deploy:local
npm run gas:report
```

The test suite currently contains 47 passing cases. Local deployment exports fresh ABIs to `client/src/abis`.
