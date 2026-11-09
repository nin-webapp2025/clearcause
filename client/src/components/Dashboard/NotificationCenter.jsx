"use client"

import { useState, useEffect } from "react"
import { Bell, Check, X, Info, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { ScrollArea } from "../ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"

const NOTIFICATION_TYPES = {
  INFO: {
    icon: Info,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    label: "Info",
  },
  WARNING: {
    icon: AlertTriangle,
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    label: "Warning",
  },
  SUCCESS: {
    icon: CheckCircle2,
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    label: "Success",
  },
}

const NotificationItem = ({ notification, onDismiss, onMarkRead }) => {
  const notificationType = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.INFO
  const Icon = notificationType.icon

  return (
    <div
      className={`
      flex items-start space-x-4 p-4 rounded-lg border mb-2
      ${notification.read ? "bg-muted/30" : "bg-card"}
      ${notification.read ? "border-muted" : "border-border"}
    `}
    >
      <div className={`p-2 rounded-full ${notificationType.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <p className={`text-sm font-medium ${notification.read ? "text-muted-foreground" : ""}`}>
            {notification.title}
          </p>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={notificationType.color}>
              {notificationType.label}
            </Badge>
            <time className="text-xs text-muted-foreground">{formatTimestamp(notification.timestamp)}</time>
          </div>
        </div>
        <p className={`text-sm ${notification.read ? "text-muted-foreground" : "text-foreground"}`}>
          {notification.message}
        </p>
        <div className="flex justify-end space-x-2 pt-2">
          {!notification.read && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onMarkRead(notification.id)}>
              <Check className="h-3 w-3 mr-1" /> Mark as read
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => onDismiss(notification.id)}
          >
            <X className="h-3 w-3 mr-1" /> Dismiss
          </Button>
        </div>
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

const NotificationCenter = ({ activities, stats }) => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Generate notifications based on activities and stats
  useEffect(() => {
    if (!activities || !stats) return

    const newNotifications = []

    // Add notification for new reputation tier
    if (stats.reputationTier > 0) {
      const tierNames = ["Novice", "Contributor", "Influencer", "Leader", "Expert"]
      newNotifications.push({
        id: `reputation-tier-${stats.reputationTier}`,
        type: "SUCCESS",
        title: "Reputation Tier Increased",
        message: `Congratulations! You've reached the ${tierNames[stats.reputationTier]} tier.`,
        timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
        read: false,
      })
    }

    // Add notifications for recent activities
    activities.slice(0, 5).forEach((activity, index) => {
      if (activity.type === "CAMPAIGN_CREATED") {
        newNotifications.push({
          id: `activity-${activity.type}-${activity.metadata?.campaignId || index}`,
          type: "SUCCESS",
          title: "Campaign Created Successfully",
          message: `Your campaign "${activity.description.replace('Campaign "', "").replace('" created', "")}" has been created and is now live.`,
          timestamp: activity.timestamp,
          read: false,
        })
      } else if (activity.type === "DONATION_MADE") {
        newNotifications.push({
          id: `activity-${activity.type}-${activity.metadata?.campaignId || index}`,
          type: "INFO",
          title: "Donation Confirmed",
          message: `Your donation of ${activity.metadata?.amount} to campaign #${activity.metadata?.campaignId} has been confirmed.`,
          timestamp: activity.timestamp,
          read: false,
        })
      } else if (activity.type === "PROPOSAL_CREATED") {
        newNotifications.push({
          id: `activity-${activity.type}-${activity.metadata?.proposalId || index}`,
          type: "INFO",
          title: "Proposal Created",
          message: `Your proposal for campaign #${activity.metadata?.campaignId} has been created and is open for voting.`,
          timestamp: activity.timestamp,
          read: false,
        })
      } else if (activity.type === "STATUS_CHANGED" && activity.metadata?.status === "Successful") {
        newNotifications.push({
          id: `activity-${activity.type}-${activity.metadata?.campaignId || index}`,
          type: "SUCCESS",
          title: "Campaign Successful",
          message: `Congratulations! Your campaign #${activity.metadata?.campaignId} has reached its funding goal.`,
          timestamp: activity.timestamp,
          read: false,
        })
      }
    })

    // Add system notifications
    newNotifications.push({
      id: "system-welcome",
      type: "INFO",
      title: "Welcome to ClearCause",
      message:
        "Thank you for joining our decentralized crowdfunding platform. Start by exploring campaigns or creating your own!",
      timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
      read: true,
    })

    if (stats.campaignsCreated === 0) {
      newNotifications.push({
        id: "system-create-campaign",
        type: "INFO",
        title: "Create Your First Campaign",
        message: "Ready to start fundraising? Create your first campaign to begin receiving donations.",
        timestamp: Date.now() - 1000 * 60 * 60 * 12, // 12 hours ago
        read: false,
      })
    }

    // Sort by timestamp (newest first) and set state
    const sortedNotifications = newNotifications.sort((a, b) => b.timestamp - a.timestamp)
    setNotifications(sortedNotifications)

    // Update unread count
    setUnreadCount(sortedNotifications.filter((n) => !n.read).length)
  }, [activities, stats])

  const handleMarkRead = (id) => {
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)),
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const handleDismiss = (id) => {
    const notification = notifications.find((n) => n.id === id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (!notification.read) {
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
    setUnreadCount(0)
  }

  const clearAll = () => {
    setNotifications([])
    setUnreadCount(0)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="rounded-full px-1 min-w-[20px] h-5 flex items-center justify-center"
              >
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Stay updated on your campaigns and platform activity</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            Mark all read
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} disabled={notifications.length === 0}>
            Clear all
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <ScrollArea className="h-[300px]">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={handleDismiss}
                    onMarkRead={handleMarkRead}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <Bell className="h-12 w-12 mb-2 opacity-20" />
                  <p>No notifications</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="unread" className="space-y-4">
            <ScrollArea className="h-[300px]">
              {notifications.filter((n) => !n.read).length > 0 ? (
                notifications
                  .filter((n) => !n.read)
                  .map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onDismiss={handleDismiss}
                      onMarkRead={handleMarkRead}
                    />
                  ))
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <Check className="h-12 w-12 mb-2 opacity-20" />
                  <p>No unread notifications</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <ScrollArea className="h-[300px]">
              {notifications.filter((n) => n.id.startsWith("system")).length > 0 ? (
                notifications
                  .filter((n) => n.id.startsWith("system"))
                  .map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onDismiss={handleDismiss}
                      onMarkRead={handleMarkRead}
                    />
                  ))
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <Info className="h-12 w-12 mb-2 opacity-20" />
                  <p>No system notifications</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default NotificationCenter

