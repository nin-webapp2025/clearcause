import { Routes, Route } from "react-router-dom";

import { Sidebar } from "../components/Dashboard/Sidebar";
import { DashboardHeader } from "../components/Dashboard/DashboardHeader";
import DashboardContent from "../components/Dashboard/DashboardContent";
import CampaignListing from "../components/campaign/CampaignListing";
import CampaignDetails from "../components/campaign/CampaignDetails";
import Governance from "../components/Governance/Governance";
import ProposalDetails from "../components/Governance/ProposalDetails"; // Add this import
import NFTs from "../components/campaign/NFTs";
import CreateCampaign from "../components/campaign/CreateCampaign";
import { KYCStatus } from "../components/KYC/KYCStatus";
import { KYCSubmissionForm } from "../components/KYC/KYCSubmissionForm";
import { KYCVerificationList } from "../components/KYC/KYCVerificationList";
import CampaignReview from "../components/Admin/CampaignReview";

function DashboardPage() {
  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto bg-neutral-50 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<DashboardContent />} />
              <Route path="/campaigns" element={<CampaignListing />} />
              <Route path="/create-campaign" element={<CreateCampaign />} />
              <Route path="/campaigns/:id" element={<CampaignDetails />} />
              <Route path="/governance" element={<Governance />} />
              <Route
                path="/governance/:proposalId"
                element={<ProposalDetails />}
              />{" "}
              {/* Add this route */}
              <Route path="/nfts" element={<NFTs />} />
              <Route path="/admin" element={<CampaignReview />} />
              <Route
                path="/kyc"
                element={
                  <div className="space-y-8">
                    <KYCStatus />
                    <KYCSubmissionForm />
                    <KYCVerificationList />
                  </div>
                }
              />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardPage;
