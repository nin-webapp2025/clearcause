"use client";

import { useState } from "react";
import { Sidebar } from "../Sidebar";
import { Header } from "./Header";
import DashboardContent from "./DashboardContent";
import CampaignManagement from "./CampaignManagement";
import DonationManagement from "./DonationManagement";
import GovernanceManagement from "./GovernanceManagement";
import KYCVerification from "./KYCVerification";
import NFTManagement from "./NFTManagement";
import Notifications from "./Notifications";

function Dashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardContent />;
      case "campaigns":
        return <CampaignManagement />;
      case "donations":
        return <DonationManagement />;
      case "governance":
        return <GovernanceManagement />;
      case "kyc":
        return <KYCVerification />;
      case "nfts":
        return <NFTManagement />;
      default:
        return <DashboardContent />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      <Sidebar setActiveSection={setActiveSection} />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-100">
          <div className="max-w-7xl mx-auto">{renderContent()}</div>
        </main>
      </div>
      <Notifications />
    </div>
  );
}

export default Dashboard;
