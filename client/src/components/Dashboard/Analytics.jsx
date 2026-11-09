"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { BarChartIcon, LineChartIcon, PieChartIcon, Activity } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts"

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"]

const Analytics = ({ stats, activities }) => {
  const [campaignData, setCampaignData] = useState([])
  const [donationData, setDonationData] = useState([])
  const [governanceData, setGovernanceData] = useState([])
  const [reputationData, setReputationData] = useState([])

  useEffect(() => {
    if (activities && activities.length > 0) {
      // Process campaign data
      const campaignActivities = activities.filter((a) =>
        ["CAMPAIGN_CREATED", "CAMPAIGN_PAID", "STATUS_CHANGED"].includes(a.type),
      )

      // Group by month
      const campaignsByMonth = groupByMonth(campaignActivities)
      setCampaignData(
        Object.entries(campaignsByMonth).map(([month, count]) => ({
          month,
          campaigns: count,
        })),
      )

      // Process donation data
      const donationActivities = activities.filter((a) => a.type === "DONATION_MADE")
      const donationsByMonth = groupByMonth(donationActivities)
      setDonationData(
        Object.entries(donationsByMonth).map(([month, count]) => ({
          month,
          donations: count,
        })),
      )

      // Process governance data
      const governanceActivities = activities.filter((a) =>
        ["PROPOSAL_CREATED", "VOTE_CAST", "PROPOSAL_EXECUTED"].includes(a.type),
      )
      const governanceByType = governanceActivities.reduce((acc, activity) => {
        acc[activity.type] = (acc[activity.type] || 0) + 1
        return acc
      }, {})
      setGovernanceData(
        Object.entries(governanceByType).map(([type, count]) => ({
          name: formatActivityType(type),
          value: count,
        })),
      )
    }

    // Generate reputation data (simulated growth over time)
    if (stats && stats.reputationScore) {
      const reputationHistory = generateReputationHistory(stats.reputationScore)
      setReputationData(reputationHistory)
    }
  }, [activities, stats])

  // Helper function to group activities by month
  const groupByMonth = (activities) => {
    return activities.reduce((acc, activity) => {
      const date = new Date(activity.timestamp)
      const month = `${date.getFullYear()}-${date.getMonth() + 1}`
      acc[month] = (acc[month] || 0) + 1
      return acc
    }, {})
  }

  // Helper function to format activity type for display
  const formatActivityType = (type) => {
    switch (type) {
      case "PROPOSAL_CREATED":
        return "Proposals Created"
      case "VOTE_CAST":
        return "Votes Cast"
      case "PROPOSAL_EXECUTED":
        return "Proposals Executed"
      default:
        return type.replace(/_/g, " ").toLowerCase()
    }
  }

  // Generate simulated reputation history data
  const generateReputationHistory = (currentScore) => {
    const data = []
    const now = new Date()

    // Generate 6 months of data points
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now)
      date.setMonth(date.getMonth() - i)
      const month = `${date.getFullYear()}-${date.getMonth() + 1}`

      // Calculate a score that grows over time to reach the current score
      const factor = (5 - i) / 5
      const score = Math.round(currentScore * factor)

      data.push({
        month,
        score,
      })
    }

    return data
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics</h2>

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">
            <BarChartIcon className="h-4 w-4 mr-2" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="donations">
            <LineChartIcon className="h-4 w-4 mr-2" />
            Donations
          </TabsTrigger>
          <TabsTrigger value="governance">
            <PieChartIcon className="h-4 w-4 mr-2" />
            Governance
          </TabsTrigger>
          <TabsTrigger value="reputation">
            <Activity className="h-4 w-4 mr-2" />
            Reputation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Activity</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="campaigns" fill="#8884d8" name="Campaigns" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="donations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Donation Trends</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={donationData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="donations" stroke="#82ca9d" fill="#82ca9d" name="Donations" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Governance Participation</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={governanceData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {governanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reputation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reputation Growth</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reputationData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="score" stroke="#8884d8" name="Reputation Score" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Analytics

