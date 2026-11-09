"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ExternalLink } from "lucide-react"
import { toast } from "react-toastify"
import { useAppKitAccount } from "@reown/appkit/react"
import useContract from "../../hooks/useContract"
import useGetTokenData from "../../hooks/NFT/useGetTokenData"
import ClearCauseABI from "../../abis/ClearCause.json"

const NFTs = () => {
  const [nfts, setNfts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [tokenIds, setTokenIds] = useState([])
  const { address, isConnected } = useAppKitAccount()
  const { getTokenData, loading, error } = useGetTokenData()

  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  // First, get all token IDs owned by the user
  useEffect(() => {
    const fetchTokenIds = async () => {
      if (!address || !isConnected || !contract) {
        setIsLoading(false)
        return
      }

      try {
        // Get the balance (number of tokens owned by the user)
        const balance = await contract.balanceOf(address)
        const balanceNumber = Number.parseInt(balance.toString())

        // Get each token ID owned by the user
        const tokenIdPromises = []
        for (let i = 0; i < balanceNumber; i++) {
          tokenIdPromises.push(contract.tokenOfOwnerByIndex(address, i))
        }

        const fetchedTokenIds = await Promise.all(tokenIdPromises)
        setTokenIds(fetchedTokenIds.map((id) => id.toString()))
      } catch (err) {
        console.error("Error fetching token IDs:", err)
        toast.error("Failed to load your NFTs")
      }
    }

    fetchTokenIds()
  }, [address, isConnected, contract])

  // Then, fetch data for each token ID
  useEffect(() => {
    const fetchNFTData = async () => {
      if (tokenIds.length === 0) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const nftPromises = tokenIds.map(async (tokenId) => {
          const tokenData = await getTokenData(tokenId)

          if (!tokenData) return null

          // Fetch metadata from tokenURI
          let metadata = {
            name: `Donation #${tokenId}`,
            image: "/placeholder.svg",
            description: "",
          }

          try {
            // Attempt to fetch metadata from the tokenURI
            const response = await fetch(tokenData.tokenURI)
            if (response.ok) {
              const data = await response.json()
              metadata = {
                name: data.name || metadata.name,
                image: data.image || metadata.image,
                description: data.description || "",
              }
            }
          } catch (metadataErr) {
            console.error("Error fetching metadata:", metadataErr)
            // Continue with default metadata if fetch fails
          }

          return {
            id: tokenId,
            name: metadata.name,
            image: metadata.image,
            description: metadata.description,
            campaignId: tokenData.campaignId,
            donationAmount: tokenData.donationAmount,
            tokenURI: tokenData.tokenURI,
          }
        })

        const fetchedNfts = (await Promise.all(nftPromises)).filter((nft) => nft !== null)
        setNfts(fetchedNfts)
      } catch (err) {
        console.error("Error fetching NFT data:", err)
        toast.error("Failed to load NFT data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchNFTData()
  }, [tokenIds, getTokenData])

  if (!isConnected) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">My NFTs</h1>
        <div className="text-center p-12 bg-muted rounded-lg">
          <p className="text-xl font-medium mb-2">Wallet Not Connected</p>
          <p className="text-muted-foreground">Please connect your wallet to view your NFTs.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">My NFTs</h1>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <p className="font-semibold">Error loading NFTs</p>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">My NFTs</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="w-full h-48 mb-4" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : nfts.length === 0 ? (
        <div className="text-center p-12 bg-muted rounded-lg">
          <p className="text-xl font-medium mb-2">No NFTs Found</p>
          <p className="text-muted-foreground">You don't have any donation NFTs yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nfts.map((nft) => (
            <Card key={nft.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle>{nft.name}</CardTitle>
                  <Badge variant="outline" className="bg-primary/10">
                    #{nft.id}
                  </Badge>
                </div>
                <CardDescription>Donation: {nft.donationAmount} ETH</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <img
                    src={nft.image || "/placeholder.svg"}
                    alt={nft.name}
                    className="w-full h-48 object-cover mb-4 rounded-md"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = "/placeholder.svg"
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Campaign ID:</span> {nft.campaignId}
                  </p>
                  {nft.description && <p className="text-sm text-muted-foreground">{nft.description}</p>}
                  {nft.tokenURI && (
                    <a
                      href={nft.tokenURI}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary flex items-center hover:underline"
                    >
                      View Metadata <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default NFTs

