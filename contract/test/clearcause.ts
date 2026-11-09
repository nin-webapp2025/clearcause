import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { KYCManager, ClearCause } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ClearCause", () => {
  async function deployClearCauseFixture() {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const KYCManager = await ethers.getContractFactory("KYCManager");
    const kycManager = await KYCManager.deploy();

    const ClearCause = await ethers.getContractFactory("ClearCause");
    const clearCause = await ClearCause.deploy(
      await kycManager.getAddress(),
      1
    ); // quorum of 1 vote (votes are counted as donation NFTs held)

    await kycManager.connect(owner).submitKYC(ethers.id("owner-proof"));
    await kycManager.connect(addr1).submitKYC(ethers.id("user1-proof"));
    await kycManager.connect(addr2).submitKYC(ethers.id("user2-proof"));

    // Verify KYC for testing addresses
    await kycManager.connect(owner).verifyKYC(await owner.getAddress(), true);
    await kycManager.connect(owner).verifyKYC(await addr1.getAddress(), true);
    await kycManager.connect(owner).verifyKYC(await addr2.getAddress(), true);

    // Fund accounts with ETH for testing
    await owner.sendTransaction({
      to: addr1.address,
      value: ethers.parseEther("100"),
    });
    await owner.sendTransaction({
      to: addr2.address,
      value: ethers.parseEther("100"),
    });

    return { kycManager, clearCause, owner, addr1, addr2, addr3 };
  }

  describe("KYCManager", () => {
    let kycManager: KYCManager;
    let owner: SignerWithAddress,
      addr1: SignerWithAddress,
      addr2: SignerWithAddress;

    beforeEach(async () => {
      ({ kycManager, owner, addr1, addr2 } = await loadFixture(
        deployClearCauseFixture
      ));
    });

    it("Should set the right owner", async () => {
      expect(await kycManager.owner()).to.equal(await owner.getAddress());
    });

    it("stores only the submitted proof hash", async () => {
      const proof = ethers.id("updated-proof");
      await kycManager.connect(addr1).submitKYC(proof);
      const [storedProof, submitted, isVerified] = await kycManager.getKYCProof(addr1.address);
      expect(storedProof).to.equal(proof);
      expect(submitted).to.be.true;
      expect(isVerified).to.be.false;
    });

    it("rejects an empty proof", async () => {
      await expect(kycManager.connect(addr1).submitKYC(ethers.ZeroHash)).to.be.revertedWith("Proof is required");
    });

    it("Should allow owner to verify KYC", async () => {
      await kycManager.connect(addr1).submitKYC(ethers.id("proof"));
      await kycManager.connect(owner).verifyKYC(await addr1.getAddress(), true);
      expect(await kycManager.isUserVerified(await addr1.getAddress())).to.be
        .true;
    });

    it("Should not allow non-owner to verify KYC", async () => {
      await kycManager.connect(addr1).submitKYC(ethers.id("proof"));
      await expect(
        kycManager.connect(addr2).verifyKYC(await addr1.getAddress(), true)
      ).to.be.revertedWithCustomError(kycManager, "OwnableUnauthorizedAccount");
    });

    it("Should return pending verifications", async () => {
      await kycManager.connect(addr1).submitKYC(ethers.id("proof-1"));
      await kycManager.connect(addr2).submitKYC(ethers.id("proof-2"));
      const pendingVerifications = await kycManager.getPendingVerifications();
      expect(pendingVerifications).to.have.lengthOf(2);
      expect(pendingVerifications).to.include(await addr1.getAddress());
      expect(pendingVerifications).to.include(await addr2.getAddress());
    });

    it("Should return correct pending verification count", async () => {
      await kycManager.connect(addr1).submitKYC(ethers.id("proof-1"));
      await kycManager.connect(addr2).submitKYC(ethers.id("proof-2"));
      expect(await kycManager.getPendingVerificationCount()).to.equal(2);
    });

    it("does not add duplicate pending entries when a user resubmits", async () => {
      await kycManager.connect(addr1).submitKYC(ethers.id("updated"));
      await kycManager.connect(addr1).submitKYC(ethers.id("updated-again"));

      expect(await kycManager.getPendingVerificationCount()).to.equal(1);
      expect(await kycManager.getPendingVerifications()).to.deep.equal([addr1.address]);
    });
  });

  describe("ClearCause", () => {
    const DAY = 24 * 60 * 60;
    const Status = {
      Active: 0,
      Successful: 1,
      Failed: 2,
      Paid: 3,
      Pending: 4,
      Rejected: 5,
      Suspended: 6,
    };

    let clearCause: ClearCause;
    let owner: SignerWithAddress,
      addr1: SignerWithAddress,
      addr2: SignerWithAddress,
      addr3: SignerWithAddress;

    beforeEach(async () => {
      ({ clearCause, owner, addr1, addr2, addr3 } = await loadFixture(
        deployClearCauseFixture
      ));
    });

    // addr1 is the campaign creator, owner is the admin, addr2 is a donor.
    async function createCampaign(target = "10", days = 3) {
      const now = await time.latest();
      await clearCause
        .connect(addr1)
        .createCampaign(
          "Test Campaign",
          "Description",
          ethers.parseEther(target),
          now + days * DAY,
          "ipfs://image",
          []
        );
      return (await clearCause.getAllCampaigns()).length - 1;
    }

    async function createApprovedCampaign(target = "10", days = 3) {
      const id = await createCampaign(target, days);
      await clearCause.connect(owner).approveCampaign(id);
      return id;
    }

    describe("Campaign creation", () => {
      it("creates a campaign in Pending status", async () => {
        const now = await time.latest();
        await expect(
          clearCause
            .connect(addr1)
            .createCampaign(
              "Test Campaign",
              "Description",
              ethers.parseEther("10"),
              now + 3 * DAY,
              "ipfs://image",
              []
            )
        )
          .to.emit(clearCause, "CampaignCreated")
          .withArgs(
            0,
            addr1.address,
            "Test Campaign",
            ethers.parseEther("10"),
            anyValue
          );

        const campaign = await clearCause.getCampaign(0);
        expect(campaign.status).to.equal(Status.Pending);
        expect(campaign.owner).to.equal(addr1.address);
        expect(await clearCause.getUserCampaigns(addr1.address)).to.deep.equal([
          0n,
        ]);
      });

      it("rejects creators who are not KYC verified", async () => {
        const stranger = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({
          to: stranger.address,
          value: ethers.parseEther("1"),
        });
        const now = await time.latest();
        await expect(
          clearCause
            .connect(stranger)
            .createCampaign(
              "Test",
              "Description",
              ethers.parseEther("10"),
              now + DAY * 2,
              "ipfs://image",
              []
            )
        ).to.be.revertedWithCustomError(clearCause, "InvalidKYC");
      });

      it("rejects a target below the minimum", async () => {
        const now = await time.latest();
        await expect(
          clearCause
            .connect(addr1)
            .createCampaign(
              "Test",
              "Description",
              ethers.parseEther("0.01"),
              now + DAY * 2,
              "ipfs://image",
              []
            )
        ).to.be.revertedWithCustomError(clearCause, "InvalidAmount");
      });

      it("rejects a deadline in the past", async () => {
        const now = await time.latest();
        await expect(
          clearCause
            .connect(addr1)
            .createCampaign(
              "Test",
              "Description",
              ethers.parseEther("10"),
              now - 10,
              "ipfs://image",
              []
            )
        ).to.be.revertedWithCustomError(clearCause, "DeadlinePassed");
      });

      it("rejects a campaign shorter than the minimum duration", async () => {
        const now = await time.latest();
        await expect(
          clearCause
            .connect(addr1)
            .createCampaign(
              "Too short",
              "Description",
              ethers.parseEther("10"),
              now + 60,
              "ipfs://image",
              []
            )
        ).to.be.revertedWithCustomError(clearCause, "InvalidDuration");
      });

      it("returns an empty page when pagination starts past the end", async () => {
        await createCampaign();
        expect(await clearCause.getCampaignsPaginated(10, 5)).to.deep.equal([]);
      });

      it("does not award reputation until the campaign is approved", async () => {
        const id = await createCampaign();
        expect((await clearCause.getUserStats(addr1.address)).reputationScore).to.equal(
          0
        );
        await clearCause.connect(owner).approveCampaign(id);
        expect((await clearCause.getUserStats(addr1.address)).reputationScore).to.equal(
          20
        );
      });
    });

    describe("Campaign review (admin)", () => {
      it("admin approves a pending campaign", async () => {
        const id = await createCampaign();
        await expect(clearCause.connect(owner).approveCampaign(id))
          .to.emit(clearCause, "CampaignApproved")
          .withArgs(id, owner.address);
        expect((await clearCause.getCampaign(id)).status).to.equal(Status.Active);
      });

      it("non-admin cannot approve or reject", async () => {
        const id = await createCampaign();
        await expect(
          clearCause.connect(addr2).approveCampaign(id)
        ).to.be.revertedWithCustomError(
          clearCause,
          "AccessControlUnauthorizedAccount"
        );
        await expect(
          clearCause.connect(addr1).approveCampaign(id)
        ).to.be.revertedWithCustomError(
          clearCause,
          "AccessControlUnauthorizedAccount"
        );
        await expect(
          clearCause.connect(addr2).rejectCampaign(id, "no")
        ).to.be.revertedWithCustomError(
          clearCause,
          "AccessControlUnauthorizedAccount"
        );
      });

      it("cannot approve the same campaign twice", async () => {
        const id = await createApprovedCampaign();
        await expect(
          clearCause.connect(owner).approveCampaign(id)
        ).to.be.revertedWithCustomError(clearCause, "InvalidStatus");
      });

      it("cannot approve a campaign whose deadline has passed", async () => {
        const id = await createCampaign("10", 2);
        await time.increase(3 * DAY);
        await expect(
          clearCause.connect(owner).approveCampaign(id)
        ).to.be.revertedWithCustomError(clearCause, "DeadlinePassed");
      });

      it("admin rejects a pending campaign with a reason", async () => {
        const id = await createCampaign();
        await expect(
          clearCause.connect(owner).rejectCampaign(id, "Documents do not match")
        )
          .to.emit(clearCause, "CampaignRejected")
          .withArgs(id, owner.address, "Documents do not match");
        expect((await clearCause.getCampaign(id)).status).to.equal(
          Status.Rejected
        );
      });

      it("cannot reject a campaign that is already active", async () => {
        const id = await createApprovedCampaign();
        await expect(
          clearCause.connect(owner).rejectCampaign(id, "too late")
        ).to.be.revertedWithCustomError(clearCause, "InvalidStatus");
      });
    });

    describe("Donations", () => {
      it("blocks donations to pending and rejected campaigns", async () => {
        const pendingId = await createCampaign();
        await expect(
          clearCause
            .connect(addr2)
            .donateCampaign(pendingId, { value: ethers.parseEther("1") })
        ).to.be.revertedWithCustomError(clearCause, "InvalidStatus");

        await clearCause.connect(owner).rejectCampaign(pendingId, "no");
        await expect(
          clearCause
            .connect(addr2)
            .donateCampaign(pendingId, { value: ethers.parseEther("1") })
        ).to.be.revertedWithCustomError(clearCause, "InvalidStatus");
      });

      it("accepts a donation to an active campaign and mints a receipt NFT", async () => {
        const id = await createApprovedCampaign();
        const amount = ethers.parseEther("1");
        await expect(
          clearCause.connect(addr2).donateCampaign(id, { value: amount })
        )
          .to.emit(clearCause, "DonationMade")
          .withArgs(id, addr2.address, amount, 0);

        const campaign = await clearCause.getCampaign(id);
        expect(campaign.amountCollected).to.equal(amount);
        expect(campaign.donators).to.deep.equal([addr2.address]);
        expect(await clearCause.balanceOf(addr2.address)).to.equal(1);
      });

      it("rejects a zero-value donation", async () => {
        const id = await createApprovedCampaign();
        await expect(
          clearCause.connect(addr2).donateCampaign(id, { value: 0 })
        ).to.be.revertedWithCustomError(clearCause, "InvalidAmount");
      });

      it("rejects donations after the deadline", async () => {
        const id = await createApprovedCampaign("10", 2);
        await time.increase(3 * DAY);
        await expect(
          clearCause
            .connect(addr2)
            .donateCampaign(id, { value: ethers.parseEther("1") })
        ).to.be.revertedWithCustomError(clearCause, "DeadlinePassed");
      });

      it("marks the campaign Successful when the target is reached", async () => {
        const id = await createApprovedCampaign("10");
        await expect(
          clearCause
            .connect(addr2)
            .donateCampaign(id, { value: ethers.parseEther("10") })
        )
          .to.emit(clearCause, "CampaignStatusChanged")
          .withArgs(id, Status.Successful);
      });

      it("blocks donations while the contract is paused", async () => {
        const id = await createApprovedCampaign();
        await clearCause.connect(owner).pause();
        await expect(
          clearCause
            .connect(addr2)
            .donateCampaign(id, { value: ethers.parseEther("1") })
        ).to.be.revertedWithCustomError(clearCause, "EnforcedPause");
      });
    });

    describe("Payout", () => {
      async function fundedCampaign() {
        const id = await createApprovedCampaign("10");
        await clearCause
          .connect(addr2)
          .donateCampaign(id, { value: ethers.parseEther("10") });
        return id;
      }

      it("pays the campaign owner by default", async () => {
        const id = await fundedCampaign();
        expect(await clearCause.getPayoutAddress(id)).to.equal(addr1.address);

        const tx = clearCause.connect(addr1).withdrawCampaignFunds(id);
        await expect(tx)
          .to.emit(clearCause, "CampaignPaidOut")
          .withArgs(id, addr1.address, ethers.parseEther("10"));
        await expect(tx).to.changeEtherBalance(
          addr1,
          ethers.parseEther("10")
        );
        expect((await clearCause.getCampaign(id)).status).to.equal(Status.Paid);
      });

      it("pays the payout address chosen before approval", async () => {
        const id = await createCampaign("10");
        await expect(
          clearCause.connect(addr1).setPayoutAddress(id, addr3.address)
        )
          .to.emit(clearCause, "PayoutAddressSet")
          .withArgs(id, addr3.address);
        await clearCause.connect(owner).approveCampaign(id);
        await clearCause
          .connect(addr2)
          .donateCampaign(id, { value: ethers.parseEther("10") });

        await expect(
          clearCause.connect(addr1).withdrawCampaignFunds(id)
        ).to.changeEtherBalance(addr3, ethers.parseEther("10"));
      });

      it("locks the payout address once the campaign is approved", async () => {
        const id = await createApprovedCampaign();
        await expect(
          clearCause.connect(addr1).setPayoutAddress(id, addr3.address)
        ).to.be.revertedWithCustomError(clearCause, "InvalidStatus");
      });

      it("only the campaign owner can set the payout address", async () => {
        const id = await createCampaign();
        await expect(
          clearCause.connect(addr2).setPayoutAddress(id, addr3.address)
        ).to.be.revertedWithCustomError(clearCause, "Unauthorized");
        await expect(
          clearCause.connect(addr1).setPayoutAddress(id, ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(clearCause, "InvalidAddress");
      });

      it("only the campaign owner can withdraw", async () => {
        const id = await fundedCampaign();
        await expect(
          clearCause.connect(addr2).withdrawCampaignFunds(id)
        ).to.be.revertedWithCustomError(clearCause, "Unauthorized");
      });

      it("cannot withdraw before the target is reached", async () => {
        const id = await createApprovedCampaign("10");
        await clearCause
          .connect(addr2)
          .donateCampaign(id, { value: ethers.parseEther("1") });
        await expect(
          clearCause.connect(addr1).withdrawCampaignFunds(id)
        ).to.be.revertedWithCustomError(clearCause, "InvalidStatus");
      });

      it("cannot withdraw twice", async () => {
        const id = await fundedCampaign();
        await clearCause.connect(addr1).withdrawCampaignFunds(id);
        await expect(
          clearCause.connect(addr1).withdrawCampaignFunds(id)
        ).to.be.revertedWithCustomError(clearCause, "InvalidStatus");
      });
    });

    describe("Failed campaigns and refunds", () => {
      it("lets donors reclaim funds once, after the campaign fails", async () => {
        const id = await createApprovedCampaign("10", 2);
        const amount = ethers.parseEther("3");
        await clearCause.connect(addr2).donateCampaign(id, { value: amount });

        await time.increase(3 * DAY);
        await clearCause.checkCampaignStatus(id);
        expect((await clearCause.getCampaign(id)).status).to.equal(Status.Failed);

        await expect(
          clearCause.connect(addr2).claimRefund(id)
        ).to.changeEtherBalance(addr2, amount);
        await expect(
          clearCause.connect(addr2).claimRefund(id)
        ).to.be.revertedWithCustomError(clearCause, "RefundAlreadyClaimed");
      });

      it("does not refund while the campaign is still active", async () => {
        const id = await createApprovedCampaign();
        await clearCause
          .connect(addr2)
          .donateCampaign(id, { value: ethers.parseEther("1") });
        await expect(
          clearCause.connect(addr2).claimRefund(id)
        ).to.be.revertedWithCustomError(clearCause, "CampaignNotFailed");
      });
    });

    describe("Suspension (fraud response)", () => {
      it("admin suspends an active campaign and donors can be refunded", async () => {
        const id = await createApprovedCampaign("10");
        const amount = ethers.parseEther("2");
        await clearCause.connect(addr2).donateCampaign(id, { value: amount });

        await expect(
          clearCause.connect(owner).suspendCampaign(id, "Fraud alert: duplicate beneficiary")
        )
          .to.emit(clearCause, "CampaignSuspended")
          .withArgs(id, owner.address, "Fraud alert: duplicate beneficiary");
        expect((await clearCause.getCampaign(id)).status).to.equal(
          Status.Suspended
        );

        // no new donations
        await expect(
          clearCause
            .connect(addr3)
            .donateCampaign(id, { value: ethers.parseEther("1") })
        ).to.be.revertedWithCustomError(clearCause, "InvalidStatus");

        // refund works
        await expect(
          clearCause.connect(addr2).claimRefund(id)
        ).to.changeEtherBalance(addr2, amount);
      });

      it("a suspended campaign that had reached its target cannot be withdrawn", async () => {
        const id = await createApprovedCampaign("10");
        await clearCause
          .connect(addr2)
          .donateCampaign(id, { value: ethers.parseEther("10") });
        await clearCause.connect(owner).suspendCampaign(id, "Suspicious");

        await expect(
          clearCause.connect(addr1).withdrawCampaignFunds(id)
        ).to.be.revertedWithCustomError(clearCause, "InvalidStatus");
        await expect(
          clearCause.connect(addr2).claimRefund(id)
        ).to.changeEtherBalance(addr2, ethers.parseEther("10"));
      });

      it("only an admin can suspend", async () => {
        const id = await createApprovedCampaign();
        await expect(
          clearCause.connect(addr1).suspendCampaign(id, "x")
        ).to.be.revertedWithCustomError(
          clearCause,
          "AccessControlUnauthorizedAccount"
        );
      });

      it("cannot suspend pending or already paid campaigns", async () => {
        const pendingId = await createCampaign();
        await expect(
          clearCause.connect(owner).suspendCampaign(pendingId, "x")
        ).to.be.revertedWithCustomError(clearCause, "InvalidStatus");

        const id = await createApprovedCampaign("10");
        await clearCause
          .connect(addr2)
          .donateCampaign(id, { value: ethers.parseEther("10") });
        await clearCause.connect(addr1).withdrawCampaignFunds(id);
        await expect(
          clearCause.connect(owner).suspendCampaign(id, "x")
        ).to.be.revertedWithCustomError(clearCause, "InvalidStatus");
      });

      it("suspension still works while the contract is paused", async () => {
        const id = await createApprovedCampaign();
        await clearCause.connect(owner).pause();
        await expect(clearCause.connect(owner).suspendCampaign(id, "emergency"))
          .to.emit(clearCause, "CampaignSuspended");
      });
    });

    describe("Governance", () => {
      async function campaignWithDonor() {
        const id = await createApprovedCampaign("10");
        await clearCause
          .connect(addr2)
          .donateCampaign(id, { value: ethers.parseEther("1") });
        return id;
      }

      it("creates a proposal and rejects an invalid voting period", async () => {
        const id = await campaignWithDonor();
        const milestones = [ethers.parseEther("4"), ethers.parseEther("6")];
        await expect(
          clearCause.connect(addr1).createProposal(id, "Test Proposal", 2 * DAY, 1, milestones)
        ).to.emit(clearCause, "ProposalCreated");
        const proposal = (await clearCause.getAllProposals())[0];
        expect(proposal.description).to.equal("Test Proposal");

        await expect(
          clearCause.connect(addr1).createProposal(id, "Too short", 10, 1, milestones)
        ).to.be.revertedWithCustomError(clearCause, "InvalidDuration");
      });

      it("rejects fund-allocation proposals because they have no execution semantics", async () => {
        const id = await campaignWithDonor();
        await expect(
          clearCause.connect(addr1).createProposal(id, "Allocate", 2 * DAY, 0, [])
        ).to.be.revertedWithCustomError(clearCause, "InvalidProposalType");
      });

      it("only donors holding a receipt NFT can vote, and only once", async () => {
        const id = await campaignWithDonor();
        await clearCause
          .connect(addr1)
          .createProposal(id, "Test", 2 * DAY, 1, [ethers.parseEther("10")]);

        await expect(
          clearCause.connect(addr3).voteOnProposal(1, true)
        ).to.be.revertedWithCustomError(clearCause, "InvalidKYC");
        await expect(
          clearCause.connect(addr1).voteOnProposal(1, true)
        ).to.be.revertedWithCustomError(clearCause, "Unauthorized");

        await clearCause.connect(addr2).voteOnProposal(1, true);
        await expect(
          clearCause.connect(addr2).voteOnProposal(1, true)
        ).to.be.revertedWithCustomError(clearCause, "AlreadyVoted");
      });

      it("does not count the same receipt twice after it is transferred", async () => {
        const id = await campaignWithDonor();
        await clearCause
          .connect(addr1)
          .createProposal(id, "Test", 2 * DAY, 1, [ethers.parseEther("10")]);

        await clearCause.connect(addr2).voteOnProposal(1, true);
        await clearCause.connect(addr2).transferFrom(addr2.address, addr1.address, 0);
        await expect(
          clearCause.connect(addr1).voteOnProposal(1, true)
        ).to.be.revertedWithCustomError(clearCause, "Unauthorized");
      });

      it("does not allow voting after the voting period", async () => {
        const id = await campaignWithDonor();
        await clearCause
          .connect(addr1)
          .createProposal(id, "Test", 1 * DAY, 1, [ethers.parseEther("10")]);
        await time.increase(2 * DAY);
        await expect(
          clearCause.connect(addr2).voteOnProposal(1, true)
        ).to.be.revertedWithCustomError(clearCause, "DeadlinePassed");
      });

      it("executes a milestone adjustment that passed quorum", async () => {
        const id = await campaignWithDonor();
        const newMilestones = [ethers.parseEther("4"), ethers.parseEther("6")];
        await clearCause
          .connect(addr1)
          .createProposal(id, "Adjust", 1 * DAY, 1, newMilestones);
        await clearCause.connect(addr2).voteOnProposal(1, true);

        await expect(clearCause.executeProposal(1)).to.be.revertedWithCustomError(
          clearCause,
          "ProposalStillActive"
        );
        await time.increase(2 * DAY);
        await expect(clearCause.executeProposal(1))
          .to.emit(clearCause, "ProposalExecuted")
          .withArgs(1, true);
        expect((await clearCause.getCampaign(id)).milestones).to.deep.equal(
          newMilestones
        );
      });
    });
  });
});
