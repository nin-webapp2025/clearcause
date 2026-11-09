"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Button } from "../ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Badge } from "../ui/badge"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "../ui/alert"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../ui/pagination"
import CreateProposalDialog from "./CreateProposalDialog"
import VoteDialog from "./VoteDialog"
import useGetAllProposals from "../../hooks/Proposal System/useGetAllProposals"
import useGetProposalsPaginated from "../../hooks/Proposal System/useGetProposalsPaginated"
import useExecuteProposal from "../../hooks/Proposal System/useExecuteProposal"
import { useAppKitAccount } from "@reown/appkit/react"
import { toast } from "react-toastify"

const PROPOSAL_TYPES = {
  0: "Unsupported Legacy Type",
  1: "Milestone Adjustment",
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

const Governance = () => {
  const [proposals, setProposals] = useState([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(10)
  const [totalProposals, setTotalProposals] = useState(0)
  const [usePagination, setUsePagination] = useState(false)
  const [error, setError] = useState(null)

  const { getAllProposals, loading: fetchingAllProposals, error: allProposalsError } = useGetAllProposals()
  const {
    getProposalsPaginated,
    loading: fetchingPaginatedProposals,
    error: paginatedError,
  } = useGetProposalsPaginated()
  const { executeProposal, loading: executing, error: executeError } = useExecuteProposal()
  const { isConnected } = useAppKitAccount()

  const navigate = useNavigate()

  // Fetch all proposals (for small datasets)
  const fetchAllProposals = useCallback(async () => {
    try {
      const data = await getAllProposals()
      if (data && Array.isArray(data)) {
        const sortedProposals = data.filter((p) => p && p.id).sort((a, b) => b.id - a.id)

        setProposals(sortedProposals)
        setTotalProposals(sortedProposals.length)

        // If we have a lot of proposals, switch to pagination
        if (sortedProposals.length > 20) {
          setUsePagination(true)
        }
      }
    } catch (error) {
      console.error("Error fetching all proposals:", error)
      setError("Failed to fetch proposals. Please try again later.")
    }
  }, [getAllProposals])

  // Fetch paginated proposals (for larger datasets)
  const fetchPaginatedProposals = useCallback(async () => {
    try {
      const startIndex = currentPage * pageSize
      const data = await getProposalsPaginated(startIndex, pageSize)

      if (data && Array.isArray(data)) {
        setProposals(data.filter((p) => p && p.id))
      }
    } catch (error) {
      console.error("Error fetching paginated proposals:", error)
      setError("Failed to fetch proposals. Please try again later.")
    }
  }, [getProposalsPaginated, currentPage, pageSize])

  // Initial fetch and decide whether to use pagination
  useEffect(() => {
    fetchAllProposals()
  }, [fetchAllProposals])

  // Fetch paginated data when page changes
  useEffect(() => {
    if (usePagination) {
      fetchPaginatedProposals()
    }
  }, [usePagination, fetchPaginatedProposals, currentPage])

  // Set up polling for updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (usePagination) {
        fetchPaginatedProposals()
      } else {
        fetchAllProposals()
      }
    }, 30000) // Poll every 30 seconds

    return () => clearInterval(interval)
  }, [usePagination, fetchAllProposals, fetchPaginatedProposals])

  const handleExecute = useCallback(
    async (proposalId) => {
      if (!isConnected) {
        toast.error("Please connect your wallet to execute proposals")
        return
      }

      try {
        const result = await executeProposal(proposalId)
        if (result && result.success) {
          toast.success("Proposal executed successfully!")

          // Refresh proposals after execution
          setTimeout(() => {
            if (usePagination) {
              fetchPaginatedProposals()
            } else {
              fetchAllProposals()
            }
          }, 2000)
        }
      } catch (error) {
        console.error("Error executing proposal:", error)
        toast.error(`Failed to execute proposal: ${error.message || "Unknown error"}`)
      }
    },
    [executeProposal, isConnected, usePagination, fetchPaginatedProposals, fetchAllProposals],
  )

  const handleCreateSuccess = useCallback(
    (proposalId) => {
      setIsCreateDialogOpen(false)
      toast.success(`Proposal #${proposalId} created successfully!`)

      // Refresh proposals after creation
      setTimeout(() => {
        if (usePagination) {
          fetchPaginatedProposals()
        } else {
          fetchAllProposals()
        }
      }, 2000)
    },
    [usePagination, fetchPaginatedProposals, fetchAllProposals],
  )

  const handleVoteSuccess = useCallback(() => {
    setSelectedProposal(null)
    toast.success("Vote cast successfully!")

    // Refresh proposals after voting
    setTimeout(() => {
      if (usePagination) {
        fetchPaginatedProposals()
      } else {
        fetchAllProposals()
      }
    }, 2000)
  }, [usePagination, fetchPaginatedProposals, fetchAllProposals])

  const activeProposals = useMemo(
    () => proposals.filter((p) => !p.executed && Date.now() / 1000 < p.endTime),
    [proposals],
  )

  const executedProposals = useMemo(() => proposals.filter((p) => p.executed), [proposals])

  const totalPages = useMemo(() => Math.ceil(totalProposals / pageSize), [totalProposals, pageSize])

  const isLoading = fetchingAllProposals || fetchingPaginatedProposals
  const displayError = error || allProposalsError || paginatedError || executeError

  if (isLoading && proposals.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Governance</h1>
          <p className="text-muted-foreground">View and participate in protocol governance</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} disabled={!isConnected}>
          Create New Proposal
        </Button>
      </div>

      {displayError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Proposals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProposals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Proposals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProposals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executed Proposals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{executedProposals.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Proposals</CardTitle>
          {usePagination && (
            <CardDescription>
              Showing {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, totalProposals)} of{" "}
              {totalProposals} proposals
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {proposals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No proposals found. Create one to get started.</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Votes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal) => {
                    const status = getProposalStatus(proposal)
                    const canExecute =
                      !proposal.executed &&
                      status.label === "Ready to Execute" &&
                      proposal.forVotes > proposal.againstVotes

                    return (
                      <TableRow key={proposal.id}>
                        <TableCell className="font-medium">{proposal.id}</TableCell>
                        <TableCell
                          className="max-w-md truncate cursor-pointer hover:text-primary"
                          onClick={() => navigate(`/dashboard/governance/${proposal.id}`)}
                        >
                          {proposal.description}
                        </TableCell>
                        <TableCell>{PROPOSAL_TYPES[proposal.proposalType] || "Unknown"}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-600">✓ {proposal.forVotes}</span>
                          {" / "}
                          <span className="text-red-600">✗ {proposal.againstVotes}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={status.color}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {status.label === "Active" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedProposal(proposal)}
                                disabled={!isConnected}
                              >
                                Vote
                              </Button>
                            )}
                            {canExecute && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExecute(proposal.id)}
                                disabled={executing || !isConnected}
                              >
                                {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Execute"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {usePagination && totalPages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                        disabled={currentPage === 0}
                      />
                    </PaginationItem>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Show pages around current page
                      let pageToShow
                      if (totalPages <= 5) {
                        pageToShow = i
                      } else if (currentPage < 2) {
                        pageToShow = i
                      } else if (currentPage > totalPages - 3) {
                        pageToShow = totalPages - 5 + i
                      } else {
                        pageToShow = currentPage - 2 + i
                      }

                      return (
                        <PaginationItem key={pageToShow}>
                          <Button
                            variant={currentPage === pageToShow ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageToShow)}
                          >
                            {pageToShow + 1}
                          </Button>
                        </PaginationItem>
                      )
                    })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
                        disabled={currentPage === totalPages - 1}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateProposalDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      <VoteDialog
        proposal={selectedProposal}
        onOpenChange={(open) => !open && setSelectedProposal(null)}
        onSuccess={handleVoteSuccess}
      />
    </div>
  )
}

export default Governance

