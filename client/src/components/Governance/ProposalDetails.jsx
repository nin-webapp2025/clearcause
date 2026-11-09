"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Progress } from "../ui/progress"
import { Alert, AlertDescription } from "../ui/alert"
import { Skeleton } from "../ui/skeleton"
import {
  Loader2,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Hash,
  FileText,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { useAppKitAccount } from "@reown/appkit/react"
import useVoteOnProposal from "../../hooks/Proposal System/useVoteOnProposal"
import useExecuteProposal from "../../hooks/Proposal System/useExecuteProposal"
import useGetAllProposals from "../../hooks/Proposal System/useGetAllProposals"
import { toast } from "react-toastify"

const PROPOSAL_TYPES = {
  0: "Unsupported Legacy Type",
  1: "Milestone Adjustment",
}

const ProposalDetails = () => {
  const { proposalId } = useParams()
  const navigate = useNavigate()
  const [proposal, setProposal] = useState(null)
  const [voteType, setVoteType] = useState(null) // 'for' or 'against'
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const { getAllProposals, loading: fetchingProposals, error: fetchError } = useGetAllProposals()
  const { voteOnProposal, loading: voting, error: voteError } = useVoteOnProposal()
  const { executeProposal, loading: executing, error: executeError } = useExecuteProposal()
  const { isConnected } = useAppKitAccount()

  // Fetch all proposals and find the one we need
  const fetchProposal = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const proposals = await getAllProposals()
      if (proposals && Array.isArray(proposals)) {
        const found = proposals.find((p) => p.id === Number(proposalId))
        if (found) {
          setProposal(found)
        } else {
          setError(`Proposal #${proposalId} not found`)
        }
      }
    } catch (err) {
      console.error("Error fetching proposal:", err)
      setError("Failed to load proposal details")
    } finally {
      setIsLoading(false)
    }
  }, [getAllProposals, proposalId])

  useEffect(() => {
    fetchProposal()
  }, [fetchProposal])

  const handleVote = async (support) => {
    if (!isConnected) {
      toast.error("Please connect your wallet to vote")
      return
    }

    setVoteType(support ? "for" : "against")

    try {
      const result = await voteOnProposal(Number(proposalId), support)
      if (result && result.success) {
        toast.success(`Vote cast successfully! You voted ${support ? "for" : "against"} the proposal.`)
        // Refresh proposal data
        setTimeout(fetchProposal, 2000)
      }
    } catch (err) {
      console.error("Error voting on proposal:", err)
    } finally {
      setVoteType(null)
    }
  }

  const handleExecute = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet to execute this proposal")
      return
    }

    try {
      const result = await executeProposal(Number(proposalId))
      if (result && result.success) {
        toast.success("Proposal executed successfully!")
        // Refresh proposal data
        setTimeout(fetchProposal, 2000)
      }
    } catch (err) {
      console.error("Error executing proposal:", err)
    }
  }

  const getProposalStatus = (proposal) => {
    if (!proposal) return { label: "Unknown", color: "bg-gray-500/10 text-gray-500" }

    const now = Math.floor(Date.now() / 1000)

    if (proposal.executed) {
      return { label: "Executed", color: "bg-green-500/10 text-green-500" }
    }

    if (now > proposal.endTime) {
      if (proposal.forVotes > proposal.againstVotes && proposal.totalVotes >= proposal.quorumVotes) {
        return { label: "Ready to Execute", color: "bg-blue-500/10 text-blue-500" }
      } else if (proposal.forVotes <= proposal.againstVotes) {
        return { label: "Failed", color: "bg-red-500/10 text-red-500" }
      } else {
        return { label: "Quorum Not Met", color: "bg-yellow-500/10 text-yellow-500" }
      }
    }

    return { label: "Active", color: "bg-yellow-500/10 text-yellow-500" }
  }

  // Format the end time as a readable date
  const formatTime = (timestamp) => {
    if (!timestamp) return "Unknown"
    const date = new Date(timestamp * 1000)
    return date.toLocaleString()
  }

  // Calculate time remaining
  const getTimeRemaining = (endTime) => {
    if (!endTime) return "Unknown"

    const now = Math.floor(Date.now() / 1000)
    const remaining = endTime - now

    if (remaining <= 0) return "Voting has ended"

    const days = Math.floor(remaining / (24 * 60 * 60))
    const hours = Math.floor((remaining % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((remaining % (60 * 60)) / 60)

    return `${days}d ${hours}h ${minutes}m remaining`
  }

  // Calculate vote percentages
  const getVotePercentages = (proposal) => {
    if (!proposal) return { for: 0, against: 0 }

    const total = proposal.forVotes + proposal.againstVotes
    if (total === 0) return { for: 0, against: 0 }

    return {
      for: Math.round((proposal.forVotes / total) * 100),
      against: Math.round((proposal.againstVotes / total) * 100),
    }
  }

  if (isLoading || fetchingProposals) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" className="mb-6" onClick={() => navigate("/dashboard/governance")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Proposals
        </Button>

        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full mt-4" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || fetchError || !proposal) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" className="mb-6" onClick={() => navigate("/dashboard/governance")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Proposals
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || fetchError || `Proposal #${proposalId} not found`}</AlertDescription>
        </Alert>

        <Button onClick={fetchProposal}>Try Again</Button>
      </div>
    )
  }

  const status = getProposalStatus(proposal)
  const canExecute = status.label === "Ready to Execute" && !proposal.executed
  const canVote = status.label === "Active"
  const votePercentages = getVotePercentages(proposal)

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="mb-6" onClick={() => navigate("/dashboard/governance")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Proposals
      </Button>

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Proposal #{proposalId}</h1>
          <Badge variant="outline" className={status.color}>
            {status.label}
          </Badge>
        </div>
        {canExecute && (
          <Button onClick={handleExecute} disabled={executing || !isConnected} className="w-full sm:w-auto">
            {executing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Execute Proposal
              </>
            )}
          </Button>
        )}
      </div>

      {(voteError || executeError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{voteError || executeError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Type: {PROPOSAL_TYPES[proposal.proposalType] || "Unknown"}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Hash className="h-4 w-4" />
                <span>Campaign ID: {proposal.campaignId}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Created: {formatTime(proposal.createdAt)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Voting Ends: {formatTime(proposal.endTime)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                <span>{getTimeRemaining(proposal.endTime)}</span>
              </div>
            </div>

            <div className="pt-2 border-t">
              <h3 className="font-medium mb-2">Description</h3>
              <p className="text-muted-foreground">{proposal.description}</p>
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
              <h3 className="font-medium mb-2">Creator</h3>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <p className="text-muted-foreground font-mono text-sm break-all">{proposal.creator}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voting</CardTitle>
            <CardDescription>{proposal.totalVotes} total votes cast</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center">
                    <ThumbsUp className="mr-2 h-4 w-4 text-green-600" />
                    For
                  </span>
                  <span className="font-medium">
                    {proposal.forVotes} ({votePercentages.for}%)
                  </span>
                </div>
                <Progress value={votePercentages.for} className="h-2 bg-muted" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center">
                    <ThumbsDown className="mr-2 h-4 w-4 text-red-600" />
                    Against
                  </span>
                  <span className="font-medium">
                    {proposal.againstVotes} ({votePercentages.against}%)
                  </span>
                </div>
                <Progress value={votePercentages.against} className="h-2 bg-muted" />
              </div>
            </div>

            {canVote && (
              <div className="pt-4 border-t">
                <h3 className="font-medium mb-4">Cast Your Vote</h3>

                {!isConnected && (
                  <Alert variant="warning" className="mb-4 bg-yellow-500/10 text-yellow-700 border-yellow-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Please connect your wallet to vote on this proposal</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-4">
                  <Button
                    className="flex-1 bg-green-500/10 hover:bg-green-500/20 border-green-500/20"
                    variant="outline"
                    onClick={() => handleVote(true)}
                    disabled={voting || !isConnected}
                  >
                    {voting && voteType === "for" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsUp className="mr-2 h-4 w-4" />
                    )}
                    For
                  </Button>
                  <Button
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
                    variant="outline"
                    onClick={() => handleVote(false)}
                    disabled={voting || !isConnected}
                  >
                    {voting && voteType === "against" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsDown className="mr-2 h-4 w-4" />
                    )}
                    Against
                  </Button>
                </div>
              </div>
            )}
          </CardContent>

          {status.label === "Executed" && (
            <CardFooter className="bg-green-500/5 border-t border-green-500/10">
              <div className="flex items-center gap-2 text-green-600 w-full justify-center py-2">
                <CheckCircle className="h-5 w-5" />
                <span>This proposal has been executed</span>
              </div>
            </CardFooter>
          )}

          {status.label === "Failed" && (
            <CardFooter className="bg-red-500/5 border-t border-red-500/10">
              <div className="flex items-center gap-2 text-red-600 w-full justify-center py-2">
                <AlertCircle className="h-5 w-5" />
                <span>This proposal has failed</span>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}

export default ProposalDetails

