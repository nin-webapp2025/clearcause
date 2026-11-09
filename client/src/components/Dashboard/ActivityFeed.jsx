import { ScrollArea } from "../../components/ui/scroll-area"
import { Badge } from "../../components/ui/badge"
import { Vote, Rocket, Coins, MessageSquare, CheckCircle2, BarChart, RefreshCw, Milestone } from "lucide-react"
import { Button } from "../ui/button"

const ACTIVITY_TYPES = {
  CAMPAIGN_CREATED: {
    icon: Rocket,
    color: "bg-blue-500/10 text-blue-500",
    label: "Campaign Created",
  },
  DONATION_MADE: {
    icon: Coins,
    color: "bg-green-500/10 text-green-500",
    label: "Donation Made",
  },
  PROPOSAL_CREATED: {
    icon: MessageSquare,
    color: "bg-purple-500/10 text-purple-500",
    label: "Proposal Created",
  },
  VOTE_CAST: {
    icon: Vote,
    color: "bg-orange-500/10 text-orange-500",
    label: "Vote Cast",
  },
  CAMPAIGN_PAID: {
    icon: CheckCircle2,
    color: "bg-green-500/10 text-green-500",
    label: "Funds Withdrawn",
  },
  REPUTATION_UPDATED: {
    icon: BarChart,
    color: "bg-yellow-500/10 text-yellow-500",
    label: "Reputation Updated",
  },
  STATUS_CHANGED: {
    icon: RefreshCw,
    color: "bg-indigo-500/10 text-indigo-500",
    label: "Status Changed",
  },
  MILESTONE_UPDATED: {
    icon: Milestone,
    color: "bg-teal-500/10 text-teal-500",
    label: "Milestone Updated",
  },
}

const ActivityItem = ({ activity }) => {
  // Add null check to prevent accessing properties of undefined
  if (!activity) {
    return null
  }

  const activityType = ACTIVITY_TYPES[activity.type] || {
    icon: CheckCircle2,
    color: "bg-gray-500/10 text-gray-500",
    label: "Activity",
  }
  const Icon = activityType.icon

  return (
    <div className="flex items-start space-x-4 p-4 hover:bg-accent/50 rounded-lg transition-colors">
      <div className={`p-2 rounded-full ${activityType.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{activity.title}</p>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={activityType.color}>
              {activityType.label}
            </Badge>
            <time className="text-xs text-muted-foreground">{formatTimestamp(activity.timestamp)}</time>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{activity.description}</p>
        {activity.metadata && (
          <div className="mt-2 text-xs text-muted-foreground grid grid-cols-2 gap-1">
            {Object.entries(activity.metadata).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-2">
                <span className="font-medium capitalize">{key}:</span>
                <span className="truncate">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  // If less than 24 hours, show relative time
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    if (hours < 1) {
      const minutes = Math.floor(diff / (60 * 1000))
      return minutes <= 0 ? "just now" : `${minutes} minutes ago`
    }
    return `${hours} hours ago`
  }

  // If less than 7 days, show day of week
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString("en-US", { weekday: "long" })
  }

  // Otherwise show full date
  return date.toLocaleDateString()
}

export const ActivityFeed = ({ activities = [], isLoading, loadMore, hasMore }) => {
  // Add default empty array to prevent mapping over undefined
  const safeActivities = Array.isArray(activities) ? activities : []

  if (isLoading && !safeActivities.length) {
    return (
      <div className="flex justify-center items-center h-[400px] rounded-md border p-4">
        <div className="flex flex-col items-center space-y-2">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading activities...</p>
        </div>
      </div>
    )
  }

  if (!safeActivities.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] rounded-md border p-4 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-2 opacity-20" />
        <p>No activities found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[400px] rounded-md border">
        <div className="space-y-1 p-1">
          {safeActivities.map((activity, index) => (
            <ActivityItem key={index} activity={activity} />
          ))}

          {isLoading && (
            <div className="flex justify-center p-4">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </ScrollArea>

      {hasMore && !isLoading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} className="w-full">
            Load more activities
          </Button>
        </div>
      )}
    </div>
  )
}

export default ActivityFeed

