"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import { Alert, AlertDescription } from "../ui/alert"
import { ThumbsUp, ThumbsDown, Loader2, AlertCircle, Calendar, Hash, FileText } from "lucide-react"
import { useAppKitAccount } from "@reown/appkit/react"
import { toast } from "react-toastify"
import useVoteOnProposal from "../../hooks/Proposal System/useVoteOnProposal"

const PROPOSAL_TYPES = {
  0: "Unsupported Legacy Type",
  1: "Milestone Adjustment",
}

const VoteDialog = ({ proposal, onOpenChange, onSuccess }) => {
  const { voteOnProposal, loading, error } = useVoteOnProposal()
  const { isConnected } = useAppKitAccount()
  const [voteType, setVoteType] = useState(null) // 'for' or 'against'

  if (!proposal) return null

  const handleVote = async (support) => {
    if (!isConnected) {
      toast.error("Please connect your wallet to vote")
      return
    }

    setVoteType(support ? "for" : "against")

    try {
      const result = await voteOnProposal(proposal.id, support)
      if (result && result.success) {
        onSuccess?.()
        onOpenChange(false)
      }
    } catch (err) {
      console.error("Error voting on proposal:", err)
    } finally {
      setVoteType(null)
    }
  }

  // Format the end time as a readable date
  const formatEndTime = (timestamp) => {
    if (!timestamp) return "Unknown"
    const date = new Date(timestamp * 1000)
    return date.toLocaleString()
  }

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!proposal.endTime) return "Unknown"

    const now = Math.floor(Date.now() / 1000)
    const remaining = proposal.endTime - now

    if (remaining <= 0) return "Voting has ended"

    const days = Math.floor(remaining / (24 * 60 * 60))
    const hours = Math.floor((remaining % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((remaining % (60 * 60)) / 60)

    return `${days}d ${hours}h ${minutes}m remaining`
  }

  return (
    <Dialog open={!!proposal} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cast Your Vote</DialogTitle>
          <DialogDescription>
            Vote on proposal #{proposal.id}. Your vote cannot be changed once submitted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hash className="h-4 w-4" />
              <span>Proposal ID: {proposal.id}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Type: {PROPOSAL_TYPES[proposal.proposalType] || "Unknown"}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Ends: {formatEndTime(proposal.endTime)}</span>
            </div>

            <div className="text-sm font-medium">{getTimeRemaining()}</div>

            <div className="pt-2 border-t">
              <h3 className="font-medium mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">{proposal.description}</p>
            </div>

            {proposal.proposalType === 1 && proposal.newMilestones && proposal.newMilestones.length > 0 && (
              <div className="pt-2 border-t">
                <h3 className="font-medium mb-2">Proposed Milestones</h3>
                <div className="space-y-1">
                  {proposal.newMilestones.map((milestone, index) => (
                    <div key={index} className="text-sm">
                      Milestone {index + 1}: {milestone} ETH
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <h3 className="font-medium mb-2">Current Votes</h3>
              <div className="flex justify-between text-sm">
                <div>
                  <span className="text-green-600 font-medium">{proposal.forVotes}</span> For
                </div>
                <div>
                  <span className="text-red-600 font-medium">{proposal.againstVotes}</span> Against
                </div>
              </div>
            </div>
          </Card>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isConnected && (
            <Alert variant="warning" className="bg-yellow-500/10 text-yellow-700 border-yellow-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Please connect your wallet to vote on this proposal</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              className="flex-1 bg-green-500/10 hover:bg-green-500/20 border-green-500/20"
              onClick={() => handleVote(true)}
              disabled={loading || !isConnected}
            >
              {loading && voteType === "for" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  For
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1 bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
              onClick={() => handleVote(false)}
              disabled={loading || !isConnected}
            >
              {loading && voteType === "against" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Against
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default VoteDialog

