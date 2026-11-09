"use client"

import { useState, memo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Loader2, Plus, Trash2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "../ui/alert"
import useCreateProposal from "../../hooks/Proposal System/useCreateProposal"
import { useAppKitAccount } from "@reown/appkit/react"
import { toast } from "react-toastify"

const MILESTONE_ADJUSTMENT = 1

const VOTING_PERIODS = {
  1: "1 Day",
  3: "3 Days",
  7: "1 Week",
}

const CreateProposalDialog = memo(({ open, onOpenChange, onSuccess }) => {
  const [formData, setFormData] = useState({
    campaignId: "",
    description: "",
    votingPeriod: "7",
    milestones: [""],
  })
  const { createProposal, loading, error } = useCreateProposal()
  const { isConnected } = useAppKitAccount()

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        campaignId: "",
        description: "",
        votingPeriod: "7",
        milestones: [""],
      })
    }
  }, [open])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isConnected) {
      toast.error("Please connect your wallet to create a proposal")
      return
    }

    const invalidMilestones = formData.milestones.some(
      (m) => !m || isNaN(Number.parseFloat(m)) || Number.parseFloat(m) <= 0,
    )
    if (invalidMilestones) {
      toast.error("All milestones must be valid positive numbers")
      return
    }

    try {
      const result = await createProposal(
        Number(formData.campaignId),
        formData.description,
        Number(formData.votingPeriod),
        MILESTONE_ADJUSTMENT,
        formData.milestones,
      )

      if (result && result.success) {
        onSuccess?.(result.proposalId)
        onOpenChange(false)
      }
    } catch (err) {
      console.error("Error creating proposal:", err)
    }
  }

  const handleAddMilestone = () => {
    setFormData((prev) => ({
      ...prev,
      milestones: [...prev.milestones, ""],
    }))
  }

  const handleRemoveMilestone = (index) => {
    setFormData((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index),
    }))
  }

  const handleMilestoneChange = (index, value) => {
    setFormData((prev) => {
      const newMilestones = [...prev.milestones]
      newMilestones[index] = value
      return {
        ...prev,
        milestones: newMilestones,
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Proposal</DialogTitle>
          <DialogDescription>
            Create a proposal for campaign governance. Different proposal types have different effects.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaignId">Campaign ID</Label>
            <Input
              id="campaignId"
              type="number"
              required
              value={formData.campaignId}
              onChange={(e) => setFormData((prev) => ({ ...prev, campaignId: e.target.value }))}
              placeholder="Enter campaign ID"
            />
            <p className="text-xs text-muted-foreground">The ID of the campaign this proposal is for</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              required
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your proposal"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Provide a clear description of what this proposal aims to achieve
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="votingPeriod">Voting Period</Label>
            <Select
              value={formData.votingPeriod}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, votingPeriod: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select voting period" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VOTING_PERIODS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">How long the voting period will last</p>
          </div>

          <div className="space-y-3 border p-3 rounded-md">
              <Label>New Milestones (ETH)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Define new milestone amounts for the campaign. Values should be in ascending order.
              </p>

              {formData.milestones.map((milestone, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={milestone}
                    onChange={(e) => handleMilestoneChange(index, e.target.value)}
                    placeholder={`Milestone ${index + 1} amount`}
                    className="flex-1"
                  />
                  {formData.milestones.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveMilestone(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}

              {formData.milestones.length < 10 && (
                <Button type="button" variant="outline" size="sm" onClick={handleAddMilestone} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Milestone
                </Button>
              )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !isConnected}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Proposal"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
})

CreateProposalDialog.displayName = "CreateProposalDialog"

export default CreateProposalDialog

