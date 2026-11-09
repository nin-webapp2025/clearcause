"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { BarChart, Rocket, Coins, Users, Loader2, RefreshCw } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { useAppKitAccount } from "@reown/appkit/react"
import ActivityFeed from "./ActivityFeed"
import Analytics from "./Analytics"
import AchievementBadges from "./AchievementBadges"
import useGetUserStats from "../../hooks/User Data/useGetUserStats"
import useGetUserActivities from "../../hooks/User Data/useGetUserActivities"
import { Button } from "../ui/button"
import { toast } from "react-toastify"
import NotificationCenter from "./NotificationCenter"
import { Alert, AlertDescription } from "../ui/alert"
import { AlertCircle } from "lucide-react"

const TIER_NAMES = {
  0: "Novice",
  1: "Contributor",
  2: "Influencer",
  3: "Leader",
  4: "Expert",
}

const POINTS_PER_TIER = 100 // Assuming 100 points per tier

const DashboardContent = () => {
  const { address, isConnected } = useAppKitAccount()
  const { getUserStats, loading, error: statsError } = useGetUserStats()
  const [stats, setStats] = useState(null)
  const { getUserActivities, loading: loadingActivities, error: activitiesError } = useGetUserActivities()
  const [activities, setActivities] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState("activity")
  const [refreshing, setRefreshing] = useState(false)

  const [fetchOptions, setFetchOptions] = useState({
    fromBlock: -9000,
    toBlock: "latest",
    maxRetries: 3,
    retryDelay: 2000,
  })

  const fetchStats = useCallback(async () => {
    if (address) {
      try {
        const userStats = await getUserStats(address)
        if (userStats) {
          setStats(userStats)
        }
      } catch (err) {
        console.error("Error fetching user stats:", err)
        toast.error("Failed to load user statistics")
      }
    }
  }, [address, getUserStats])

  const fetchActivities = useCallback(
    async (reset = false) => {
      if (!address) return

      try {
        const userActivities = await getUserActivities(address, fetchOptions)

        // Filter out duplicates and null values
        const uniqueActivities = userActivities.filter((activity, index, self) => {
          if (!activity) return false
          const activityKey = `${activity.type}-${activity.timestamp}-${
            activity.metadata?.campaignId || ""
          }-${activity.metadata?.proposalId || ""}`
          return (
            index ===
            self.findIndex(
              (a) =>
                a &&
                `${a.type}-${a.timestamp}-${a.metadata?.campaignId || ""}-${a.metadata?.proposalId || ""}` ===
                  activityKey,
            )
          )
        })

        if (reset) {
          setActivities(uniqueActivities)
        } else {
          setActivities((prev) => {
            const prevKeys = new Set(
              prev.map(
                (a) => `${a.type}-${a.timestamp}-${a.metadata?.campaignId || ""}-${a.metadata?.proposalId || ""}`,
              ),
            )
            const newUniqueActivities = uniqueActivities.filter((activity) => {
              const key = `${activity.type}-${activity.timestamp}-${
                activity.metadata?.campaignId || ""
              }-${activity.metadata?.proposalId || ""}`
              return !prevKeys.has(key)
            })
            return [...prev, ...newUniqueActivities]
          })
        }
        setHasMore(uniqueActivities.length >= 5)
      } catch (err) {
        console.error("Error in fetchActivities:", err)
        toast.error("Failed to load activities")
      }
    },
    [address, fetchOptions, getUserActivities],
  )

  const loadMore = () => {
    const currentFromBlock = Math.abs(fetchOptions.fromBlock)
    const newFromBlock = -(currentFromBlock + 8000)
    setFetchOptions((prev) => ({
      ...prev,
      fromBlock: newFromBlock,
    }))
    setPage((prev) => prev + 1)
  }

  const refreshActivities = async () => {
    setRefreshing(true)
    setFetchOptions({
      fromBlock: -9000,
      toBlock: "latest",
      maxRetries: 3,
      retryDelay: 2000,
    })
    setPage(1)
    await fetchActivities(true)
    await fetchStats()
    setRefreshing(false)
    toast.success("Dashboard refreshed")
  }

  useEffect(() => {
    if (isConnected) {
      fetchStats()
      const statsInterval = setInterval(fetchStats, 60000) // Refresh stats every minute
      return () => clearInterval(statsInterval)
    }
  }, [fetchStats, isConnected])

  useEffect(() => {
    if (isConnected) {
      fetchActivities(true)
      const activitiesInterval = setInterval(() => fetchActivities(true), 60000) // Refresh activities every minute
      return () => clearInterval(activitiesInterval)
    }
  }, [fetchActivities, isConnected])

  const calculatePointsToNextTier = (currentScore, currentTier) => {
    const nextTierThreshold = (currentTier + 1) * POINTS_PER_TIER
    return nextTierThreshold - currentScore
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Please connect your wallet to view your dashboard</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <main className="container mx-auto p-6 max-w-7xl">
      {(statsError || activitiesError) && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{statsError || activitiesError}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={refreshActivities} disabled={refreshing || loadingActivities}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Campaigns</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.campaignsCreated || 0}
            </div>
            <p className="text-xs text-muted-foreground">Backed {stats?.campaignsBacked || 0} campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Donations</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${stats?.totalDonated || 0} ETH`}
            </div>
            <p className="text-xs text-muted-foreground">Across {stats?.campaignsBacked || 0} campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Governance Activity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.proposalsCreated || 0}
            </div>
            <p className="text-xs text-muted-foreground">Voted on {stats?.proposalsVoted || 0} proposals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reputation Score</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : TIER_NAMES[stats?.reputationTier || 0]}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats
                ? `${calculatePointsToNextTier(stats.reputationScore, stats.reputationTier)} points to next tier`
                : "Loading..."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <AchievementBadges stats={stats} activities={activities} />
      </div>

      <div className="mt-6">
        <Tabs defaultValue="activity" onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="activity">Activity Feed</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <p className="text-sm text-muted-foreground">Your recent interactions with campaigns and proposals</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refreshActivities}
                  disabled={refreshing || loadingActivities}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing || loadingActivities ? "animate-spin" : ""}`} />
                  <span className="sr-only">Refresh</span>
                </Button>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
                    <TabsTrigger value="donations">Donations</TabsTrigger>
                    <TabsTrigger value="proposals">Proposals</TabsTrigger>
                  </TabsList>
                  <TabsContent value="all" className="space-y-4">
                    <ActivityFeed
                      activities={activities}
                      isLoading={loadingActivities || refreshing}
                      loadMore={loadMore}
                      hasMore={hasMore}
                    />
                  </TabsContent>
                  <TabsContent value="campaigns" className="space-y-4">
                    <ActivityFeed
                      activities={activities.filter((a) =>
                        ["CAMPAIGN_CREATED", "CAMPAIGN_PAID", "STATUS_CHANGED", "MILESTONE_UPDATED"].includes(a.type),
                      )}
                      isLoading={loadingActivities || refreshing}
                      loadMore={loadMore}
                      hasMore={hasMore}
                    />
                  </TabsContent>
                  <TabsContent value="donations" className="space-y-4">
                    <ActivityFeed
                      activities={activities.filter((a) => a.type === "DONATION_MADE")}
                      isLoading={loadingActivities || refreshing}
                      loadMore={loadMore}
                      hasMore={hasMore}
                    />
                  </TabsContent>
                  <TabsContent value="proposals" className="space-y-4">
                    <ActivityFeed
                      activities={activities.filter((a) =>
                        ["PROPOSAL_CREATED", "VOTE_CAST", "PROPOSAL_EXECUTED"].includes(a.type),
                      )}
                      isLoading={loadingActivities || refreshing}
                      loadMore={loadMore}
                      hasMore={hasMore}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Analytics stats={stats} activities={activities} />
          </TabsContent>
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Stay updated on your campaigns and platform activity</CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationCenter stats={stats} activities={activities} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

export default DashboardContent

