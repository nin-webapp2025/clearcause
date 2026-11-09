"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, ImageIcon, Calendar, Target, Flag, Info, X, AlertCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "react-toastify"
import useCreateCampaign from "../../hooks/Campaign Management/useCreateCampaign"
import { useAppKitAccount } from "@reown/appkit/react"
import { ethers } from "ethers"
import { readOnlyProvider } from "../../constant/readOnlyProvider"
import useSignerOrProvider from "../../hooks/useSignerOrProvider"
import { ensureIdentitySession, identityFetch } from "../../lib/identityApi"
import useIsUserVerified from "../../hooks/KYC/useIsUserVerified"
import { Link } from "react-router-dom"

const CreateCampaign = () => {
  const { createCampaign, loading, error } = useCreateCampaign()
  const { address, isConnected } = useAppKitAccount()
  const { signer } = useSignerOrProvider()
  const { isUserVerified, loading: checkingKyc } = useIsUserVerified()
  const [kycVerified, setKycVerified] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [advancedMode, setAdvancedMode] = useState(false)
  const [networkStatus, setNetworkStatus] = useState("idle")
  const [chainTimestamp, setChainTimestamp] = useState(null)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    target: "",
    deadline: "",
    image: "",
    milestones: "",
    payoutAddress: "",
  })

  useEffect(() => {
    if (!isConnected) {
      setNetworkStatus("idle")
      return undefined
    }

    const checkNetwork = async () => {
      try {
        const latestBlock = await readOnlyProvider.getBlock("latest")
        setChainTimestamp(Number(latestBlock.timestamp))
        setNetworkStatus("connected")
      } catch {
        setNetworkStatus("issues")
      }
    }

    checkNetwork()
    const interval = setInterval(checkNetwork, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [isConnected])

  useEffect(() => {
    let active = true
    if (!isConnected || !address) {
      setKycVerified(false)
      return () => { active = false }
    }
    isUserVerified(address)
      .then((verified) => { if (active) setKycVerified(Boolean(verified)) })
      .catch(() => { if (active) setKycVerified(false) })
    return () => { active = false }
  }, [address, isConnected, isUserVerified])

  const handleInputChange = (e) => {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Upload a JPEG, PNG, or WebP image.")
      e.target.value = ""
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("The campaign image must be 5 MB or smaller.")
      e.target.value = ""
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)

      const uploadUrl = import.meta.env.VITE_APP_CLOUDINARY_URL
      const uploadPreset = import.meta.env.VITE_APP_CLOUDINARY_PRESET

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 300)

      let imageUrl
      if (uploadUrl && uploadPreset) {
        const cloudinaryData = new FormData()
        cloudinaryData.append("file", file)
        cloudinaryData.append("upload_preset", uploadPreset)
        const response = await fetch(uploadUrl, { method: "POST", body: cloudinaryData })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.secure_url) throw new Error(payload?.error?.message || "Failed to upload image")
        imageUrl = payload.secure_url
      } else {
        if (!signer || !address) throw new Error("Connect your wallet before uploading a campaign image.")
        await ensureIdentitySession(address, signer)
        const payload = await identityFetch("/campaign/image", {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        })
        imageUrl = payload.imageUrl
      }

      clearInterval(progressInterval)
      setUploadProgress(100)
      setFormData((prev) => ({
        ...prev,
        image: imageUrl,
      }))

      toast.success("Image uploaded successfully!")
    } catch (err) {
      toast.error(err.message || "Failed to upload image")
      console.error(err)
    } finally {
      setTimeout(() => {
        setUploading(false)
        setUploadProgress(0)
      }, 500)
    }
  }

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a campaign title")
      return false
    }

    if (!formData.target || Number(formData.target) <= 0) {
      toast.error("Please enter a valid funding target")
      return false
    }

    if (!formData.deadline) {
      toast.error("Please select a deadline")
      return false
    }

    if (formData.payoutAddress.trim() && !ethers.isAddress(formData.payoutAddress.trim())) {
      toast.error("The payout address is not a valid wallet address")
      return false
    }

    const deadlineTimestamp = Math.floor(new Date(formData.deadline).getTime() / 1000)
    const referenceTimestamp = chainTimestamp ?? Math.floor(Date.now() / 1000)
    if (deadlineTimestamp < referenceTimestamp + 24 * 60 * 60) {
      toast.error("Campaign duration must be at least 1 day from the current blockchain time")
      return false
    }
    if (deadlineTimestamp > referenceTimestamp + 90 * 24 * 60 * 60) {
      toast.error("Campaign duration cannot exceed 90 days")
      return false
    }

    // Validate milestone percentages
    if (advancedMode && formData.milestones.trim()) {
      try {
        const milestonesArray = formData.milestones
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item !== "")
          .map(Number)

        // Validate milestone values
        if (milestonesArray.some(isNaN)) {
          toast.error("Milestones must be valid numbers")
          return false
        }

        if (milestonesArray.length > 10) {
          toast.error("Too many milestones. Maximum is 10.")
          return false
        }

        // Check if milestones are in ascending order
        for (let i = 1; i < milestonesArray.length; i++) {
          if (milestonesArray[i] <= milestonesArray[i - 1]) {
            toast.error("Milestones must be in ascending order")
            return false
          }
        }
      } catch (err) {
        toast.error("Invalid milestone format")
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isConnected) {
      toast.error("Please connect your wallet to create a campaign")
      return
    }

    if (networkStatus === "issues") {
      toast.warning("Network issues detected. Your transaction might fail. Consider trying again later.")
    }

    if (!validateForm()) {
      return
    }

    // Parse milestone percentages from the input
    // If not provided, use default milestones
    let milestonesArray = [25, 50, 75, 100]

    if (advancedMode && formData.milestones.trim()) {
      milestonesArray = formData.milestones
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "")
        .map(Number)
    }

    try {
      const result = await createCampaign(
        formData.title,
        formData.description,
        formData.target,
        formData.deadline,
        formData.image,
        milestonesArray,
        formData.payoutAddress.trim() || undefined,
      )

      if (result && result.success) {
        toast.success(`Campaign created successfully! ID: ${result.campaignId}`)
        setFormData({
          title: "",
          description: "",
          target: "",
          deadline: "",
          image: "",
          milestones: "",
          payoutAddress: "",
        })
        setAdvancedMode(false)
      }
    } catch (err) {
      console.error("Error in handleSubmit:", err)
    }
  }

  // The local demo advances Hardhat time while seeding scenarios, so date
  // constraints must follow the chain rather than the computer's clock.
  const referenceTimestamp = chainTimestamp ?? Math.floor(Date.now() / 1000)
  const minDate = new Date((referenceTimestamp + 2 * 24 * 60 * 60) * 1000).toISOString().split("T")[0]
  const maxDate = new Date((referenceTimestamp + 90 * 24 * 60 * 60) * 1000).toISOString().split("T")[0]

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="max-w-4xl mx-auto mt-10 border-none shadow-2xl">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/60 p-8">
          <CardTitle className="text-4xl font-bold mb-2 text-primary-foreground">Create Campaign</CardTitle>
          <CardDescription className="text-xl text-primary-foreground/80">
            Launch your fundraising campaign
          </CardDescription>
        </CardHeader>

        {!isConnected && (
          <Alert className="mx-8 mt-8 bg-yellow-500/10 text-yellow-700 border-yellow-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Please connect your wallet to create a campaign</AlertDescription>
          </Alert>
        )}

        {isConnected && networkStatus === "issues" && (
          <Alert className="mx-8 mt-8 bg-yellow-500/10 text-yellow-700 border-yellow-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Network issues detected. Transactions might fail. Consider trying again later.
            </AlertDescription>
          </Alert>
        )}

        {isConnected && !checkingKyc && !kycVerified && (
          <Alert className="mx-8 mt-8 border-amber-200 bg-amber-50 text-amber-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your wallet must be verified before it can create a campaign.{" "}
              <Link to="/dashboard/kyc" className="font-medium underline">Open verification</Link>
            </AlertDescription>
          </Alert>
        )}

        <CardContent className="p-8">
          <ScrollArea className="h-[60vh] pr-4">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-lg font-semibold">
                  Campaign Title
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="text-lg"
                  placeholder="Enter your campaign title"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-lg font-semibold">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="text-lg"
                  placeholder="Describe your campaign..."
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label htmlFor="target" className="text-lg font-semibold">
                    Funding Target (ETH)
                  </Label>
                  <div className="relative">
                    <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="target"
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={formData.target}
                      onChange={handleInputChange}
                      required
                      className="text-lg pl-10"
                      placeholder="0.00"
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum target: 0.1 ETH</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline" className="text-lg font-semibold">
                    Deadline
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={handleInputChange}
                      min={minDate}
                      max={maxDate}
                      required
                      className="text-lg pl-10"
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Campaign duration: 1-90 days</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payoutAddress" className="text-lg font-semibold">
                  Payout Address (optional)
                </Label>
                <Input
                  id="payoutAddress"
                  value={formData.payoutAddress}
                  onChange={handleInputChange}
                  className="text-lg font-mono"
                  placeholder="0x... (leave empty to be paid to your own wallet)"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Where the funds go if the campaign succeeds, for example the charity&apos;s own wallet. The admin
                  reviews this address, and it is locked once the campaign is approved.
                </p>
              </div>

              <Alert className="bg-blue-500/10 text-blue-800 border-blue-200">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  New campaigns are reviewed by an administrator before they can receive donations.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <Label htmlFor="image" className="text-lg font-semibold">
                  Campaign Image
                </Label>
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1">
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading || loading}
                      className="text-lg"
                    />
                    <ImageIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  </div>
                  {uploading && <Loader2 className="animate-spin" />}
                </div>
                {uploadProgress > 0 && <Progress value={uploadProgress} className="w-full mt-2" />}
                {formData.image && (
                  <div className="relative group mt-4">
                    <img
                      src={formData.image || "/placeholder.svg"}
                      alt="Campaign"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, image: "" }))}
                      className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={loading}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="advanced-mode"
                  checked={advancedMode}
                  onCheckedChange={setAdvancedMode}
                  disabled={loading}
                />
                <Label htmlFor="advanced-mode" className="text-lg font-semibold">
                  Advanced Mode
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Enable to set custom milestone percentages</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <AnimatePresence>
                {advancedMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Label htmlFor="milestones" className="text-lg font-semibold">
                      Milestone Percentages
                    </Label>
                    <div className="relative">
                      <Flag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="milestones"
                        value={formData.milestones}
                        onChange={handleInputChange}
                        className="text-lg pl-10"
                        placeholder="25,50,75,100"
                        disabled={loading}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enter milestone percentages separated by commas (default: 25,50,75,100)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Values must be in ascending order and maximum 10 milestones are allowed
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </ScrollArea>
        </CardContent>
        <CardFooter className="bg-muted/50 p-8">
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || uploading || !isConnected || checkingKyc || !kycVerified}
            className="w-full text-lg py-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 transform hover:scale-105"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Creating Campaign...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-6 w-6" />
                Create Campaign
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-4xl mx-auto mt-4 p-4 bg-destructive text-destructive-foreground rounded-lg"
        >
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </motion.div>
      )}
    </motion.div>
  )
}

export default CreateCampaign

