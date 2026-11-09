import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
import { Link } from "react-router-dom"

const ProposalCard = ({ proposal, onVote, onExecute, loading }) => {
  const now = Math.floor(Date.now() / 1000)
  const status = proposal.executed
    ? { label: "Executed", color: "bg-green-500/10 text-green-500" }
    : now > proposal.endTime
      ? proposal.forVotes > proposal.againstVotes
        ? { label: "Passed", color: "bg-blue-500/10 text-blue-500" }
        : { label: "Failed", color: "bg-red-500/10 text-red-500" }
      : { label: "Active", color: "bg-yellow-500/10 text-yellow-500" }

  const canExecute = status.label === "Passed" && !proposal.executed

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <Link to={`/dashboard/governance/${proposal.id}`}>
          <CardTitle className="text-base hover:text-primary">Proposal #{proposal.id}</CardTitle>
        </Link>
        <Badge variant="outline" className={status.color}>
          {status.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{proposal.description}</p>

        <div className="flex justify-between text-sm">
          <span>Campaign #{proposal.campaignId}</span>
          <span>{new Date(proposal.createdAt * 1000).toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xl font-bold text-green-600">{proposal.forVotes}</p>
            <p className="text-xs text-muted-foreground">For</p>
          </div>
          <div>
            <p className="text-xl font-bold text-red-600">{proposal.againstVotes}</p>
            <p className="text-xs text-muted-foreground">Against</p>
          </div>
        </div>

        {status.label === "Active" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onVote(proposal.id, true)}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
              For
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onVote(proposal.id, false)}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
              Against
            </Button>
          </div>
        )}

        {canExecute && (
          <Button className="w-full" onClick={() => onExecute(proposal.id)} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Execute Proposal"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default ProposalCard

