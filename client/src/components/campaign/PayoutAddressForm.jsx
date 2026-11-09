"use client"

import { useState } from "react"
import { ethers } from "ethers"
import { toast } from "react-toastify"
import { Loader2 } from "lucide-react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import useSignerOrProvider from "../../hooks/useSignerOrProvider"
import useContract from "../../hooks/useContract"
import ClearCauseABI from "../../abis/ClearCause.json"

/**
 * Lets the campaign creator set where the funds will be paid, while the
 * campaign is still waiting for admin review. After approval it is locked.
 */
const PayoutAddressForm = ({ campaignId, current, onChanged }) => {
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const { signer } = useSignerOrProvider()
  const { contract } = useContract(import.meta.env.VITE_APP_CONTRACT_ADDRESS, ClearCauseABI)

  const save = async () => {
    if (!ethers.isAddress(value.trim())) {
      toast.error("Enter a valid wallet address (0x...)")
      return
    }
    if (!signer || !contract) {
      toast.error("Wallet not ready yet")
      return
    }
    setSaving(true)
    try {
      const tx = await contract.setPayoutAddress(campaignId, value.trim())
      await tx.wait()
      toast.success("Payout address saved")
      setValue("")
      onChanged?.()
    } catch (err) {
      console.error(err)
      toast.error(err?.shortMessage || err?.message || "Could not save the payout address")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Funds will be paid to <span className="font-mono break-all">{current}</span>. You can change this until an admin
        approves the campaign.
      </p>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="New payout address (0x...)" disabled={saving} />
        <Button onClick={save} disabled={saving || !value.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  )
}

export default PayoutAddressForm
