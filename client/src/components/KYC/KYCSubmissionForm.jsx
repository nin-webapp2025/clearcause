import { useState } from "react"
import { useAppKitAccount } from "@reown/appkit/react"
import useSubmitKYC from "../../hooks/KYC/useSubmitKYC"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Progress } from "../../components/ui/progress"
import { Loader2, Upload, X } from "lucide-react"
import { toast } from "react-toastify"
import useSignerOrProvider from "../../hooks/useSignerOrProvider"
import { ensureIdentitySession, identityFetch } from "../../lib/identityApi"

export function KYCSubmissionForm() {
  const { address, isConnected } = useAppKitAccount()
  const { submitKYC, loading, error } = useSubmitKYC()
  const { signer } = useSignerOrProvider()
  const [previewUrl, setPreviewUrl] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    nationality: "",
    idNumber: "",
    idImage: "",
  })
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Upload a JPEG, PNG, or WebP image.")
      e.target.value = ""
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("The image must be 2 MB or smaller.")
      e.target.value = ""
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)

      if (!signer || !address) throw new Error("Connect your wallet before uploading an identity image.")
      await ensureIdentitySession(address, signer)
      const data = await identityFetch("/kyc/document", { method: "POST", headers: { "Content-Type": file.type }, body: file })

      setFormData((prevState) => ({
        ...prevState,
        idImage: data.documentId,
      }))
      setPreviewUrl(URL.createObjectURL(file))

      toast.success("ID uploaded successfully!")
    } catch (error) {
      console.error("Error uploading ID:", error)
      toast.error(error.message || "Failed to upload ID. Please try again.")
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleRemoveImage = () => {
    setFormData((prevState) => ({ ...prevState, idImage: "" }))
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isConnected || !address) {
      toast.error("Please connect your wallet before submitting KYC.")
      return
    }
    if (!formData.idImage) {
      toast.error("Please upload an ID image.")
      return
    }

    try {
      if (!signer) throw new Error("The connected wallet is not ready.")
      await ensureIdentitySession(address, signer)
      const application = await identityFetch("/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name, email: formData.email, nationality: formData.nationality, idNumber: formData.idNumber, documentId: formData.idImage }),
      })
      await submitKYC(application.proofHash)
    } catch (submitError) {
      toast.error(submitError.message || "KYC submission failed.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
      {!isConnected && (
        <p role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Connect your wallet to enter and submit KYC details.
        </p>
      )}
      <fieldset disabled={!isConnected || loading || uploading} className="space-y-6 disabled:opacity-60">
      <div>
        <Label htmlFor="name">Full Name</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
      </div>
      <div>
        <Label htmlFor="nationality">Nationality</Label>
        <Input id="nationality" name="nationality" value={formData.nationality} onChange={handleChange} required />
      </div>
      <div>
        <Label htmlFor="idNumber">ID Number</Label>
        <Input id="idNumber" name="idNumber" value={formData.idNumber} onChange={handleChange} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="idImage">Upload ID Image</Label>
        <p className="text-xs text-neutral-500">The document is stored by the private identity service. Only its proof hash is recorded on-chain.</p>
        {formData.idImage ? (
          <div className="relative group w-48 h-32 border rounded-lg overflow-hidden">
            <img src={previewUrl || "/placeholder.svg"} alt="ID Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="relative flex items-center">
            <Input id="idImage" type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
            {uploading && <Loader2 className="animate-spin text-blue-500 ml-2" />}
          </div>
        )}
        {uploading && <Progress value={uploadProgress} className="w-full mt-2" />}
      </div>

      </fieldset>

      <Button type="submit" disabled={!isConnected || loading || uploading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting KYC...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Submit KYC
          </>
        )}
      </Button>

      {error && <p className="text-red-500 mt-2">{error}</p>}
    </form>
  )
}
