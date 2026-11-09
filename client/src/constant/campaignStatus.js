// Order must match the CampaignStatus enum in ClearCause.sol.
// New statuses are appended, so 0-3 are unchanged from the original project.
export const CAMPAIGN_STATUS = [
  "Active", // 0
  "Successful", // 1
  "Failed", // 2
  "Paid", // 3
  "Pending", // 4  waiting for admin review
  "Rejected", // 5  admin declined it
  "Suspended", // 6  admin froze it; donors can claim refunds
];

export const statusText = (n) => CAMPAIGN_STATUS[Number(n)] ?? "Unknown";

// Statuses where donors can reclaim their money.
export const REFUNDABLE = ["Failed", "Suspended"];

// Statuses that should not appear in the public listing.
export const HIDDEN_FROM_PUBLIC = ["Pending", "Rejected"];
