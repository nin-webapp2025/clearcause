"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import {
  Loader2,
  Filter,
  ArrowUpDown,
  Plus,
  Calendar,
  Users,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import useGetCampaign from "../../hooks/Campaign Data Retrieval/useGetCampaign";
import { useAppKitAccount } from "@reown/appkit/react";
import useIsAdmin from "../../hooks/Admin/useIsAdmin";
import { HIDDEN_FROM_PUBLIC } from "../../constant/campaignStatus";
import campaignFallback from "../../assets/clearcause-hero.png";

const CampaignListing = () => {
  const { getAllCampaigns, loading, error, isContractReady } = useGetCampaign();
  const [campaigns, setCampaigns] = useState([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("deadline");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { address } = useAppKitAccount();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!isContractReady) return;

      setIsLoading(true);
      try {
        const campaignsData = await getAllCampaigns();
        if (campaignsData) {
          setCampaigns(campaignsData);
          setFilteredCampaigns(campaignsData);
        }
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
        toast.error("Failed to load campaigns");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [getAllCampaigns, isContractReady]);

  useEffect(() => {
    // Campaigns still under review (or rejected) are only shown to their creator and to admins
    let filtered = campaigns.filter(
      (campaign) =>
        !HIDDEN_FROM_PUBLIC.includes(campaign.statusText) ||
        isAdmin ||
        (address && campaign.owner?.toLowerCase() === address.toLowerCase())
    );

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (campaign) => campaign.statusText.toLowerCase() === statusFilter
      );
    }

    if (sortBy === "deadline") {
      filtered.sort((a, b) => Number(a.deadline) - Number(b.deadline));
    } else if (sortBy === "amountCollected") {
      filtered.sort(
        (a, b) =>
          Number.parseFloat(b.amountCollected) -
          Number.parseFloat(a.amountCollected)
      );
    } else if (sortBy === "backers") {
      filtered.sort(
        (a, b) => b.analytics.totalBackers - a.analytics.totalBackers
      );
    } else if (sortBy === "progress") {
      filtered.sort(
        (a, b) => b.analytics.fundingProgress - a.analytics.fundingProgress
      );
    }

    setFilteredCampaigns(filtered);
  }, [campaigns, statusFilter, sortBy, address, isAdmin]);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Active":
        return "bg-blue-500 text-white";
      case "Successful":
        return "bg-green-500 text-white";
      case "Failed":
        return "bg-red-500 text-white";
      case "Paid":
        return "bg-purple-500 text-white";
      case "Pending":
        return "bg-amber-500 text-white";
      case "Rejected":
        return "bg-red-700 text-white";
      case "Suspended":
        return "bg-orange-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds <= 0) return "Ended";

    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} left`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} left`;
    } else {
      return "Ending soon";
    }
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><p className="mb-1 text-sm font-semibold text-emerald-700">Give where it matters</p><h1 className="text-3xl font-semibold text-neutral-950">Find a cause</h1><p className="mt-2 max-w-xl text-sm text-neutral-500">Every public campaign has passed review. Open one to see its goal, progress, and on-chain donation history.</p></div>
        <Button className="bg-coral-500 hover:bg-coral-600" onClick={() => navigate("/dashboard/create-campaign")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      <div className="flex flex-col gap-3 border-y border-neutral-200 bg-white py-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="successful">Successful</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="paid">Paid Out</SelectItem>
              <SelectItem value="pending">Awaiting Review</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deadline">
                <div className="flex items-center">
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>Deadline</span>
                </div>
              </SelectItem>
              <SelectItem value="amountCollected">
                <div className="flex items-center">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  <span>Amount Raised</span>
                </div>
              </SelectItem>
              <SelectItem value="backers">
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  <span>Backers</span>
                </div>
              </SelectItem>
              <SelectItem value="progress">
                <div className="flex items-center">
                  <Progress className="mr-2 h-4 w-4" />
                  <span>Progress</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading || isLoading ? (
        <div className="flex flex-col justify-center items-center h-64 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading campaigns...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCampaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="group overflow-hidden border-neutral-200 shadow-sm transition-shadow hover:shadow-md"
            >
              <CardHeader className="relative p-0">
                <img
                  src={
                    campaign.image || campaignFallback
                  }
                  alt={campaign.title}
                  className="aspect-[16/10] w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = campaignFallback;
                  }}
                />
                <div
                  className={`absolute right-3 top-3 px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
                    campaign.statusText
                  )}`}
                >
                  {campaign.statusText}
                </div>
                {campaign.statusText === "Active" &&
                  campaign.analytics.timeRemaining > 0 && (
                    <div className="absolute bottom-3 left-3 bg-black/70 px-2 py-1 text-xs text-white backdrop-blur-sm">
                      {formatTimeRemaining(campaign.analytics.timeRemaining)}
                    </div>
                  )}
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <CardTitle className="line-clamp-1 text-lg">
                  {campaign.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {campaign.description}
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Raised</span>
                    <span className="font-medium">
                      {campaign.amountCollected} ETH / {campaign.target} ETH
                    </span>
                  </div>
                  <Progress
                    value={campaign.analytics.fundingProgress}
                    className="h-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Backers</span>
                    <p className="font-medium">
                      {campaign.analytics.totalBackers}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Deadline</span>
                    <p className="font-medium">
                      {new Date(
                        Number(campaign.deadline) * 1000
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Link
                  to={`/dashboard/campaigns/${campaign.id}`}
                  className="w-full"
                >
                  <Button
                    className="w-full bg-emerald-700 hover:bg-emerald-800"
                    variant="default"
                  >
                    View cause
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {filteredCampaigns.length === 0 && !loading && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-muted rounded-lg">
          <div className="text-center space-y-3">
            <h3 className="text-lg font-medium">No campaigns found</h3>
            <p className="text-muted-foreground">
              {statusFilter !== "all"
                ? `There are no ${statusFilter} campaigns at the moment.`
                : "There are no campaigns available right now."}
            </p>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => navigate("/dashboard/create-campaign")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create a Campaign
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignListing;
