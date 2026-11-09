import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import { Progress } from "../ui/progress"
import { Award, Rocket, Coins, Users, Star, Trophy, Target, Zap, Crown } from "lucide-react"

const AchievementBadges = ({ stats, activities }) => {
  // Define achievements
  const achievements = [
    {
      id: "first_campaign",
      name: "Campaign Creator",
      description: "Created your first campaign",
      icon: Rocket,
      color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      unlocked: stats?.campaignsCreated > 0,
      progress: stats?.campaignsCreated > 0 ? 100 : 0,
    },
    {
      id: "generous_donor",
      name: "Generous Donor",
      description: "Donated to 5 or more campaigns",
      icon: Coins,
      color: "bg-green-500/10 text-green-500 border-green-500/20",
      unlocked: stats?.campaignsBacked >= 5,
      progress: Math.min(100, (stats?.campaignsBacked / 5) * 100),
    },
    {
      id: "governance_participant",
      name: "Governance Participant",
      description: "Voted on 3 or more proposals",
      icon: Users,
      color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      unlocked: stats?.proposalsVoted >= 3,
      progress: Math.min(100, (stats?.proposalsVoted / 3) * 100),
    },
    {
      id: "proposal_creator",
      name: "Proposal Creator",
      description: "Created your first proposal",
      icon: Star,
      color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      unlocked: stats?.proposalsCreated > 0,
      progress: stats?.proposalsCreated > 0 ? 100 : 0,
    },
    {
      id: "reputation_tier1",
      name: "Rising Star",
      description: "Reached Contributor reputation tier",
      icon: Trophy,
      color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      unlocked: stats?.reputationTier >= 1,
      progress: stats?.reputationTier >= 1 ? 100 : (stats?.reputationScore / 100) * 100,
    },
    {
      id: "reputation_tier2",
      name: "Community Influencer",
      description: "Reached Influencer reputation tier",
      icon: Target,
      color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
      unlocked: stats?.reputationTier >= 2,
      progress: stats?.reputationTier >= 2 ? 100 : (stats?.reputationScore / 200) * 100,
    },
    {
      id: "reputation_tier3",
      name: "Community Leader",
      description: "Reached Leader reputation tier",
      icon: Zap,
      color: "bg-pink-500/10 text-pink-500 border-pink-500/20",
      unlocked: stats?.reputationTier >= 3,
      progress: stats?.reputationTier >= 3 ? 100 : (stats?.reputationScore / 300) * 100,
    },
    {
      id: "reputation_tier4",
      name: "Funding Expert",
      description: "Reached Expert reputation tier",
      icon: Crown,
      color: "bg-red-500/10 text-red-500 border-red-500/20",
      unlocked: stats?.reputationTier >= 4,
      progress: stats?.reputationTier >= 4 ? 100 : (stats?.reputationScore / 400) * 100,
    },
  ]

  // Calculate unlocked achievements
  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const totalAchievements = achievements.length
  const completionPercentage = Math.round((unlockedCount / totalAchievements) * 100)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Achievements</CardTitle>
            <CardDescription>Unlock badges by participating in the platform</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <span className="font-bold">
              {unlockedCount}/{totalAchievements}
            </span>
          </div>
        </div>
        <Progress value={completionPercentage} className="h-2" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <TooltipProvider delayDuration={300}>
            {achievements.map((achievement) => (
              <Tooltip key={achievement.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`
                    flex flex-col items-center justify-center p-3 rounded-lg border
                    ${achievement.unlocked ? achievement.color : "bg-muted/30 text-muted-foreground border-muted"}
                    transition-all hover:scale-105 cursor-pointer
                  `}
                  >
                    <achievement.icon className={`h-8 w-8 mb-2 ${!achievement.unlocked && "opacity-50"}`} />
                    <span className="text-xs font-medium text-center">{achievement.name}</span>
                    {!achievement.unlocked && achievement.progress > 0 && (
                      <Progress value={achievement.progress} className="h-1 w-full mt-2" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="text-sm">
                    <p className="font-semibold">{achievement.name}</p>
                    <p>{achievement.description}</p>
                    {!achievement.unlocked && (
                      <p className="text-xs mt-1">Progress: {Math.round(achievement.progress)}%</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  )
}

export default AchievementBadges

